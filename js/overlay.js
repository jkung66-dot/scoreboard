// OBS 瀏覽器來源用嘅記分板畫面（只讀）。
// 網址參數：
//   ?game=main     比賽 ID（同控制面板一致）
//   &pos=bottom    bottom（預設）或 top
//   &scale=1       整體縮放，例如 0.8、1.2
//   &demo=1        示範模式，唔使 Firebase，用嚟試位置同外觀

import {
  sanitizeGame,
  createDefaultGame,
  clockRemaining,
  formatClock,
  periodLabel,
  readableTextColor,
  initials,
  cleanGameId,
  SIDES
} from "./model.js";

const params = new URLSearchParams(location.search);
const gameId = cleanGameId(params.get("game"));
const isDemo = params.get("demo") === "1";

applyLayout();

const boardEl = document.getElementById("scoreboard");
const noticeEl = document.getElementById("notice");
const view = createView(boardEl);

let game = null;
let serverNow = () => Date.now();

function applyLayout() {
  const pos = params.get("pos") === "top" ? "top" : "bottom";
  const scale = Number(params.get("scale"));
  document.body.dataset.pos = pos;
  if (Number.isFinite(scale) && scale >= 0.3 && scale <= 3) {
    document.documentElement.style.setProperty("--scale", String(scale));
  }
}

function showNotice(text) {
  noticeEl.textContent = text;
  noticeEl.hidden = !text;
}

function createView(root) {
  const teams = {};
  for (const side of SIDES) {
    const el = root.querySelector(`.team[data-side="${side}"]`);
    const img = el.querySelector("img");
    const initialsEl = el.querySelector(".initials");
    img.addEventListener("error", () => {
      img.hidden = true;
      initialsEl.hidden = false;
    });
    teams[side] = {
      el,
      img,
      initialsEl,
      abbr: el.querySelector(".abbr"),
      score: el.querySelector(".score"),
      last: { score: null, logo: null, color: null, label: null }
    };
  }
  const periodEl = root.querySelector(".period");
  const clockEl = root.querySelector(".clock");
  const infoEl = root.querySelector(".info");
  let lastClockText = null;
  let lastClockState = null;

  function renderTeam(side, team) {
    const t = teams[side];
    if (t.last.color !== team.color) {
      t.el.style.setProperty("--team", team.color);
      const textColor = readableTextColor(team.color);
      t.el.style.setProperty("--team-text", textColor);
      t.el.dataset.light = String(textColor !== "#ffffff");
      t.last.color = team.color;
    }
    const label = team.short || team.name;
    if (t.last.label !== label) {
      t.abbr.textContent = label;
      t.initialsEl.textContent = initials(team);
      t.last.label = label;
    }
    if (t.last.logo !== team.logo) {
      if (team.logo) {
        t.img.hidden = false;
        t.initialsEl.hidden = true;
        t.img.src = team.logo;
      } else {
        t.img.hidden = true;
        t.img.removeAttribute("src");
        t.initialsEl.hidden = false;
      }
      t.last.logo = team.logo;
    }
    if (t.last.score !== team.score) {
      t.score.textContent = String(team.score);
      if (t.last.score !== null && team.score > t.last.score) {
        t.el.classList.remove("bump");
        void t.el.offsetWidth; // 重新觸發動畫
        t.el.classList.add("bump");
      }
      t.last.score = team.score;
    }
  }

  function render(g) {
    boardEl.classList.toggle("is-hidden", !g.visible);
    renderTeam("away", g.teams.away);
    renderTeam("home", g.teams.home);
    infoEl.dataset.status = g.status;
    periodEl.textContent =
      g.status === "final" ? (g.period > g.regulationPeriods ? "FINAL/OT" : "FINAL")
      : g.status === "halftime" ? "HALFTIME"
      : periodLabel(g.period, g.regulationPeriods);
  }

  function renderClock(g, now) {
    const ms = clockRemaining(g.clock, now);
    const text = formatClock(ms);
    if (text !== lastClockText) {
      clockEl.textContent = text;
      lastClockText = text;
    }
    const state = ms <= 0 ? "zero" : ms < 60000 ? "last-minute" : "normal";
    const key = `${state}|${g.clock.running}`;
    if (key !== lastClockState) {
      clockEl.dataset.state = state;
      clockEl.dataset.running = String(g.clock.running);
      lastClockState = key;
    }
  }

  return { render, renderClock };
}

function tick() {
  if (game) view.renderClock(game, serverNow());
  requestAnimationFrame(tick);
}

function setGame(next) {
  game = next;
  view.render(game);
  view.renderClock(game, serverNow());
}

function startDemo() {
  const demo = createDefaultGame();
  demo.teams.away = { name: "Lakers", short: "LAL", color: "#552583", logo: "", score: 98 };
  demo.teams.home = { name: "Celtics", short: "BOS", color: "#007A33", logo: "", score: 101 };
  demo.period = 4;
  demo.clock = { running: true, endsAt: Date.now() + 75000, remainingMs: 75000 };
  setGame(sanitizeGame(demo));
  setInterval(() => {
    const side = Math.random() < 0.5 ? "away" : "home";
    const next = structuredClone(game);
    next.teams[side].score += Math.random() < 0.3 ? 3 : 2;
    if (clockRemaining(next.clock, Date.now()) <= 0) {
      next.clock = { running: true, endsAt: Date.now() + 75000, remainingMs: 75000 };
    }
    setGame(next);
  }, 4000);
}

async function startLive() {
  let store;
  try {
    const mod = await import("./store.js");
    if (!mod.isConfigured()) {
      showNotice("Firebase 未設定：請填好 js/firebase-config.js（或者加 ?demo=1 睇示範）");
      return;
    }
    store = mod.createStore(gameId);
  } catch (err) {
    showNotice(`載入失敗：${err?.message || err}`);
    return;
  }
  serverNow = store.serverNow;
  store.onGame(
    (g, exists) => {
      if (!exists) {
        showNotice(`等待控制面板建立比賽「${gameId}」…`);
        return;
      }
      showNotice("");
      setGame(g);
    },
    (err) => showNotice(`讀取失敗：${err?.message || err}`)
  );
}

requestAnimationFrame(tick);
if (isDemo) startDemo();
else startLive();
