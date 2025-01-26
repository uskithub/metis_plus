import { AIs } from "./adviser"
import { DEFAULT_VOCATIVE_SETTINGS, STTs } from "./stt"

export type ApiKeys = {
  -readonly [key in keyof typeof AIs]: string | null
}

export type AiSettings = {
  aiToUse: AIs
  apiKeys: ApiKeys
}

export type STTSettings = {
  sttToUse: STTs
  model?: File
}

export type VocativeSettings = {
  name: string
  words: string[]
  lang: string
}

export const ListToSave = {
  AI_SETTINGS: "SETTINGS",
  STT_SETTINGS: "STT_SETTINGS",
  VOCATIVE_SETTINGS: "VOCATIVE_SETTINGS"
} as const

export type ListToSave = (typeof ListToSave)[keyof typeof ListToSave]

export class DataStore {
  constructor() {}

  get<T>(key: ListToSave): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(key, (items) => {
        const value = items[key]
        if (value === undefined) reject(`"${key}" is not found in storage.`)
        resolve(value)
      })
    })
  }

  set<T>(key: ListToSave, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve()
      })
    })
  }
}

export class DataStoreMock {
  private stub: { [key in ListToSave]: () => any } = {
    [ListToSave.AI_SETTINGS]: () => ({
      aiToUse: AIs.gemini,
      apiKeys: "dummy gemini key"
    }),
    [ListToSave.STT_SETTINGS]: () => ({
      sttToUse: STTs.webkitSpeechRecognition
    }),
    [ListToSave.VOCATIVE_SETTINGS]: () => DEFAULT_VOCATIVE_SETTINGS
  }

  constructor() {}

  get<T>(key: ListToSave): Promise<T> {
    return new Promise((resolve) => {
      const value = this.stub[key]()
      resolve(value as T)
    })
  }

  set<T>(_key: ListToSave, _value: T): Promise<void> {
    return Promise.resolve()
  }
}
