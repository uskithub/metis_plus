import { AIs } from "./adviser"

export type ApiKeys = {
  -readonly [key in keyof typeof AIs]: string | null
}

export type Settings = {
  aiToUse: AIs
  apiKeys: ApiKeys
}

export const ListToSave = {
  SETTINGS: "SETTINGS"
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
