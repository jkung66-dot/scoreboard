// Firebase 連線設定
// 喺 Firebase Console → 專案設定（齒輪）→ 一般 → 「你的應用程式」→ SDK 設定與配置 → 選「設定」
// 將嗰段 firebaseConfig 入面嘅值逐個貼落嚟（databaseURL 一定要有）。
// 呢啲值唔係密碼，放喺公開網頁係正常做法；真正嘅保護靠 database.rules.json。

export const firebaseConfig = {
  apiKey: "AIzaSyAnjA6n1qFOGzkcJHUJmFcISXS7S1YXQMQ",
  authDomain: "score-board-4cb88.firebaseapp.com",
  databaseURL: "https://score-board-4cb88-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "score-board-4cb88",
  appId: "1:184341235981:web:979e866b0c5fab0cbfc844"
};

// 冇喺網址指定 ?game=xxx 時用嘅比賽 ID
export const DEFAULT_GAME_ID = "main";
