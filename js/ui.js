// 控制面板共用嘅小工具：提示訊息、震動、螢幕常亮

const toastEl = () => document.getElementById("toast");
let toastTimer = null;

export function toast(message, type = "info") {
  const el = toastEl();
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, type === "error" ? 5000 : 2200);
}

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 部分瀏覽器唔支援震動，忽略
  }
}

// 防止手機喺比賽途中自動熄屏
export function createWakeLock(onChange) {
  let sentinel = null;
  let wanted = false;
  const supported = "wakeLock" in navigator;

  async function acquire() {
    if (!supported || !wanted || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
        onChange(wanted, false);
      });
      onChange(wanted, true);
    } catch {
      onChange(wanted, false);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted && !sentinel) acquire();
  });

  return {
    supported,
    async toggle() {
      wanted = !wanted;
      if (wanted) await acquire();
      else {
        await sentinel?.release().catch(() => {});
        sentinel = null;
        onChange(false, false);
      }
    }
  };
}
