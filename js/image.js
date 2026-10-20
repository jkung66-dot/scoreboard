// 將上載嘅隊徽縮細做 dataURL，直接存入資料庫（唔使 Firebase Storage / 付費方案）

import { MAX_LOGO_CHARS } from "./model.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片讀唔到，請試第二個檔案"));
    img.src = src;
  });
}

export async function fileToLogoDataUrl(file, maxSize = 256) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("請揀圖片檔（PNG、JPG、SVG、WebP）");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("圖片太大（上限 15MB）");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth || maxSize;
    const h = img.naturalHeight || maxSize;
    const ratio = Math.min(1, maxSize / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // PNG 保留透明背景；太大就轉 WebP，再唔得就縮細
    let data = canvas.toDataURL("image/png");
    if (data.length > MAX_LOGO_CHARS * 0.6) data = canvas.toDataURL("image/webp", 0.9);
    if (data.length > MAX_LOGO_CHARS * 0.6 && maxSize > 128) {
      return fileToLogoDataUrl(file, 128);
    }
    if (data.length > MAX_LOGO_CHARS) throw new Error("圖片壓縮後仍然太大，請用簡單啲嘅隊徽");
    return data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
