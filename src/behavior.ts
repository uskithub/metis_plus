import { Adviser } from "./adviser"
import { AiSettings, DataStore, ListToSave, VocativeSettings } from "./dataStore"
import { Messenger } from "./messenger"
import { DEFAULT_VOCATIVE_SETTINGS, Stt } from "./stt"
import { Pages, Presenter } from "./presenter"
import { Empty, SwiftEnum, SwiftEnumCases } from "./enum"
import { ref } from "vue"
import { GoogleGenerativeAIFetchError } from "@google/generative-ai"
import { SoundCrew } from "./soundCrew"
import { SttWhisper } from "./sttWhisper"

export const MeetStatus = {
  initilizing: "initilizing",
  ready: "ready",
  connecting: "connecting",
  meeting: "meeting",
  terminated: "terminated"
} as const

export type MeetStatus = (typeof MeetStatus)[keyof typeof MeetStatus]

type AiSettingStatusContext = {
  unknown: Empty
  keysNotSet: Empty
  keysSet: AiSettings
  keyIsUnavailable: { gemini: string }
}

export const AiSettingStatus = new SwiftEnum<AiSettingStatusContext>()
export type AiSettingStatus = SwiftEnumCases<AiSettingStatusContext>

type AdviserStatusContext = {
  idle: Empty
  unavailable: Empty
  invalidApiKey: Empty
  thinking: { question: string }
  answered: { question: string; answer: string }
  hasProblem: Empty
}

export const AdviserStatus = new SwiftEnum<AdviserStatusContext>()
export type AdviserStatus = SwiftEnumCases<AdviserStatusContext>

type UsecaseContext = {
  setupAiSettings: { settings: AiSettings }
  setupVocativeSettings: { settings: VocativeSettings }
  openSettings: Empty
  uploadModel: { model: File }
  forceStop: Empty
  ask: { question: string }
}

export const Usecases = new SwiftEnum<UsecaseContext>()
export type Usecases = SwiftEnumCases<UsecaseContext>

const adviserStatus = ref<AdviserStatus>(AdviserStatus.idle())

export class Behavior {
  private state: {
    meetStatus: MeetStatus
    vocativeSettings: VocativeSettings
    aiSettingStauts: AiSettingStatus
  }

  private dependencies: {
    stt: Stt | null
    sstWhisper: SttWhisper | null
    adviser: Adviser | null
    messenger: Messenger
    presenter: Presenter
    dataStore: DataStore
    soundCrew: SoundCrew | null
  }

  private beheviorBySystem: { [key in MeetStatus]: () => void } = {
    [MeetStatus.initilizing]: () => {
      // console.log("do nothing")
    },
    [MeetStatus.ready]: () => {
      this.dependencies.presenter.setup(
        Pages.preMeeting({
          aiSettingStatus: this.state.aiSettingStauts,
          vocativeSettings: this.state.vocativeSettings,
          adviserStatus
        })
      )
      // const { lang, words } = this.state.vocativeSettings
      // const stt = new Stt(lang, words)
      // stt.subscribe((transcript) => {
      //   const question = `${transcript}？`
      //   this.dispatch(Usecases.ask({ question }))
      // })
      // this.dependencies.stt = stt
      const sstWhisper = new SttWhisper()
      sstWhisper.setup().then(() => {
        const soundCrew = new SoundCrew()
        soundCrew.setup()
        soundCrew.subscribe((audio) => {
          console.log("!!!!DETECTED: ")
          sstWhisper.transcribe(audio, "ja")
        })
        this.dependencies.soundCrew = soundCrew
        this.dependencies.sstWhisper = sstWhisper
      })
    },
    [MeetStatus.connecting]: () => {
      // console.log("do nothing")
    },
    [MeetStatus.meeting]: () => {
      this.dependencies.stt?.start()
      this.dependencies.presenter.setup(
        Pages.meeting({
          aiSettingStatus: this.state.aiSettingStauts,
          vocativeSettings: this.state.vocativeSettings,
          adviserStatus
        })
      )
    },
    [MeetStatus.terminated]: () => {
      this.dependencies.stt?.stop()
      this.dependencies.stt = null
    }
  }

