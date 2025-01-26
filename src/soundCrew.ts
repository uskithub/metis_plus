type Observer<T> = (data: T) => void

const SILENCE_THRESHOLD = 0.01
const SILENCE_DURATION = 0.5

const kSampleRate = 16000

const workletUrl =
  import.meta.env.MODE === "development"
    ? "myAudioProcessor.js"
    : chrome.runtime.getURL("myAudioProcessor.js")

export const SoundCrewStatus = {
  initilizing: "initilizing",
  stopped: "stopped",
  idle: "idle",
  listening: "listening",
  unavailable: "unavailable"
} as const

export type SoundCrewStatus = (typeof SoundCrewStatus)[keyof typeof SoundCrewStatus]

const Mode = {
  playback: "playback",
  listening: "listening"
} as const

type Mode = (typeof Mode)[keyof typeof Mode]

export class SoundCrew {
  private audioContext = new AudioContext({ sampleRate: kSampleRate })
  private worklet: AudioWorkletNode | null = null
  private stream: MediaStream | null = null
  private status: SoundCrewStatus = SoundCrewStatus.initilizing
  private mode: Mode = Mode.listening
  private silenceTime = 0
  private isForceStopped = false
  private currentData: Float32Array[] = []
  private observers: Observer<Float32Array>[] = []

  constructor() {}

  get sampleRate() {
    return this.audioContext.sampleRate
  }

  private postAudio() {
    // サンプルを一つの Float32Array に結合
    const length = this.currentData.reduce((sum, chunk) => sum + chunk.length, 0)
    const buffer = new Float32Array(length)
    let offset = 0
    for (const chunk of this.currentData) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    this.currentData = []

    if (length < 1) {
      // Uncaught NotSupportedError: Failed to execute 'createBuffer' on 'BaseAudioContext': The number of frames provided (0) is less than or equal to the minimum bound (0).
      //     at SoundCrew.postAudio (soundCrew.ts:53:43)
      //     at SoundCrew.onMessage (soundCrew.ts:96:14)
      return
    }

    // AudioBuffer を作成
    const audioBuffer = this.audioContext.createBuffer(
      1, // チャンネル数
      length, // サンプル数
      this.sampleRate // サンプルレート
    )

    // チャンネルデータを設定
    audioBuffer.getChannelData(0).set(buffer)

    if (this.mode === Mode.playback) {
      const playbackSource = this.audioContext.createBufferSource()
      playbackSource.buffer = audioBuffer
      playbackSource.connect(this.audioContext.destination)
      playbackSource.start(0)
    } else {
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      )

      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(offlineContext.destination)
      source.start(0)

      offlineContext.startRendering().then((renderedBuffer) => {
        const audio = renderedBuffer.getChannelData(0)
        for (const observer of this.observers) {
          observer(audio)
        }
      })
    }
  }

  private onMessage(event: MessageEvent) {
    const audioSamples = new Float32Array(event.data)
    const isCurrentSilent = audioSamples.every((sample) => Math.abs(sample) < SILENCE_THRESHOLD)

    if (isCurrentSilent) {
      if (this.status === SoundCrewStatus.idle) {
        return
      }
      const length = audioSamples.length
      const silenceSamples = new Float32Array(length)
      this.currentData.push(silenceSamples)
      this.silenceTime += length / this.sampleRate
      if (this.silenceTime > SILENCE_DURATION || this.isForceStopped) {
        this.status = SoundCrewStatus.idle
        this.postAudio()
      }
    } else {
      this.status = SoundCrewStatus.listening
      this.silenceTime = 0
      this.isForceStopped = false
      this.currentData.push(audioSamples)
    }
  }

  setup() {
    return this.audioContext.audioWorklet
      .addModule(workletUrl)
      .then(() => {
        console.log("============ audioWorklet.addModule ============")
        return navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: kSampleRate,
            channelCount: 1,
            echoCancellation: this.mode === Mode.playback,
            autoGainControl: true,
            noiseSuppression: true
          }
        })
      })
      .then((stream) => {
        console.log("============ mediaDevices.getUserMedia ============")
        const source = this.audioContext.createMediaStreamSource(stream)
        const worklet = new AudioWorkletNode(this.audioContext, "myAudioProcessor")

        worklet.port.onmessage = this.onMessage.bind(this)

        source.connect(worklet).connect(this.audioContext.destination)

        this.stream = stream
        this.worklet = worklet
        this.status = SoundCrewStatus.stopped
      })
      .catch((err) => {
        this.status = SoundCrewStatus.unavailable
        if (err.name === "NotAllowedError") {
          console.error("NotAllowedError setup SoundCrew:", err)
          throw err
        }
        console.error("Error setup SoundCrew:", err)
        throw err
      })
  }

  subscribe(observer: Observer<Float32Array>): void {
    this.observers.push(observer)
  }

  resume() {
    if (this.status === SoundCrewStatus.stopped) {
      this.status = SoundCrewStatus.idle
      this.audioContext.resume()
    }
  }

  suspend() {
    this.audioContext.suspend()
    this.currentData = []
    this.status = SoundCrewStatus.stopped
  }

  setPlaybackMode() {
    this.dispose()
    this.mode = Mode.playback
    this.setup()
  }

  forceStopListening() {
    this.isForceStopped = true
  }

  dispose() {
    this.audioContext.close()
    this.worklet?.port.close()
    this.worklet?.disconnect()
    this.worklet = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.currentData = []
  }
}
