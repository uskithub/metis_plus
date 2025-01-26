import { AdviserStatus, AiSettingStatus, Usecases } from "./behavior"
import App from "./App.vue"
import { createApp, Ref } from "vue"

// Vuetify
import "@mdi/font/css/materialdesignicons.css"
import "vuetify/styles"
import { createVuetify } from "vuetify"
import * as components from "vuetify/components"
import * as directives from "vuetify/directives"
import { SwiftEnum, SwiftEnumCases } from "./enum"
import { STTSettings, VocativeSettings } from "./dataStore"

export const Constants = {
  ACTIONS: "ACTIONS",
  PAGE_CONTEXT: "PAGE_CONTEXT",
  ADVISER_STATUS_REF: "ADVISER_STATUS_REF"
} as const

export type PageContext = {
  preMeeting: {
    aiSettingStatus: AiSettingStatus
    sttSettings: STTSettings
    vocativeSettings: VocativeSettings
    adviserStatus: Ref<AdviserStatus>
  }
  meeting: {
    aiSettingStatus: AiSettingStatus
    sttSettings: STTSettings
    vocativeSettings: VocativeSettings
    adviserStatus: Ref<AdviserStatus>
  }
}
export const Pages = new SwiftEnum<PageContext>()
export type Pages = SwiftEnumCases<PageContext>

const vuetify = createVuetify({ components, directives })

export type Actions = {
  dispatch: (usecase: Usecases) => Promise<any>
}

export class Presenter {
  constructor(private dispatch: (usecase: Usecases) => Promise<any>) {}

  setup(pages: Pages) {
    const isPreMeeting = pages.case === Pages.keys.preMeeting
    const selector = isPreMeeting ? "div[data-meeting-code]" : `div[data-priority="999"]`
    const target = document.querySelector<HTMLDivElement>(selector)
    if (target === null) {
      console.error(`😇 fatal: ${selector} not found!`)
      return
    }
    target.classList.add("metis-parent")
    const vueRoot = document.createElement("div")
    vueRoot.id = "metis-root"
    target.appendChild(vueRoot)
    const app = createApp(App)
    app.use(vuetify)
    app.provide<Actions>(Constants.ACTIONS, {
      dispatch: this.dispatch
    })
    app.provide<Pages>(Constants.PAGE_CONTEXT, pages)
    app.mount("#metis-root")

    if (import.meta.env.MODE === "production" && isPreMeeting) {
      const style = document.createElement("style")
      const baseUrl = chrome.runtime.getURL("/")
      style.textContent = `
@font-face {
  font-family: "Material Design Icons";
  src: url("${baseUrl}materialdesignicons-webfont.eot?v=7.4.47");
  src: url("${baseUrl}materialdesignicons-webfont.eot?#iefix&v=7.4.47") format("embedded-opentype"), url("${baseUrl}materialdesignicons-webfont.woff2?v=7.4.47") format("woff2"), url("${baseUrl}materialdesignicons-webfont.woff?v=7.4.47") format("woff"), url("${baseUrl}materialdesignicons-webfont.ttf?v=7.4.47") format("truetype");
  font-weight: normal;
  font-style: normal;
}
`
      document.head.appendChild(style)
    }
  }

  openChatPanel(): Promise<void> {
    const isMac = navigator.platform.toUpperCase().includes("MAC")
    const event = new KeyboardEvent("keydown", {
      key: "c",
      code: "KeyC",
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      altKey: !isMac,
      metaKey: isMac // Mac では Command を使う
    })
    document.dispatchEvent(event)
    return new Promise<void>((resolve) => {
      const timerId = setInterval(() => {
        const messageInput = document.querySelector<HTMLTextAreaElement>("textarea")
        if (messageInput) {
          clearInterval(timerId)
          resolve()
        }
      }, 100)
    })
  }
}
