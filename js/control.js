// 控制面板主程式：登入 → 訂閱比賽 → 按鈕寫入 → 本地每格更新時鐘顯示

import {
  SIDES,
  clockRemaining,
  formatClock,
  periodLabelZh,
  parseClockInput,
  readableTextColor,
  initials,
  cleanGameId,
  isValidLogoUrl
} from "./model.js";
import { isConfigured, createStore, describeError } from "./store.js";
import { toast, haptic, createWakeLock } from "./ui.js";
import { fileToLogoDataUrl } from "./image.js";
import { NBA_TEAMS, findTeam } from "./teams.js";

const params = new URLSearchParams(location.search);
const gameId = cleanGameId(params.get("game"));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const views = {
  config: $("#view-config"),
  login: $("#view-login"),
  main: $("#view-main")
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

$$(".js-game-id").forEach((el) => (el.textContent = gameId));

const state = {
  game: null,
  user: null,
  connected: false,
  permissionDenied: false,
  gameMissing: false,
  expiringFor: null
};

let store = null;

// 包住每個寫入操作：失敗會彈提示，唔會令頁面壞咗
async function run(action, successMessage) {
  try {
    await action();
    if (successMessage) toast(successMessage, "ok");
  } catch (err) {
    console.error(err);
    if (String(err?.code || err?.message || "").toLowerCase().includes("permission")) {
      state.permissionDenied = true;
      renderBanner();
    }
    toast(describeError(err), "error");
  }
}

// 第一次用：登入後如果資料庫未有呢場比賽，自動建立預設資料
function maybeEnsureGame() {
  if (store && state.user && state.connected && state.gameMissing && !state.permissionDenied) {
    run(() => store.ensureGame());
  }
}

function canWrite() {
  return Boolean(store && state.user && state.connected && state.game && !state.permissionDenied);
}

function syncWritable() {
  const enabled = canWrite();
  $$(".js-needs-write").forEach((el) => {
    el.disabled = !enabled;
  });
}

function renderBanner() {
  const banner = $("#banner");
  let text = "";
  if (state.permissionDenied) {
    text = "呢個帳戶冇寫入權限。請檢查 Firebase Rules 入面嘅 email 同你登入嘅 email 一樣。";
  } else if (!state.connected) {
    text = "連線中斷，所有按鈕暫停使用。Overlay 會繼續按最後狀態行鐘，恢復連線後自動同步。";
  } else if (!state.game) {
    text = "準備比賽資料中…";
  }
  banner.textContent = text;
  banner.hidden = !text;
}

function renderConnection() {
  const dot = $("#conn");
  dot.dataset.state = state.connected ? "online" : "offline";
  $("#conn-text").textContent = state.connected ? "已連線" : "離線";
  renderBanner();
  syncWritable();
}

// ---------- 渲染 ----------

function renderTeamCard(side, team) {
  const card = $(`.team-card[data-side="${side}"]`);
  card.style.setProperty("--team", team.color);
  card.style.setProperty("--team-text", readableTextColor(team.color));
  $(".team-name", card).textContent = team.name;
  $(".team-score", card).textContent = String(team.score);
  const img = $(".team-logo img", card);
  const ini = $(".team-logo .initials", card);
  ini.textContent = initials(team);
  if (team.logo) {
    if (img.getAttribute("src") !== team.logo) img.src = team.logo;
    img.hidden = false;
    ini.hidden = true;
  } else {
    img.hidden = true;
    img.removeAttribute("src");
    ini.hidden = false;
  }
}

function fillPresetOptions(select) {
  select.append(new Option("— 自訂 —", ""));
  for (const conf of ["東", "西"]) {
    const group = document.createElement("optgroup");
    group.label = `${conf}岸`;
    NBA_TEAMS.filter((t) => t.conf === conf).forEach((t) => {
      group.append(new Option(`${t.short}　${t.name}`, t.short));
    });
    select.append(group);
  }
}

// 目前球隊資料同某個預設完全一樣，選單就顯示嗰隊；改過任何嘢就顯示「自訂」
function matchingPreset(team) {
  const t = findTeam(team.short);
  return t && t.name === team.name && t.color.toLowerCase() === team.color.toLowerCase() && t.logo === team.logo
    ? t.short
    : "";
}

function setIfIdle(input, value) {
  if (document.activeElement !== input && input.value !== String(value)) {
    input.value = String(value);
  }
}

function renderSettings(game) {
  for (const side of SIDES) {
    const box = $(`.team-settings[data-side="${side}"]`);
    const team = game.teams[side];
    $$(".js-field", box).forEach((input) => setIfIdle(input, team[input.dataset.field]));
    setIfIdle($(".js-preset", box), matchingPreset(team));
  }
  setIfIdle($("#cfg-period-min"), Math.round(game.periodLengthMs / 60000));
  setIfIdle($("#cfg-ot-min"), Math.round(game.otLengthMs / 60000));
  setIfIdle($("#cfg-periods"), game.regulationPeriods);
}

function renderGame(game) {
  $("#period-label").textContent = periodLabelZh(game.period, game.regulationPeriods);
  $("#status-label").textContent =
    game.status === "final" ? "完場" : game.status === "halftime" ? "半場" : "";
  $("#btn-period-prev").disabled = !canWrite() || game.period <= 1;

  for (const side of SIDES) renderTeamCard(side, game.teams[side]);

  $$("[data-status]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.status === game.status);
  });
  $("#btn-visible").textContent = game.visible ? "隱藏記分板" : "顯示記分板";
  $("#btn-visible").classList.toggle("warn", !game.visible);

  renderSettings(game);
  renderClock();
}

