<script setup lang="ts">
import typescriptLogo from "./typescript.svg"
import viteLogo from "/vite.svg"
import { Behavior, MeetStatus, Usecases } from "./behavior"
import { STTs } from "./stt"
import { onMounted } from "vue"

const behavior = new Behavior()
onMounted(() => {
  behavior.run(() => {
    behavior.notify(MeetStatus.ready)
  })
})

const onChange = (event: Event) => {
  console.log("onChange")
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file === undefined) {
    return
  }
  behavior.dispatch(
    Usecases.setupSttSettings({ settings: { sttToUse: STTs.whisperCpp, model: file } })
  )
}

const onClickForceStop = () => {
  console.log("onClickForceStop")
  behavior.dispatch(Usecases.forceStop())
}
</script>

<template>
  <div data-meeting-code="dummy">
    <a href="https://vite.dev" target="_blank">
      <img :src="viteLogo" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img :src="typescriptLogo" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
  </div>
  <input type="file" id="whisper-file" name="file" @change="onChange" />
  <textarea id="output" rows="20"></textarea>
  <button @click="onClickForceStop">forceStop</button>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

#output {
  width: 100%;
  height: 100%;
  margin: 0 auto;
  margin-top: 10px;
  border-left: 0px;
  border-right: 0px;
  padding-left: 0px;
  padding-right: 0px;
  display: block;
  background-color: black;
  color: white;
  font-size: 10px;
  font-family: "Lucida Console", Monaco, monospace;
  outline: none;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: scroll;
}
</style>
