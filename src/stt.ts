type Observer<T> = (data: T) => void

const RESTART_THRESHOLD = 10
export const DEFAULT_VOCATIVE_SETTINGS = {
  name: "メーティス",
  words: ["メーティス", "メティス", "メイティス"],
  lang: "ja-JP"
}

export const STTs = {
  webkitSpeechRecognition: "webkitSpeechRecognition",
  whisperCpp: "whisper.cpp"
} as const

export type STTs = (typeof STTs)[keyof typeof STTs]

export const STTInfo = [
  { key: STTs.webkitSpeechRecognition, name: "WebkitSpeechRecognition", isAvailable: true },
  { key: STTs.whisperCpp, name: "Whisper.cpp", isAvailable: true }
] as const

export class Stt {
  private recognition: SpeechRecognition
  private observers: Observer<string>[] = []
  private count: number = 0

  constructor(
    private lang: string = DEFAULT_VOCATIVE_SETTINGS.lang,
    private keywords: string[] = DEFAULT_VOCATIVE_SETTINGS.words
  ) {
    this.recognition = this.createRecognition()
  }

  private createRecognition(): SpeechRecognition {
    const recognition = new webkitSpeechRecognition()
    recognition.lang = this.lang
    // recognition.interimResults = true; // 中間結果も取得する場合
    recognition.continuous = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const num = event.results.length
      const transcript = event.results[num - 1][0].transcript
      if (transcript === "") {
        console.log(event.results[num - 1][0])
      } else {
        console.log(transcript)
      }

      const tmp = transcript.replace(/\s+/g, "")

      // keywordsに引っかかればobserverを呼ぶ
      if (
        tmp.length > 0 &&
        this.keywords.reduce((result, keyword) => result || tmp.includes(keyword), false)
      ) {
        for (const observer of this.observers) {
          observer(transcript.trim())
        }
      }
    }

    recognition.onend = () => {
      if (this.count === RESTART_THRESHOLD) {
        this.count = 0
        this.recognition = this.createRecognition()
      }
      this.count += 1
      this.start() // 定期的に切れるので繋ぎ直す
    }

    return recognition
  }

  subscribe(observer: Observer<string>): void {
    this.observers.push(observer)
  }

  start() {
    this.recognition.start()
  }

  stop() {
    this.recognition.onend = null
    this.recognition.onresult = null
    this.recognition.stop()
    this.observers = []
  }
}
