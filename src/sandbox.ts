import { ActionContext, Actions, Responses } from "./backgroundInterface"

declare global {
  interface Window {
    Module: any
  }
}

console.log("hello sandbox: window.crossOriginIsolated", window.crossOriginIsolated)

const Module = window.Module

const MODEL_PATH = "whisper.bin"

const whisper: {
  module: any | null
  instance: any | null
} = {
  module: null,
  instance: null
}

const behavior: {
  [key in keyof ActionContext]: (args: any) => Promise<Responses>
} = {
  [Actions.keys.setupWhispter]: () => {
    console.log("setupWhispter", Module)
    try {
      whisper.module = Module()
      return Promise.resolve(Responses.setupWhispter({ isSuccess: true }))
    } catch (error) {
      console.error("setupWhispter", error)
      return Promise.resolve(Responses.setupWhispter({ isSuccess: false }))
    }
  },
  [Actions.keys.setModel]: ({ model }: { model: Uint8Array }) => {
    console.log("setModel")
    return new Promise((resolve, reject) => {
      try {
        whisper.module.FS_unlink(MODEL_PATH)
        console.log('setupModel: unlink "' + MODEL_PATH)
      } catch (err) {
        console.log('setupModel: failed to unlink "' + MODEL_PATH + '": ', err)
      }

      try {
        whisper.module.FS_createDataFile("/", MODEL_PATH, model, true, true)

        setTimeout(() => {
          const instance = whisper.module.init(MODEL_PATH)
          console.log("js: whisper initialized: ", whisper)
          whisper.instance = instance // 0, 1
          resolve(Responses.setModel({ isSuccess: true }))
        }, 100)
      } catch (err) {
        reject('setupModel: failed to create "' + MODEL_PATH + '": ' + err)
      }
    })
  }
}

window.addEventListener("message", (event: MessageEvent<{ id: number; action: Actions }>) => {
  const { id, action } = event.data
  console.log("message", action)
  const { case: _case, ...context } = action
  behavior[_case](context).then((response) => {
    window.parent.postMessage({ id, response }, "*")
  })
})
