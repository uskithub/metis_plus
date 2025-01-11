import { Adviser } from "./adviser"
import { DataStore, ListToSave, Settings } from "./dataStore"
import { Messenger } from "./messenger"
import { Stt } from "./stt"
import { Pages, Presenter } from "./presenter"
import { Empty, SwiftEnum, SwiftEnumCases } from "./enum"
import { ref } from "vue"
import { GoogleGenerativeAIFetchError } from "@google/generative-ai"

export const MeetStatus = {
  initilizing: "initilizing",
  ready: "ready",
  connecting: "connecting",
  meeting: "meeting",
  terminated: "terminated"
} as const

export type MeetStatus = (typeof MeetStatus)[keyof typeof MeetStatus]

type SettingStatusContext = {
  unknown: Empty
  keysNotSet: Empty
  keysSet: Settings
  keyIsUnavailable: { gemini: string }
}

export const SettingStatus = new SwiftEnum<SettingStatusContext>()
export type SettingStatus = SwiftEnumCases<SettingStatusContext>

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
  setupSettings: { settings: Settings }
  openSettings: Empty
  ask: { question: string }
}

export const Usecases = new SwiftEnum<UsecaseContext>()
export type Usecases = SwiftEnumCases<UsecaseContext>

const adviserStatus = ref<AdviserStatus>(AdviserStatus.idle())

export class Behavior {
  private state: { meetStatus: MeetStatus; settingStauts: SettingStatus }

  private dependencies: {
    stt: Stt | null
    adviser: Adviser | null
    messenger: Messenger
    presenter: Presenter
    dataStore: DataStore
  }

  private beheviorBySystem: { [key in MeetStatus]: () => void } = {
    [MeetStatus.initilizing]: () => {
      // console.log("do nothing")
    },
    [MeetStatus.ready]: () => {
      this.dependencies.presenter.setup(
        Pages.preMeeting({ settingStatus: this.state.settingStauts, adviserStatus })
      )
      const stt = new Stt()
      stt.subscribe((transcript) => {
        const question = `${transcript}？`
        this.dispatch(Usecases.ask({ question }))
      })
      this.dependencies.stt = stt
    },
    [MeetStatus.connecting]: () => {
      // console.log("do nothing")
    },
    [MeetStatus.meeting]: () => {
      this.dependencies.stt?.start()
      this.dependencies.presenter.setup(
        Pages.meeting({ settingStatus: this.state.settingStauts, adviserStatus })
      )
    },
    [MeetStatus.terminated]: () => {
      this.dependencies.stt?.stop()
      this.dependencies.stt = null
    }
  }

  private behaviorByUser: { [key in keyof UsecaseContext]: (args: any) => Promise<any> } = {
    setupSettings: ({ settings }: { settings: Settings }): Promise<void> => {
      this.dependencies.dataStore.set(ListToSave.SETTINGS, settings)
      this.dependencies.adviser = new Adviser(settings.apiKeys.gemini!)
      this.state.settingStauts = SettingStatus.keysSet(settings)
      return Promise.resolve()
    },
    openSettings: (): Promise<Settings> => {
      return this.dependencies.dataStore.get<Settings>(ListToSave.SETTINGS)
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
      settingStauts: SettingStatus.unknown()
    }

    this.dependencies = {
      stt: null,
      adviser: null,
      messenger: new Messenger(),
      presenter: new Presenter(this.dispatch.bind(this)),
      dataStore: new DataStore()
    }
  }

  __test() {
    this.state.settingStauts = SettingStatus.keysNotSet()
    this.notify(MeetStatus.ready)
  }

  run(initialAction?: () => void): void {
    this.dependencies.dataStore
      .get<Settings>(ListToSave.SETTINGS)
      .then((settings) => {
        this.state.settingStauts = SettingStatus.keysSet(settings)
        this.dependencies.adviser = new Adviser(settings.apiKeys.gemini!)
      })
      .catch((_) => {
        this.state.settingStauts = SettingStatus.keysNotSet()
      })
      .finally(() => {
        initialAction?.()
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
