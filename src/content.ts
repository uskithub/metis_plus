import { Stt } from "./stt";
import { Adviser } from "./adviser";

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

let stt: Stt | null = null;
const adviser = new Adviser();

const observer = new MutationObserver((mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") return;

    // <video> の個数をカウント
    const numOfVideoTags = targetNode.querySelectorAll("video").length;

    if (meetStatus === MeetStatus.initilizing && numOfVideoTags > 1) {
      meetStatus = MeetStatus.ready;
      console.log("Meet status changed: ", meetStatus);
      stt = new Stt();
      stt.subscribe((transcript) => {
        const question = `${transcript}？`;
        console.log("☆☆☆", question);
        adviser.answer(question).then((advice) => {
          console.log("★★★", advice);
        });
      });
    } else if (meetStatus === MeetStatus.ready && numOfVideoTags < 1) {
      meetStatus = MeetStatus.connecting;
      console.log("Meet status changed: ", meetStatus);
    } else if (meetStatus === MeetStatus.connecting && numOfVideoTags > 0) {
      meetStatus = MeetStatus.meeting;
      console.log("Meet status changed: ", meetStatus);
      stt?.start();
    } else if (meetStatus === MeetStatus.meeting && numOfVideoTags < 1) {
      meetStatus = MeetStatus.terminated;
      console.log("Meet status changed: ", meetStatus);
      observer.disconnect();
      stt?.stop();
      stt = null;
    }
  }
});

observer.observe(targetNode, {
  childList: true,
  subtree: true,
});
