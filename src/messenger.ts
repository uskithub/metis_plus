import { sleep } from "./utils"

const MAX_LENGTH = 500

export class Messenger {
  private messageInput: HTMLTextAreaElement | null = null
  private sendButton: HTMLButtonElement | null = null

  constructor() {
    this.setup()
  }

  private setup(): void {
    // textarea はページに一つしかない
    const messageInput = document.querySelector<HTMLTextAreaElement>("textarea")

    if (messageInput === null) {
      return
    }

    // どうやら textarea と送信ボタンの aria-label は共通の模様
    const label = messageInput.getAttribute("aria-label")

    if (label === null) {
      throw new Error("😇 fatal: aria-label of textarea not found!")
    }

    const sendButton = document.querySelector<HTMLButtonElement>(`button[aria-label=${label}]`)

    if (sendButton === null) {
      throw new Error("fatal: send button not found!")
    }
    this.messageInput = messageInput
    this.sendButton = sendButton
  }

  private split(input: string, threshold: number = MAX_LENGTH): string[] {
    const tmp = input.replace("/(\r?\n){3,}/g", "\n\n")
    if (tmp.length <= threshold) {
      return [tmp] // 分割不要
    }

    const truncated = tmp.slice(0, threshold)
    const lastNewlineIndex = truncated.lastIndexOf("\n")

    if (lastNewlineIndex !== -1) {
      // 最大長以内で最後の改行位置まで分割
      const firstPart = truncated.slice(0, lastNewlineIndex).trimEnd()
      const rest = tmp.slice(lastNewlineIndex + 1).trimStart()
      const restArray = this.split(rest, threshold)
      return [firstPart, ...restArray]
    } else {
      // 改行が見つからない場合は最大長でそのまま分割
      const firstPart = truncated.trimEnd()
      const rest = tmp.slice(threshold).trimStart()
      const restArray = this.split(rest, threshold)
      return [firstPart, ...restArray]
    }
  }

  send(message: string): Promise<void> {
    if (this.messageInput === null) {
      this.setup()
      if (this.messageInput === null) {
        console.error("😭 Please open the chat panel.")
        return Promise.reject()
      }
    }

    const messageInput = this.messageInput
    const messages = this.split(message)

    return messages.reduce((promise, message) => {
      return promise.then(() => {
        messageInput.value = message

        // イベントをトリガーして入力内容を反映
        const inputEvent = new Event("input", { bubbles: true })
        messageInput.dispatchEvent(inputEvent)

        this.sendButton?.click()
        return sleep(0.1)
      })
    }, Promise.resolve())
  }
}
