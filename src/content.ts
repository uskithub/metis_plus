import { Behavior, MeetStatus } from "./behavior"

let meetStatus: MeetStatus = MeetStatus.initilizing
const targetNode = document.body

const behavior = new Behavior()

const observer = new MutationObserver((mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") return

    // <video> の個数をカウント
    const numOfVideoTags = targetNode.querySelectorAll("video").length

    if (meetStatus === MeetStatus.initilizing && numOfVideoTags > 0) {
      meetStatus = MeetStatus.ready
      behavior.notify(meetStatus)
    } else if (meetStatus === MeetStatus.ready && numOfVideoTags < 1) {
      meetStatus = MeetStatus.connecting
      behavior.notify(meetStatus)
    } else if (meetStatus === MeetStatus.connecting && numOfVideoTags > 0) {
      meetStatus = MeetStatus.meeting
      behavior.notify(meetStatus)
    } else if (meetStatus === MeetStatus.meeting && numOfVideoTags < 1) {
      meetStatus = MeetStatus.terminated
      behavior.notify(meetStatus)
      observer.disconnect()
    }
  }
})

behavior.run(() => {
  observer.observe(targetNode, {
    childList: true,
    subtree: true
  })
})
