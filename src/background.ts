/**
 * background スクリプトは Service Worker なので import()（動的インポート）は制約によって使用不可
 * "background" : {
 *    "service_worker" : "background.js",
 *    "type": "module"  // <--- ES Modules として読み込む ---> import
 * },
 * 付けない場合、 importScripts で読み込む
 */
import { ActionContext, Actions, Responses } from "./backgroundInterface"
import Module from "./libmain.js"

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
    console.log("setupWhispter")
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

chrome.runtime.onMessage.addListener(({ action }: { action: Actions }, _sender, sendResponse) => {
  console.log("message", action)
  const { case: _case, ...context } = action
  behavior[_case](context).then((response) => {
    sendResponse(response)
  })
  // 非同期処理からsendResponseするためには true が必要
  return true
})
