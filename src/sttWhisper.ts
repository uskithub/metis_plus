import { Actions } from "./backgroundInterface"
import { Sandbox } from "./sandboxClient"

declare global {
  interface Window {
    Module: any
  }
}

let Module: any = {}

type Observer<T> = (data: T) => void

const WhisperStatus = {
  notReady: "notReady",
  runtimeInitialized: "runtimeInitialized",
  modelInitialized: "modelInitialized"
} as const

type WhisperStatus = (typeof WhisperStatus)[keyof typeof WhisperStatus]

const indexedDB = window.indexedDB
const DB_VERSION = 1
const DB_NAME = "whisper.ggerganov.com"
const STORE_NAME = "models"

const MODEL_PATH = "whisper.bin"
export class SttWhisper {
  private status: WhisperStatus = WhisperStatus.notReady
  private whisper: any | null = null
  private observers: Observer<string>[] = []
  private sandbox: Sandbox | null = null

  constructor() {}

  setup(): Promise<void> {
    return Promise.resolve()
      .then(() => {
        if (import.meta.env.MODE === "development") {
          return new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "/libmain.js"
            script.type = "module"
            script.onload = () => resolve()
            script.onerror = () => reject(new Error("Failed to load script: libmain.js"))
            document.head.appendChild(script)
          })
            .then(() => {
              console.log("setup: libmain module loaded")
              return (window as any).Module()
            })
            .then((module) => {
              Module = module
            })
        } else {
          // sandbox
          // const sandbox = new Sandbox()
          // this.sandbox = sandbox
          // return sandbox
          //   .setup()
          //   .then((s) => s.sendMessage(Actions.setupWhispter()))
          //   .then((response) => {
          //     console.log("response", response)
          //     if (response && response.isSuccess) {
          //       console.log("setup: libmain module loaded")
          //       return
          //     } else {
          //       throw new Error("Failed to get response from background.js")
          //     }
          //   })
          // backgroundスクリプト
          return new Promise<void>((resolve, reject) => {
            chrome.runtime.sendMessage({ action: Actions.setupWhispter() }, (response) => {
              if (response && response.isSuccess) {
                console.log("setup: libmain module loaded")
                resolve()
              } else {
                reject("Failed to get response from background.js")
              }
            })
          })
        }
      })
      .catch((err) => {
        console.error("😇 fatal: Failed to load libmain module: ", err)
      })
  }

  private fetchRemote(url: string, cbProgress?: (p: number) => void): Promise<Uint8Array> {
    console.log("fetchRemote: downloading with fetch() from", url)

    return fetch(url, { method: "GET" })
      .then((response) => {
        if (!response.ok) {
          return Promise.reject("fetchRemote: failed to fetch " + url)
        }

        const contentLength = response.headers.get("content-length")
        if (contentLength === null) {
          return Promise.reject("fetchRemote: failed to get content-length")
        }
        const total = parseInt(contentLength, 10)

        if (response.body === null) {
          return Promise.reject("fetchRemote: failed to get response body")
        }

        console.log("content-length:", contentLength)

        const reader = response.body.getReader()

        let receivedLength = 0
        let progressLast = -1

        return new ReadableStream<Uint8Array>({
          start(controller) {
            const recursive = (): Promise<void> => {
              return reader.read().then(({ done, value }: ReadableStreamReadResult<Uint8Array>) => {
                if (done) {
                  return controller.close()
                }
                controller.enqueue(value)
                receivedLength += value.length
                if (contentLength && cbProgress) {
                  cbProgress(receivedLength / total)

                  const progressCur = Math.round((receivedLength / total) * 10)
                  if (progressCur != progressLast) {
                    console.log("fetchRemote: fetching " + 10 * progressCur + "% ...")
                    progressLast = progressCur
                  }
                }
                return recursive()
              })
            }
            return recursive()
          }
        })
      })
      .then((stream) => new Response(stream))
      .then((response) => response.arrayBuffer())
      .then((buf) => new Uint8Array(buf))
  }

  loadRemote(
    url: string,
    size_mb: number,
    cbProgress?: (p: number) => void,
    cbCancel?: () => void
  ) {
    if (!navigator.storage || !navigator.storage.estimate) {
      console.log("loadRemote: navigator.storage.estimate() is not supported")
    } else {
      // query the storage quota and print it
      navigator.storage.estimate().then((estimate) => {
        console.log("loadRemote: storage quota: " + estimate.quota + " bytes")
        console.log("loadRemote: storage usage: " + estimate.usage + " bytes")
      })
    }

    // check if the data is already in the IndexedDB
    const openRq = indexedDB.open(DB_NAME, DB_VERSION)

    openRq.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      if (event.target === null) {
        return
      }
      const db = (event.target as IDBRequest<IDBDatabase>).result
      if (db.version === DB_VERSION) {
        db.createObjectStore(STORE_NAME, { autoIncrement: false })
        console.log("loadRemote: created IndexedDB " + db.name + " version " + db.version)
      } else {
        if (event.currentTarget === null) {
          return
        }
        // clear the database
        const tx = (event.currentTarget as IDBRequest).transaction
        if (tx === null) {
          return
        }
        const os = tx.objectStore(STORE_NAME)
        os.clear()
        console.log("loadRemote: cleared IndexedDB " + db.name + " version " + db.version)
      }
    }

    openRq.onsuccess = (event) => {
      const db = (event.target as IDBRequest<IDBDatabase>).result
      const tx = db.transaction([STORE_NAME], "readonly")
      const os = tx.objectStore(STORE_NAME)
      const getRq = os.get(url) as IDBRequest<Uint8Array>

      console.log("loadRemote: checking if the data is in the IndexedDB")

      getRq.onsuccess = (_) => {
        if (getRq.result) {
          console.log('loadRemote: "' + url + '" is already in the IndexedDB')
          this.setupModel(getRq.result)
          return
        }
        // data is not in the IndexedDB
        console.log('loadRemote: "' + url + '" is not in the IndexedDB')

        // alert and ask the user to confirm
        if (
          !confirm(
            "You are about to download " +
              size_mb +
              " MB of data.\n" +
              "The model data will be cached in the browser for future use.\n\n" +
              "Press OK to continue."
          )
        ) {
          return cbCancel?.()
        }

        return this.fetchRemote(
          url,
          cbProgress
            ? cbProgress
            : (p) => {
                console.log("progress: " + Math.round(100 * p) + "%")
              }
        )
          .then((data) => {
            this.setupModel(data)

            // store the data in the IndexedDB
            const _openRq = indexedDB.open(DB_NAME, DB_VERSION)
            _openRq.onsuccess = (event) => {
              const db = (event.target as IDBRequest<IDBDatabase>).result
              const tx = db.transaction([STORE_NAME], "readwrite")
              const os = tx.objectStore(STORE_NAME)

              let _rq: IDBRequest<IDBValidKey> | null = null
              try {
                _rq = os.put(data, url)
              } catch (e) {
                console.log('loadRemote: failed to store "' + url + '" in the IndexedDB: \n' + e)
                return cbCancel?.()
              }

              _rq.onsuccess = (_) => {
                console.log('loadRemote: "' + url + '" stored in the IndexedDB')
              }

              _rq.onerror = (_) => {
                console.log('loadRemote: failed to store "' + url + '" in the IndexedDB')
                cbCancel?.()
              }
            }
          })
          .catch((err) => {
            console.log('loadRemote: failed to fetch "' + url + '": ' + err)
            cbCancel?.()
          })
      }

      getRq.onerror = (_) => {
        console.log("loadRemote: failed to get data from the IndexedDB")
        cbCancel?.()
      }
    }

    openRq.onerror = (_) => {
      console.log("loadRemote: failed to open IndexedDB")
      cbCancel?.()
    }

    openRq.onblocked = (_) => {
      console.log("loadRemote: failed to open IndexedDB: blocked")
      cbCancel?.()
    }

    // openRq.onabort = (_) => {
    //   console.log('loadRemote: failed to open IndexedDB: abort')
    //   cbCancel()
    // }
  }

  setupModel(buf: Uint8Array) {
    console.log("setupModel")
    if (import.meta.env.MODE === "development") {
      try {
        Module.FS_unlink(MODEL_PATH)
        console.log('setupModel: unlink "' + MODEL_PATH)
      } catch (err) {
        console.log('setupModel: failed to unlink "' + MODEL_PATH + '": ', err)
      }

      try {
        Module.FS_createDataFile("/", MODEL_PATH, buf, true, true)

        setTimeout(() => {
          const whisper = Module.init(MODEL_PATH)
          console.log("js: whisper initialized: ", whisper)
          this.whisper = whisper // 0, 1
          this.status = WhisperStatus.modelInitialized
        }, 100)
      } catch (err) {
        console.log('setupModel: failed to create "' + MODEL_PATH + '": ', err)
      }
    } else {
      // sandbox
      // return this.sandbox?.sendMessage(Actions.setModel({ model: buf })).then((response) => {
      //   if (response && response.isSuccess) {
      //     console.log("setupModel: model set")
      //   } else {
      //     throw new Error("Failed to get response from background.js")
      //   }
      // backgroundスクリプト
      return new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({ action: Actions.setModel({ model: buf }) }, (response) => {
          if (response && response.isSuccess) {
            console.log("setupModel: model set")
            resolve()
          } else {
            reject("Failed to get response from background.js")
          }
        })
      })
    }
  }

  subscribe(observer: Observer<string>): void {
    this.observers.push(observer)
  }

  transcribe(audio: Float32Array, lang: string) {
    if (this.status !== WhisperStatus.modelInitialized) {
      console.error("😇 fatal: Whisper is not ready")
      return
    }

    const isTranslate = false
    const nthreads = 8

    if (this.whisper === null) {
      const whisper = Module.init(MODEL_PATH)
      console.log("js: whisper initialized: ", whisper)
      this.whisper = whisper
    }

    if (!this.whisper) {
      console.error("😇 fatal: Failed to initialize whisper")
      this.whisper = null
    }

    setTimeout(() => {
      try {
        const ret = Module.full_default(this.whisper, audio, lang, nthreads, isTranslate)
        console.log("js: full_default returned: " + ret)
        // if (ret) {
        //   console.log("js: whisper returned: " + ret)
        // }
      } catch (err) {
        console.error("😇 fatal: Failed to run whisper: ", err)
      }
    }, 100)
  }

  stop() {}
}
