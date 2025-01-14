<script setup lang="ts">
import { AIInfo, AIs } from "./adviser"
import { AdviserStatus, AiSettingStatus, Usecases } from "./behavior"
import { ApiKeys, AiSettings, VocativeSettings } from "./dataStore"
import { Actions, Constants, Pages } from "./presenter"
import { DEFAULT_VOCATIVE_SETTINGS } from "./stt"
import { Empty, SwiftEnum, SwiftEnumCases } from "./enum"
import { inject, reactive, ref, watch } from "vue"
import { VForm } from "vuetify/components"

type BalloonContext = {
  none: Empty
  settingIncomplete: Empty
  changeSettings: Empty
  changeAiSettings: Empty
  changeVocativeSettings: Empty
  message: { message: string }
}

const Balloon = new SwiftEnum<BalloonContext>()
type Balloon = SwiftEnumCases<BalloonContext>

const state = reactive<{
  balloon: Balloon
  aiToUse: AIs | null
  apiKeys: ApiKeys
  name: string
  words: string[]
  lang: string
  newWord: string
}>({
  balloon: Balloon.none(),
  aiToUse: null,
  apiKeys: {
    gemini: null,
    openai: null,
    claude: null
  },
  name: DEFAULT_VOCATIVE_SETTINGS.name,
  words: DEFAULT_VOCATIVE_SETTINGS.words,
  lang: DEFAULT_VOCATIVE_SETTINGS.lang,
  newWord: ""
})

const actions = inject<Actions>(Constants.ACTIONS)!
const {
  case: page,
  aiSettingStatus,
  vocativeSettings,
  adviserStatus
} = inject<Pages>(Constants.PAGE_CONTEXT)!

const isPreMeetig = page === Pages.keys.preMeeting

let prevAiToUse: AIs | null = null
let savedApiKeys: ApiKeys = {
  gemini: null,
  openai: null,
  claude: null
}

state.name = vocativeSettings.name
state.words = vocativeSettings.words
state.lang = vocativeSettings.lang

