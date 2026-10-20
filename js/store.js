// Firebase Realtime Database 存取層。
// 所有寫入都經呢度：時鐘同比分用 transaction，兩部裝置同時撳都唔會互相覆蓋。

import { initializeApp } from "./vendor/firebase/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
  update,
  serverTimestamp
} from "./vendor/firebase/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  createDefaultGame,
  sanitizeGame,
  clockRemaining,
  periodLengthFor,
  MAX_CLOCK_MS,
  MAX_SCORE
} from "./model.js";

const REQUIRED_KEYS = ["apiKey", "databaseURL", "projectId", "appId"];

export function isConfigured() {
  return REQUIRED_KEYS.every(
    (k) => typeof firebaseConfig[k] === "string" && firebaseConfig[k].trim() !== ""
  );
}

let app = null;

export function getFirebaseApp() {
  if (!isConfigured()) {
    throw new Error("Firebase 未設定：請先填好 js/firebase-config.js");
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function describeError(err) {
  const text = `${err?.code || ""} ${err?.message || err || ""}`.toLowerCase();
  if (text.includes("permission")) {
    return "冇寫入權限：請確認已登入，並且 Rules 入面嘅 email 同你登入嘅一樣";
  }
  if (text.includes("disconnect") || text.includes("network") || text.includes("offline")) {
    return "網絡中斷，請等連線恢復再試";
  }
  return `操作失敗：${err?.message || err}`;
}

export function createStore(gameId) {
  const db = getDatabase(getFirebaseApp());
  const basePath = `games/${gameId}`;
  const gameRef = ref(db, basePath);
  const clockRef = ref(db, `${basePath}/clock`);
  const unsubscribers = [];
  let serverOffset = 0;
  let current = null;

  unsubscribers.push(
    onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
      serverOffset = Number(snap.val()) || 0;
    })
  );

  const serverNow = () => Date.now() + serverOffset;

  function onGame(callback, onError) {
    const unsub = onValue(
      gameRef,
      (snap) => {
        const exists = snap.exists();
        current = exists ? sanitizeGame(snap.val()) : null;
        callback(current, exists);
      },
      (err) => onError?.(err)
    );
    unsubscribers.push(unsub);
    return unsub;
  }

  function onConnection(callback) {
    const unsub = onValue(ref(db, ".info/connected"), (snap) => callback(snap.val() === true));
    unsubscribers.push(unsub);
    return unsub;
  }

  // 比賽未存在先建立；已存在就乜都唔改
  async function ensureGame() {
    const result = await runTransaction(gameRef, (existing) => {
      if (existing !== null) return undefined;
      return { ...createDefaultGame(), updatedAt: Date.now() };
    });
    return result.committed;
  }

  function currentGame() {
    return current || sanitizeGame(null);
  }

  // 時鐘 transaction：fn 收到清理過嘅時鐘同伺服器時間，回傳新時鐘，或者 undefined 代表唔使改
  async function clockTransaction(fn) {
    const result = await runTransaction(clockRef, (raw) => {
      const clock = sanitizeGame({ ...currentGame(), clock: raw }).clock;
      const next = fn(clock, serverNow());
      if (next === undefined) return undefined;
      return next.running
        ? { running: true, endsAt: Math.round(next.endsAt), remainingMs: Math.round(next.remainingMs) }
        : { running: false, remainingMs: Math.round(next.remainingMs) };
    });
    return result.committed;
  }

  const clock = {
    start: () =>
      clockTransaction((c, now) => {
        if (c.running || c.remainingMs <= 0) return undefined;
        return { running: true, endsAt: now + c.remainingMs, remainingMs: c.remainingMs };
      }),
    stop: () =>
      clockTransaction((c, now) => {
        if (!c.running) return undefined;
        return { running: false, remainingMs: clockRemaining(c, now) };
      }),
    toggle: () =>
      clockTransaction((c, now) => {
        if (c.running) return { running: false, remainingMs: clockRemaining(c, now) };
        if (c.remainingMs <= 0) return undefined;
        return { running: true, endsAt: now + c.remainingMs, remainingMs: c.remainingMs };
      }),
    adjust: (deltaMs) =>
      clockTransaction((c, now) => {
        const left = Math.min(MAX_CLOCK_MS, Math.max(0, clockRemaining(c, now) + deltaMs));
        return c.running
          ? { running: left > 0, endsAt: now + left, remainingMs: left }
          : { running: false, remainingMs: left };
      }),
    set: (ms) =>
      clockTransaction((c, now) => {
        const left = Math.min(MAX_CLOCK_MS, Math.max(0, ms));
        return c.running && left > 0
          ? { running: true, endsAt: now + left, remainingMs: left }
          : { running: false, remainingMs: left };
      }),
    // 夠鐘時將時鐘定格喺 0（多部裝置同時觸發都只會寫一次）
    expire: () =>
      clockTransaction((c, now) => {
        if (!c.running || c.endsAt > now) return undefined;
        return { running: false, remainingMs: 0 };
      })
  };

  function touch(patch) {
    return update(gameRef, { ...patch, updatedAt: serverTimestamp() });
  }

  async function addScore(side, delta) {
    const result = await runTransaction(ref(db, `${basePath}/teams/${side}/score`), (score) => {
      const value = typeof score === "number" ? score : 0;
      const next = Math.min(MAX_SCORE, Math.max(0, value + delta));
      return next === value ? undefined : next;
    });
    return result.committed;
  }

  function setScore(side, value) {
    const safe = Math.min(MAX_SCORE, Math.max(0, Math.round(value)));
    return touch({ [`teams/${side}/score`]: safe });
  }

  // 換節：時鐘自動停並重設為該節長度
  function setPeriod(period) {
    const game = currentGame();
    const p = Math.min(20, Math.max(1, Math.round(period)));
    return touch({
      period: p,
      status: "live",
      clock: { running: false, remainingMs: periodLengthFor(game, p) }
    });
  }

  function resetPeriodClock() {
    const game = currentGame();
    return touch({ clock: { running: false, remainingMs: periodLengthFor(game) } });
  }

  function updateTeam(side, fields) {
    const patch = {};
    for (const [key, value] of Object.entries(fields)) {
      patch[`teams/${side}/${key}`] = value;
    }
    return touch(patch);
  }

  function updateSettings(fields) {
    return touch(fields);
  }

  // 重新開始比賽：保留隊名、顏色、隊徽同時間設定
  function resetGame() {
    const game = currentGame();
    return touch({
      period: 1,
      status: "live",
      clock: { running: false, remainingMs: periodLengthFor(game, 1) },
      "teams/away/score": 0,
      "teams/home/score": 0
    });
  }

  // 全部還原：球隊、時間設定、比分、節數全部變返預設值
  function resetAll() {
    const d = createDefaultGame();
    return touch({
      period: d.period,
      regulationPeriods: d.regulationPeriods,
      periodLengthMs: d.periodLengthMs,
      otLengthMs: d.otLengthMs,
      status: d.status,
      visible: d.visible,
      clock: d.clock,
      teams: d.teams
    });
  }

  // 主客隊對調（隊名、顏色、隊徽、比分一齊換）
  function swapTeams() {
    const game = currentGame();
    return touch({ "teams/away": game.teams.home, "teams/home": game.teams.away });
  }

  function dispose() {
    unsubscribers.splice(0).forEach((fn) => fn());
  }

  return {
    serverNow,
    onGame,
    onConnection,
    ensureGame,
    clock,
    addScore,
    setScore,
    setPeriod,
    resetPeriodClock,
    updateTeam,
    updateSettings,
    resetGame,
    resetAll,
    swapTeams,
    dispose
  };
}