  private behaviorByUser: { [key in keyof UsecaseContext]: (args: any) => Promise<any> } = {
    setupAiSettings: ({ settings }: { settings: AiSettings }): Promise<void> => {
      this.dependencies.dataStore.set(ListToSave.AI_SETTINGS, settings)
      const key = settings.apiKeys[settings.aiToUse]
      if (key) {
        this.dependencies.adviser = new Adviser(key, this.state.vocativeSettings.name)
      }
      this.state.aiSettingStauts = AiSettingStatus.keysSet(settings)
      return Promise.resolve()
    },
    setupVocativeSettings: ({ settings }: { settings: VocativeSettings }): Promise<void> => {
      this.dependencies.dataStore.set(ListToSave.VOCATIVE_SETTINGS, settings)
      const key = this.state.aiSettingStauts.apiKeys[this.state.aiSettingStauts.aiToUse]
      if (key) {
        this.dependencies.adviser = new Adviser(key, settings.name)
      }
      this.dependencies.stt?.stop()
      this.dependencies.stt = null

      const stt = new Stt(settings.lang, settings.words)
      stt.subscribe((transcript) => {
        const question = `${transcript}？`
        this.dispatch(Usecases.ask({ question }))
      })
      if (this.state.meetStatus === MeetStatus.meeting) {
        stt.start()
      }
      this.dependencies.stt = stt
      this.state.vocativeSettings = settings
      return Promise.resolve()
    },
    openSettings: (): Promise<[VocativeSettings, AiSettings]> => {
      return this.dependencies.dataStore
        .get<VocativeSettings>(ListToSave.VOCATIVE_SETTINGS)
        .then((vocativeSettings) => {
          return this.dependencies.dataStore
            .get<AiSettings>(ListToSave.AI_SETTINGS)
            .then((aiSettings) => {
              return [vocativeSettings, aiSettings]
            })
        })
    },
    uploadModel: ({ model }: { model: File }): Promise<void> => {
      const reader = new FileReader()
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            const buf = new Uint8Array(reader.result)
            this.dependencies.sstWhisper?.setupModel(buf)
            resolve()
          } else {
            reject("reader.result is not ArrayBuffer")
          }
        }
        reader.readAsArrayBuffer(model)
      })
    },
    forceStop: (): Promise<void> => {
      this.dependencies.soundCrew?.forceStop()
      return Promise.resolve()
    },
    ask: ({ question }: { question: string }): Promise<void> => {
      console.log("☆☆☆", question)

      if (this.dependencies.adviser === null) {
        adviserStatus.value = AdviserStatus.unavailable()
        return Promise.resolve()
      }

      adviserStatus.value = AdviserStatus.thinking({ question })

      const _adviser = this.dependencies.adviser
      return this.dependencies.messenger
        .send(question)
        .catch((_) => {
          return this.dependencies.presenter.openChatPanel().then(() => {
            return this.dependencies.messenger.send(question)
          })
        })
        .finally(() => {
          _adviser
            .answer(question)
            .then((advice) => {
              console.log("★★★", advice)
              this.dependencies.messenger.send(advice)
              adviserStatus.value = AdviserStatus.idle()
            })
            .catch((err) => {
              if (
                err instanceof GoogleGenerativeAIFetchError &&
                err.errorDetails &&
                err.errorDetails[0].reason === "API_KEY_INVALID"
              ) {
                adviserStatus.value = AdviserStatus.invalidApiKey()
              } else {
                console.error(err)
                adviserStatus.value = AdviserStatus.hasProblem()
              }
            })
        })
    }
  }

  constructor() {
    this.state = {
      meetStatus: MeetStatus.initilizing,
      vocativeSettings: DEFAULT_VOCATIVE_SETTINGS,
      aiSettingStauts: AiSettingStatus.unknown()
    }

    this.dependencies = {
      stt: null,
      sstWhisper: null,
      adviser: null,
      messenger: new Messenger(),
      presenter: new Presenter(this.dispatch.bind(this)),
      dataStore: new DataStore(),
      soundCrew: null
    }
  }

  __test() {
    this.state.aiSettingStauts = AiSettingStatus.keysNotSet()
    this.notify(MeetStatus.ready)
  }

  run(initialAction?: () => void): void {
    this.dependencies.dataStore
      .get<VocativeSettings>(ListToSave.VOCATIVE_SETTINGS)
      .then((vocativeSettings) => {
        this.state.vocativeSettings = vocativeSettings
      })
      .catch((_) => {
        return this.dependencies.dataStore
          .set<VocativeSettings>(ListToSave.VOCATIVE_SETTINGS, DEFAULT_VOCATIVE_SETTINGS)
          .then(() => DEFAULT_VOCATIVE_SETTINGS)
      })
      .then(() => {
        return this.dependencies.dataStore
          .get<AiSettings>(ListToSave.AI_SETTINGS)
          .then((aiSettings) => {
            this.state.aiSettingStauts = AiSettingStatus.keysSet(aiSettings)
            const key = aiSettings.apiKeys[aiSettings.aiToUse]
            if (key) {
              this.dependencies.adviser = new Adviser(key, this.state.vocativeSettings.name)
            }
          })
          .catch((_) => {
            this.state.aiSettingStauts = AiSettingStatus.keysNotSet()
          })
          .finally(() => {
            initialAction?.()
          })
      })
  }

  notify(status: MeetStatus): void {
    // console.log(status)
    if (this.state.meetStatus !== status) {
      // console.log("Meet status changed: ", status)
      this.state.meetStatus = status
      this.beheviorBySystem[status]()
    }
  }

  dispatch(usecase: Usecases): Promise<any> {
    // console.log("usecase: ", usecase)
    const { case: _case, ...context } = usecase
    return this.behaviorByUser[_case](context)
  }
}
