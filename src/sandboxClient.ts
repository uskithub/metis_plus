import { Actions, Responses } from "./backgroundInterface"

export class Sandbox {
  private iframeContentWindow: Window | null = null
  constructor() {}

  setup(): Promise<this> {
    const sandboxUrl = chrome.runtime.getURL("sandbox.html")
    const iframe = document.createElement("iframe")
    iframe.src = sandboxUrl
    iframe.style.display = "none"

    return new Promise<this>((resolve, reject) => {
      iframe.onload = () => {
        console.log("Sandbox iframe loaded", iframe.contentWindow)

        if (iframe.contentWindow === null) {
          return reject("iframe.contentWindow is null")
        }
        this.iframeContentWindow = iframe.contentWindow
        resolve(this)
      }

      document.body.appendChild(iframe)
    })
  }

  sendMessage(action: Actions): Promise<Responses> {
    if (this.iframeContentWindow === null) {
      return Promise.reject("iframeContentWindow is null")
    }
    const iframeContentWindow = this.iframeContentWindow
    return new Promise((resolve, reject) => {
      const messageId = Date.now() + Math.random()
      const payload = { id: messageId, action }

      const handleMessage = (event: MessageEvent<{ id: number; response: Responses }>) => {
        const { data } = event
        if (data.id === messageId) {
          window.removeEventListener("message", handleMessage)
          resolve(data.response)
        }
      }

      window.addEventListener("message", handleMessage)
      console.log("Sending message to sandbox", payload)
      iframeContentWindow.postMessage(payload, "*")

      setTimeout(() => {
        window.removeEventListener("message", handleMessage)
        reject(new Error("No response received"))
      }, 3 * 1000)
    })
  }
}
