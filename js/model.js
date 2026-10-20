// 純資料邏輯：預設值、資料清理、計時運算、格式化。
// 唔依賴 Firebase，Overlay、控制面板同示範模式共用。

import { DEFAULT_GAME_ID } from "./firebase-config.js";

export const SIDES = ["away", "home"];
export const MAX_SCORE = 999;
export const MAX_CLOCK_MS = 60 * 60 * 1000;
export const MAX_LOGO_CHARS = 300000;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const GAME_ID = /^[A-Za-z0-9_-]{1,32}$/;

export function createDefaultGame() {
  return {
    period: 1,
    regulationPeriods: 4,
    periodLengthMs: 12 * 60 * 1000,
    otLengthMs: 5 * 60 * 1000,
    status: "live",
    visible: true,
    clock: { running: false, remainingMs: 12 * 60 * 1000 },
    teams: {
      away: { name: "客隊", short: "AWAY", color: "#1D428A", logo: "", score: 0 },
      home: { name: "主隊", short: "HOME", color: "#C8102E", logo: "", score: 0 }
    }
  };
}

function asString(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  return value.slice(0, maxLength);
}

function asNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeTeam(raw, fallback) {
  const t = raw && typeof raw === "object" ? raw : {};
  return {
    name: asString(t.name, fallback.name, 40),
    short: asString(t.short, fallback.short, 6),
    color: typeof t.color === "string" && HEX_COLOR.test(t.color) ? t.color : fallback.color,
    logo: asString(t.logo, "", MAX_LOGO_CHARS),
    score: Math.round(asNumber(t.score, 0, 0, MAX_SCORE))
  };
}

function sanitizeClock(raw, fallbackMs) {
  const c = raw && typeof raw === "object" ? raw : {};
  const running = c.running === true && typeof c.endsAt === "number" && Number.isFinite(c.endsAt);
  return {
    running,
    endsAt: running ? c.endsAt : null,
    remainingMs: asNumber(c.remainingMs, fallbackMs, 0, MAX_CLOCK_MS)
  };
}

// 將資料庫讀返嚟嘅任何內容（包括缺漏或者格式錯）轉做一定可用嘅比賽物件
export function sanitizeGame(raw) {
  const d = createDefaultGame();
  const g = raw && typeof raw === "object" ? raw : {};
  const teams = g.teams && typeof g.teams === "object" ? g.teams : {};
  const game = {
    period: Math.round(asNumber(g.period, d.period, 1, 20)),
    regulationPeriods: Math.round(asNumber(g.regulationPeriods, d.regulationPeriods, 1, 8)),
    periodLengthMs: asNumber(g.periodLengthMs, d.periodLengthMs, 1000, MAX_CLOCK_MS),
    otLengthMs: asNumber(g.otLengthMs, d.otLengthMs, 1000, MAX_CLOCK_MS),
    status: ["live", "halftime", "final"].includes(g.status) ? g.status : "live",
    visible: g.visible !== false,
    teams: {
      away: sanitizeTeam(teams.away, d.teams.away),
      home: sanitizeTeam(teams.home, d.teams.home)
    }
  };
  game.clock = sanitizeClock(g.clock, periodLengthFor(game));
  return game;
}

export function periodLengthFor(game, period = game.period) {
  return period <= game.regulationPeriods ? game.periodLengthMs : game.otLengthMs;
}

// 時鐘只儲「行緊與否 + 結束時間（伺服器時間）」或者「暫停時剩餘毫秒」，
// 所以任何裝置、任何時候重新載入，都會計出同一個剩餘時間，唔會走時。
export function clockRemaining(clock, serverNow) {
  if (!clock) return 0;
  if (clock.running && typeof clock.endsAt === "number") {
    return Math.max(0, clock.endsAt - serverNow);
  }
  return Math.max(0, clock.remainingMs || 0);
}

// NBA 格式：一分鐘以上顯示 11:59，最後一分鐘顯示 59.9
export function formatClock(ms) {
  const safe = Math.max(0, ms);
  const tenths = Math.ceil(safe / 100);
  if (tenths >= 600) {
    const totalSeconds = Math.ceil(safe / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return (tenths / 10).toFixed(1);
}

export function periodLabel(period, regulationPeriods = 4) {
  if (period <= regulationPeriods) return `Q${period}`;
  const ot = period - regulationPeriods;
  return ot === 1 ? "OT" : `${ot}OT`;
}

export function periodLabelZh(period, regulationPeriods = 4) {
  if (period <= regulationPeriods) return `第 ${period} 節`;
  const ot = period - regulationPeriods;
  return ot === 1 ? "加時" : `第 ${ot} 次加時`;
}

// 接受 "12:00"、"5:30"、"1:02.5"、"45.2"、"45"；格式錯回傳 null
export function parseClockInput(text) {
  const s = String(text || "").trim();
  const m = s.match(/^(?:(\d{1,2}):)?(\d{1,2})(?:\.(\d))?$/);
  if (!m) return null;
  const minutes = m[1] ? Number(m[1]) : 0;
  const seconds = Number(m[2]);
  const tenths = m[3] ? Number(m[3]) : 0;
  if (m[1] && seconds > 59) return null;
  const ms = minutes * 60000 + seconds * 1000 + tenths * 100;
  return ms <= MAX_CLOCK_MS ? ms : null;
}

// 按背景色揀黑字定白字，確保直播畫面睇得清
export function readableTextColor(hex) {
  if (!HEX_COLOR.test(hex)) return "#ffffff";
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return lum > 0.45 ? "#111111" : "#ffffff";
}

export function initials(team) {
  const src = (team.short || team.name || "?").trim();
  return src.slice(0, 3).toUpperCase();
}

export function cleanGameId(value) {
  return typeof value === "string" && GAME_ID.test(value) ? value : DEFAULT_GAME_ID;
}

export function isValidLogoUrl(value) {
  if (value === "") return true;
  if (value.length > MAX_LOGO_CHARS) return false;
  return (
    /^https?:\/\/\S+$/i.test(value) ||
    /^data:image\/[a-z+.-]+;base64,/i.test(value) ||
    /^logos\/[A-Za-z0-9_-]+\.(png|svg|webp)$/.test(value)
  );
}
