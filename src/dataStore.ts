import { AIs } from "./adviser"

export type ApiKeys = {
  -readonly [key in keyof typeof AIs]: string | null
}

export type VocativeSettings = {
  name: string
  words: string[]
  lang: string
}

export type AiSettings = {
  aiToUse: AIs
  apiKeys: ApiKeys
}

export const ListToSave = {
  VOCATIVE_SETTINGS: "VOCATIVE_SETTINGS",
  AI_SETTINGS: "SETTINGS"
} as const

export type ListToSave = (typeof ListToSave)[keyof typeof ListToSave]

export class DataStore {
  constructor() {}

  get<T>(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(key, (items) => {
        const value = items[key]
        if (value === undefined) reject(`"${key}" is not found in storage.`)
        resolve(value)
      })
    })
  }

  set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve()
      })
    })
  }
}