let lastClockText = "";
let lastToggleRunning = null;

function renderClock() {
  const game = state.game;
  if (!game || !store) return;
  const now = store.serverNow();
  const ms = clockRemaining(game.clock, now);
  const text = formatClock(ms);
  const display = $("#clock-display");
  if (text !== lastClockText) {
    display.textContent = text;
    lastClockText = text;
  }
  display.dataset.state = ms <= 0 ? "zero" : ms < 60000 ? "last-minute" : "normal";

  const running = game.clock.running && ms > 0;
  if (running !== lastToggleRunning) {
    const btn = $("#btn-toggle");
    btn.textContent = running ? "暫停" : "開始";
    btn.classList.toggle("running", running);
    lastToggleRunning = running;
  }

  // 夠鐘自動定格喺 0，方便下一節重設
  if (game.clock.running && ms <= 0 && canWrite() && state.expiringFor !== game.clock.endsAt) {
    state.expiringFor = game.clock.endsAt;
    run(() => store.clock.expire());
    haptic([60, 40, 60]);
  }
}

function loop() {
  renderClock();
  requestAnimationFrame(loop);
}

// ---------- 事件 ----------

function bindEvents() {
  $("#btn-toggle").addEventListener("click", () => {
    haptic(20);
    run(() => store.clock.toggle());
  });

  $$("[data-adjust]").forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      run(() => store.clock.adjust(Number(btn.dataset.adjust)));
    });
  });

  $("#set-time-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#set-time-input");
    const ms = parseClockInput(input.value);
    if (ms === null) {
      toast("時間格式唔啱，例如 5:30、0:45 或 24.5", "error");
      return;
    }
    run(async () => {
      await store.clock.set(ms);
      input.value = "";
      input.blur();
    }, `時間已設為 ${formatClock(ms)}`);
  });

  $("#btn-reset-period").addEventListener("click", () => {
    run(() => store.resetPeriodClock(), "已重設本節時間");
  });

  $("#btn-period-prev").addEventListener("click", () => {
    const game = state.game;
    if (!game || game.period <= 1) return;
    if (game.clock.running && !confirm("時鐘行緊，確定轉去上一節？")) return;
    run(() => store.setPeriod(game.period - 1));
  });

  $("#btn-period-next").addEventListener("click", () => {
    const game = state.game;
    if (!game) return;
    if (game.clock.running && !confirm("時鐘行緊，確定轉去下一節？")) return;
    run(() => store.setPeriod(game.period + 1));
  });

  $$(".team-card").forEach((card) => {
    const side = card.dataset.side;
    $$("[data-score]", card).forEach((btn) => {
      btn.addEventListener("click", () => {
        haptic();
        run(() => store.addScore(side, Number(btn.dataset.score)));
      });
    });
    // 長按比分可以直接輸入數字（修正錯分用）
    const scoreEl = $(".team-score", card);
    let pressTimer = null;
    const cancelPress = () => clearTimeout(pressTimer);
    scoreEl.addEventListener("pointerdown", () => {
      cancelPress();
      pressTimer = setTimeout(() => promptScore(side), 600);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((type) =>
      scoreEl.addEventListener(type, cancelPress)
    );
    scoreEl.addEventListener("dblclick", () => promptScore(side));
    scoreEl.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  $$("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const status = btn.dataset.status;
      run(async () => {
        if (status !== "live") await store.clock.stop();
        await store.updateSettings({ status });
      });
    });
  });

  $("#btn-visible").addEventListener("click", () => {
    if (!state.game) return;
    run(() => store.updateSettings({ visible: !state.game.visible }));
  });

  $("#btn-copy-url").addEventListener("click", async () => {
    const input = $("#overlay-url");
    try {
      await navigator.clipboard.writeText(input.value);
      toast("已複製 Overlay 網址", "ok");
    } catch {
      input.select();
      toast("請手動複製網址", "info");
    }
  });

  for (const side of SIDES) {
    const box = $(`.team-settings[data-side="${side}"]`);
    const preset = $(".js-preset", box);
    fillPresetOptions(preset);
    preset.addEventListener("change", () => {
      const team = findTeam(preset.value);
      if (!team) return;
      const { name, short, color, logo } = team;
      run(() => store.updateTeam(side, { name, short, color, logo }), `已揀 ${name}`);
    });

    $$(".js-field", box).forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        let value = input.value.trim();
        if (field === "short") value = value.toUpperCase();
        if ((field === "name" || field === "short") && !value) {
          toast("唔可以留空", "error");
          renderSettings(state.game);
          return;
        }
        run(() => store.updateTeam(side, { [field]: value }), "已更新");
      });
    });

    $(".js-logo-file", box).addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      toast("處理圖片中…");
      try {
        const dataUrl = await fileToLogoDataUrl(file);
        await run(() => store.updateTeam(side, { logo: dataUrl }), "隊徽已更新");
      } catch (err) {
        toast(err.message || String(err), "error");
      }
    });

    $(".js-logo-url", box).addEventListener("click", () => {
      const url = (prompt("貼上隊徽圖片網址（https://…png / svg）") || "").trim();
      if (!url) return;
      if (!isValidLogoUrl(url)) {
        toast("網址格式唔啱，要以 https:// 開頭", "error");
        return;
      }
      run(() => store.updateTeam(side, { logo: url }), "隊徽已更新");
    });

    $(".js-logo-clear", box).addEventListener("click", () => {
      run(() => store.updateTeam(side, { logo: "" }), "已移除隊徽");
    });
  }

  $("#btn-swap").addEventListener("click", () => {
    if (!confirm("確定對調主客隊？（隊名、顏色、隊徽、比分一齊換）")) return;
    run(() => store.swapTeams(), "已對調");
  });

  const bindMinutes = (selector, key) => {
    $(selector).addEventListener("change", (e) => {
      const minutes = Number(e.target.value);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) {
        toast("請輸入 1 至 60 分鐘", "error");
        renderSettings(state.game);
        return;
      }
      run(() => store.updateSettings({ [key]: Math.round(minutes * 60000) }), "已更新");
    });
  };
  bindMinutes("#cfg-period-min", "periodLengthMs");
  bindMinutes("#cfg-ot-min", "otLengthMs");

  $("#cfg-periods").addEventListener("change", (e) => {
    const n = Math.round(Number(e.target.value));
    if (!Number.isFinite(n) || n < 1 || n > 8) {
      toast("請輸入 1 至 8", "error");
      renderSettings(state.game);
      return;
    }
    run(() => store.updateSettings({ regulationPeriods: n }), "已更新");
  });

  $("#btn-reset-game").addEventListener("click", () => {
    if (!confirm("確定重新開始比賽？比分會清零，返去第 1 節。")) return;
    run(() => store.resetGame(), "比賽已重新開始");
  });

  $("#btn-logout").addEventListener("click", async () => {
    if (!confirm("確定登出？")) return;
    const { logout } = await import("./auth.js");
    await logout();
  });

  const wake = createWakeLock((wanted, active) => {
    const btn = $("#btn-wakelock");
    btn.textContent = `螢幕常亮：${active ? "開" : wanted ? "等待中" : "關"}`;
    btn.classList.toggle("active", active);
  });
  if (!wake.supported) $("#btn-wakelock").hidden = true;
  $("#btn-wakelock").addEventListener("click", () => wake.toggle());

  // 電腦快捷鍵：空白鍵開始／暫停（打字時唔會觸發）
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (views.main.hidden || !canWrite()) return;
    e.preventDefault();
    run(() => store.clock.toggle());
  });
}

