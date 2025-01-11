<script setup lang="ts">
import { AIInfo, AIs } from "./adviser"
import { AdviserStatus, SettingStatus, Usecases } from "./behavior"
import { ApiKeys, Settings } from "./dataStore"
import { Actions, Constants, Pages } from "./presenter"
import { inject, reactive, ref, watch } from "vue"
import { VForm } from "vuetify/components"

const BalloonType = {
  none: "none",
  settingIncomplete: "settingIncomplete",
  ready: "ready",
  apiKeyRegistrationSuccess: "apiKeyRegistrationSuccess",
  changeSettings: "changeSettings"
} as const

type BalloonType = (typeof BalloonType)[keyof typeof BalloonType]

const state = reactive<{
  balloonType: BalloonType
  aiToUse: AIs | null
  apiKeys: ApiKeys
}>({
  balloonType: BalloonType.none,
  aiToUse: null,
  apiKeys: {
    gemini: null,
    openai: null,
    claude: null
  }
})

const actions = inject<Actions>(Constants.ACTIONS)!
const { case: page, settingStatus, adviserStatus } = inject<Pages>(Constants.PAGE_CONTEXT)!

const isPreMeetig = page === Pages.keys.preMeeting

let prevAiToUse: AIs | null = null
let savedApiKeys: ApiKeys = {
  gemini: null,
  openai: null,
  claude: null
}

if (settingStatus.case === SettingStatus.keys.keysSet) {
  state.aiToUse = settingStatus.aiToUse
  state.apiKeys = { ...settingStatus.apiKeys }
  savedApiKeys = { ...settingStatus.apiKeys }
  if (isPreMeetig) {
    state.balloonType = BalloonType.ready
  }
} else {
  if (isPreMeetig) {
    state.balloonType = BalloonType.settingIncomplete
  }
}

watch(
  () => state.aiToUse,
  (newValue, oldValue) => {
    if (oldValue !== newValue && newValue !== null) {
      state.apiKeys[newValue] = savedApiKeys[newValue]
    }
  }
)

watch(adviserStatus, () => {
  state.balloonType = BalloonType.none
})

const imgUrl =
  import.meta.env.MODE === "development"
    ? "images/metis.svg"
    : chrome.runtime.getURL("images/metis.svg")

const onClickClose = () => {
  state.aiToUse = prevAiToUse
  state.balloonType = BalloonType.none
}

const form = ref<InstanceType<typeof VForm> | null>(null)
const onClickSettingDone = () => {
  return form.value?.validate().then((result) => {
    if (!result.valid) {
      return
    }
    actions
      .dispatch(
        Usecases.setupSettings({ settings: { aiToUse: state.aiToUse!, apiKeys: state.apiKeys } })
      )
      .then(() => {
        state.balloonType = BalloonType.apiKeyRegistrationSuccess
      })
  })
}

const onClickMetis = () => {
  actions
    .dispatch(Usecases.openSettings())
    .then((settings: Settings) => {
      state.apiKeys = { ...settings.apiKeys }
      savedApiKeys = { ...settings.apiKeys }
      prevAiToUse = state.aiToUse
      state.aiToUse = null
      state.balloonType = BalloonType.changeSettings
    })
    .catch((_) => {
      state.balloonType = BalloonType.settingIncomplete
    })
}

const validators = [
  (v: string | null) => !!v || "APIキーを入力してください",
  (v: string | null) => v !== "" || "APIキーを入力してください"
]
</script>

