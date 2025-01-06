const MeetStatus = {
  initilizing: "initilizing",
  ready: "ready",
  connecting: "connecting",
  meeting: "meeting",
  terminated: "terminated",
} as const;

type MeetStatus = (typeof MeetStatus)[keyof typeof MeetStatus];

let meetStatus: MeetStatus = MeetStatus.initilizing;

// 監視対象のノード
const targetNode = document.body;

const observer = new MutationObserver((mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") return;

    // <video> の個数をカウント
    const numOfVideoTags = targetNode.querySelectorAll("video").length;

    if (meetStatus === MeetStatus.initilizing && numOfVideoTags > 1) {
      meetStatus = MeetStatus.ready;
      console.log("Meet status changed: ", meetStatus);
    } else if (meetStatus === MeetStatus.ready && numOfVideoTags < 1) {
      meetStatus = MeetStatus.connecting;
      console.log("Meet status changed: ", meetStatus);
    } else if (meetStatus === MeetStatus.connecting && numOfVideoTags > 0) {
      meetStatus = MeetStatus.meeting;
      console.log("Meet status changed: ", meetStatus);
    } else if (meetStatus === MeetStatus.meeting && numOfVideoTags < 1) {
      meetStatus = MeetStatus.terminated;
      console.log("Meet status changed: ", meetStatus);
      observer.disconnect();
    }
  }
});

observer.observe(targetNode, {
  childList: true,
  subtree: true,
});