function promptScore(side) {
  if (!canWrite()) return;
  const current = state.game.teams[side].score;
  const raw = prompt("直接輸入比分", String(current));
  if (raw === null) return;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    toast("比分要係 0 至 999 嘅整數", "error");
    return;
  }
  run(() => store.setScore(side, value), "比分已更新");
}

function bindLogin(login) {
  const form = $("#login-form");
  const errorEl = $("#login-error");
  const submit = $("#login-submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submit.disabled = true;
    submit.textContent = "登入中…";
    try {
      await login($("#login-email").value, $("#login-password").value);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "登入";
    }
  });
}

// ---------- 啟動 ----------

async function main() {
  if (!isConfigured()) {
    showView("config");
    return;
  }

  try {
    store = createStore(gameId);
  } catch (err) {
    showView("config");
    $("#view-config p").textContent = describeError(err);
    return;
  }

  const overlayUrl = new URL("overlay.html", location.href);
  overlayUrl.search = `?game=${encodeURIComponent(gameId)}`;
  $("#overlay-url").value = overlayUrl.href;

  bindEvents();
  syncWritable();

  store.onConnection((connected) => {
    state.connected = connected;
    renderConnection();
    maybeEnsureGame();
  });

  store.onGame(
    (game, exists) => {
      state.game = exists ? game : null;
      state.gameMissing = !exists;
      maybeEnsureGame();
      renderBanner();
      syncWritable();
      if (state.game) renderGame(state.game);
    },
    (err) => toast(describeError(err), "error")
  );

  const { watchAuth, login } = await import("./auth.js");
  bindLogin(login);
  watchAuth((user) => {
    state.user = user;
    state.permissionDenied = false;
    if (user) {
      showView("main");
      maybeEnsureGame();
    } else {
      showView("login");
    }
    renderBanner();
    syncWritable();
    if (state.game) renderGame(state.game);
  });

  requestAnimationFrame(loop);
}

main().catch((err) => {
  console.error(err);
  toast(`啟動失敗：${err?.message || err}`, "error");
});