<template>
  <div class="metis">
    <div class="button" @click="onClickMetis">
      <i>
        <img :src="imgUrl" />
      </i>
    </div>
  </div>
  <div
    v-show="
      adviserStatus.case !== AdviserStatus.keys.idle || state.balloonType !== BalloonType.none
    "
    class="balloon"
    tabindex="0"
    role="dialog"
  >
    <div class="triangle"></div>
    <span>
      <div>
        <div id="balloon-body">
          <template
            v-if="state.balloonType === BalloonType.settingIncomplete && state.aiToUse === null"
          >
            <v-card variant="text">
              <v-card-text>
                設定を済ませましょう！<br />
                どの生成AIを使いますか？
              </v-card-text>
              <v-radio-group v-model="state.aiToUse">
                <v-radio
                  v-for="item in AIInfo"
                  :value="item.key"
                  :label="item.name"
                  :disabled="!item.isAvailable"
                ></v-radio>
              </v-radio-group>
              <template v-slot:actions>
                <v-spacer></v-spacer>
                <v-btn rounded="xl" variant="text" @click="onClickClose">後で</v-btn>
              </template>
            </v-card>
          </template>
          <template
            v-else-if="state.balloonType === BalloonType.changeSettings && state.aiToUse === null"
          >
            <v-card variant="text">
              <v-card-text> 設定を変更しますか？ </v-card-text>
              <v-radio-group v-model="state.aiToUse">
                <v-radio
                  v-for="item in AIInfo"
                  :value="item.key"
                  :label="item.name"
                  :disabled="!item.isAvailable"
                ></v-radio>
              </v-radio-group>
              <template v-slot:actions>
                <v-spacer></v-spacer>
                <v-btn rounded="xl" variant="text" @click="onClickClose">しない</v-btn>
              </template>
            </v-card>
          </template>
          <template
            v-else-if="
              state.balloonType === BalloonType.settingIncomplete ||
              state.balloonType === BalloonType.changeSettings
            "
          >
            <v-form ref="form" @submit.prevent="onClickSettingDone">
              <v-card variant="text">
                <v-card-text> APIキーを教えてください </v-card-text>
                <v-text-field
                  v-model="state.apiKeys[state.aiToUse!]"
                  :rules="validators"
                  label="APIキー"
                ></v-text-field>
                <template v-slot:actions>
                  <v-spacer></v-spacer>
                  <v-btn rounded="xl" variant="text" @click="state.aiToUse = null">戻る</v-btn>
                  <v-btn rounded="xl" variant="flat" color="blue-darken-3" type="submit"
                    >登録</v-btn
                  >
                </template>
              </v-card>
            </v-form>
          </template>
          <template v-else-if="state.balloonType === BalloonType.ready">
            準備は万端、ミーティングが楽しみです😃<br />
          </template>
          <template v-else-if="state.balloonType === BalloonType.apiKeyRegistrationSuccess">
            APIキーを登録しました！<br />
          </template>
          <template v-else-if="adviserStatus.case === AdviserStatus.keys.unavailable">
            APIキーがないのでまだお手伝いできません😣<br />
          </template>
          <template v-else-if="adviserStatus.case === AdviserStatus.keys.thinking">
            考え中...<br />
            『{{ adviserStatus.question }}』<br />
          </template>
          <template v-else-if="adviserStatus.case === AdviserStatus.keys.invalidApiKey">
            どうやら APIキーが正しくないようです😣<br />
          </template>
          <template v-else-if="adviserStatus.case === AdviserStatus.keys.hasProblem">
            生成AIの利用にエラーが起きています😣<br />
          </template>
        </div>
      </div>
    </span>
  </div>
</template>
<style>
.metis-parent {
  transition-property: top, left, right, bottom, width, height, background;
  transition-duration: 0.5s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.v-radio-group .v-input__details {
  display: none;
}
</style>
<style scoped>
.metis {
  position: absolute;
  bottom: 16px;
  right: 10px;
}

.metis > .button {
  border: 1px solid #fff;
  background-color: transparent;
  height: 3.5rem;
  width: 3.5rem;
  z-index: 1;

  align-items: center;
  border-radius: 50%;
  box-sizing: border-box;
  justify-content: center;
  transition: all 0.25s linear;

  user-select: none;
  cursor: pointer;
  outline: none;
  overflow: hidden;
  position: relative;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}

.metis > .button:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.balloon {
  position: absolute;
  bottom: 100px;
  right: 20px;
  max-width: 360px;
  max-height: 300px;
  border-radius: 1.125rem;
  transform: translateZ(0);
  background: #c2e7ff;
  border: 1px solid #c2e7ff;
  box-shadow:
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 3px 1px -2px rgba(0, 0, 0, 0.12),
    0 1px 5px 0 rgba(0, 0, 0, 0.2);
  box-sizing: content-box;
  opacity: 1;
  z-index: 2000;
}

.triangle {
  left: calc(100% - 30px);
  top: 100%;
  border: 10px solid #c2e7ff;
  border-radius: 33% 0;
  box-shadow: inherit;
  height: 0;
  position: absolute;
  transform: translateY(-50%) rotate(45deg) skew(12deg, 12deg);
  width: 0;
  z-index: -1;
}

.balloon > span {
  width: auto;
  height: auto;
  max-width: 360px;
  max-height: 300px;
  background-color: inherit;
  border-radius: inherit;
  float: left;
}

.balloon > span > div {
  padding-top: 0.75rem;
  width: 22rem;

  margin-top: 0.125rem;
  max-height: inherit;
  overflow-y: auto;
}

.balloon > span > div > div {
  padding: 0.25rem 1.25rem 0.5rem;
  font-family: "Google Sans", Roboto, Arial, sans-serif;
  font-size: 0.875rem;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.25rem;
}
</style>