if (aiSettingStatus.case === AiSettingStatus.keys.keysSet) {
  state.aiToUse = aiSettingStatus.aiToUse
  state.apiKeys = { ...aiSettingStatus.apiKeys }
  savedApiKeys = { ...aiSettingStatus.apiKeys }
  if (isPreMeetig) {
    state.balloon = Balloon.message({ message: "準備は万端、ミーティングが楽しみです😃" })
  } else {
    state.balloon = Balloon.message({
      message: `ご用の時は『${vocativeSettings.name}』とお呼びください😌`
    })
  }
} else {
  if (isPreMeetig) {
    state.balloon = Balloon.settingIncomplete()
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

watch(adviserStatus, (newValue) => {
  switch (newValue.case) {
    case AdviserStatus.keys.unavailable: {
      state.balloon = Balloon.message({ message: "APIキーがないのでまだお手伝いできません😣" })
      break
    }
    case AdviserStatus.keys.invalidApiKey: {
      state.balloon = Balloon.message({ message: "どうやら APIキーが正しくないようです😣" })
      break
    }
    case AdviserStatus.keys.hasProblem: {
      state.balloon = Balloon.message({ message: "生成AIの利用にエラーが起きています😣" })
      break
    }
    default: {
      state.balloon = Balloon.none()
      break
    }
  }
})

const imgUrl =
  import.meta.env.MODE === "development"
    ? "images/metis.svg"
    : chrome.runtime.getURL("images/metis.svg")

const onClickClose = () => {
  state.aiToUse = prevAiToUse
  state.balloon = Balloon.none()
}

const onClickMetis = () => {
  actions
    .dispatch(Usecases.openSettings())
    .then(([vocativeSettings, aiSettings]: [VocativeSettings, AiSettings]) => {
      state.name = vocativeSettings.name
      state.words = vocativeSettings.words
      state.lang = vocativeSettings.lang
      state.apiKeys = { ...aiSettings.apiKeys }
      savedApiKeys = { ...aiSettings.apiKeys }
      prevAiToUse = state.aiToUse
      state.aiToUse = null
      state.balloon = Balloon.changeSettings()
    })
    .catch((_) => {
      state.balloon = Balloon.changeSettings()
    })
}

const apiKeyValidators = [
  (v: string | null) => !!v || "APIキーを入力してください",
  (v: string | null) => v !== "" || "APIキーを入力してください"
]

const nameValidators = [
  (v: string | null) => !!v || "名前を入力してください",
  (v: string | null) => v !== "" || "名前を入力してください"
]

const updateFirstTag = () => {
  if (state.name != "") {
    state.words.splice(0, 1, state.name)
  }
}

const addTag = (event: KeyboardEvent) => {
  if (event.isComposing || event.key === "Process") {
    return // ignore while Japanese input
  }
  const newTag = state.newWord.trim()
  if (newTag) {
    if (!state.words.includes(newTag)) {
      state.words.push(newTag)
    }
    state.newWord = ""
  }
}

const removeTag = (index: number) => {
  state.words.splice(index, 1)
}

const apiForm = ref<InstanceType<typeof VForm> | null>(null)
const onClickAiSettingDone = () => {
  return apiForm.value?.validate().then((result) => {
    if (!result.valid) {
      return
    }
    actions
      .dispatch(
        Usecases.setupAiSettings({ settings: { aiToUse: state.aiToUse!, apiKeys: state.apiKeys } })
      )
      .then(() => {
        state.balloon = Balloon.message({ message: "APIキーを登録しました！" })
      })
  })
}

const vocativeForm = ref<InstanceType<typeof VForm> | null>(null)
const onClickVocativeSettingDone = () => {
  return vocativeForm.value?.validate().then((result) => {
    if (!result.valid) {
      return
    }
    actions
      .dispatch(
        Usecases.setupVocativeSettings({
          settings: {
            name: state.name,
            words: Array.from(state.words), // Convert to Array because Proxy(Array) will be saved as Object
            lang: state.lang
          }
        })
      )
      .then(() => {
        state.balloon = Balloon.message({ message: "呼びかけ設定を更新しました！" })
      })
  })
}
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
      adviserStatus.case == AdviserStatus.keys.thinking || state.balloon.case !== Balloon.keys.none
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
            v-if="state.balloon.case === Balloon.keys.settingIncomplete && state.aiToUse === null"
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
          <template v-else-if="state.balloon.case === Balloon.keys.changeSettings">
            <v-card variant="text">
              <v-card-text> 設定を変更しますか？ </v-card-text>
              <v-list density="compact">
                <v-list-item
                  variant="text"
                  value="ai"
                  rounded="xl"
                  @click="state.balloon = Balloon.changeAiSettings()"
                  >AIの設定を変更</v-list-item
                >
                <v-list-item
                  variant="text"
                  value="vocative"
                  rounded="xl"
                  @click="state.balloon = Balloon.changeVocativeSettings()"
                  >呼びかけ設定を変更</v-list-item
                >
              </v-list>
              <template v-slot:actions>
                <v-spacer></v-spacer>
                <v-btn rounded="xl" variant="text" @click="onClickClose">しない</v-btn>
              </template>
            </v-card>
          </template>
          <template
            v-else-if="
              state.balloon.case === Balloon.keys.changeAiSettings && state.aiToUse === null
            "
          >
            <v-card variant="text">
              <v-card-text> 設定を変更しますか？</v-card-text>
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
          <template v-else-if="state.balloon.case === Balloon.keys.changeVocativeSettings">
            <v-form ref="vocativeForm" @submit.prevent="onClickVocativeSettingDone">
              <v-card variant="text">
                <v-card-text> 設定を変更しますか？</v-card-text>
                <v-text-field
                  v-model="state.name"
                  :rules="nameValidators"
                  label="アドバイザーの名前"
                  density="compact"
                  @change="updateFirstTag"
                ></v-text-field>
                <v-chip-group column>
                  <v-chip
                    v-for="(tag, index) in state.words"
                    :key="index"
                    size="small"
                    :closable="index !== 0"
                    @click:close="removeTag(index)"
                  >
                    {{ tag }}
                  </v-chip>
                </v-chip-group>
                <v-text-field
                  v-model="state.newWord"
                  label="呼びかけワードを入力"
                  placeholder="スペースキーで追加"
                  density="compact"
                  hide-details
                  @keydown.space.prevent="addTag"
                  @keydown.enter.prevent="addTag"
                >
                </v-text-field>
                <template v-slot:actions>
                  <v-spacer></v-spacer>
                  <v-btn rounded="xl" variant="text" @click="onClickClose">やめる</v-btn>
                  <v-btn rounded="xl" variant="flat" color="blue-darken-3" type="submit"
                    >登録</v-btn
                  >
                </template>
              </v-card>
            </v-form>
          </template>
          <template
            v-else-if="
              state.balloon.case === Balloon.keys.settingIncomplete ||
              state.balloon.case === Balloon.keys.changeAiSettings
            "
          >
            <v-form ref="apiForm" @submit.prevent="onClickAiSettingDone">
              <v-card variant="text">
                <v-card-text> APIキーを教えてください </v-card-text>
                <v-text-field
                  v-model="state.apiKeys[state.aiToUse!]"
                  :rules="apiKeyValidators"
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
          <template v-else-if="state.balloon.case === Balloon.keys.message">
            {{ state.balloon.message }}<br />
          </template>
          <template v-else-if="adviserStatus.case === AdviserStatus.keys.thinking">
            考え中...<br />
            『{{ adviserStatus.question }}』<br />
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

.v-list {
  background-color: transparent;
  overflow: hidden;
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
  max-height: 500px;
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
  max-height: 500px;
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
