# NBA 直播記分板

OBS 用嘅記分板 Overlay，加一個可以用手機／平板／電腦開嘅控制台。
全部係靜態網頁，資料經 Firebase Realtime Database 即時同步，**唔使任何電腦開住做 server**，Firebase 同 GitHub Pages 都用免費方案。

---

## 1. 架構同目錄

```
 手機 / 平板 / 電腦                    Firebase（Google 免費方案）               OBS
┌──────────────────┐   寫入（要登入）   ┌──────────────────────────┐   只讀    ┌──────────────────┐
│ control.html     │ ───────────────▶ │ Realtime Database         │ ───────▶ │ overlay.html     │
│ 比分 / 計時 / 節數 │ ◀─────────────── │ games/{比賽ID}            │          │ 瀏覽器來源 1920×1080 │
└──────────────────┘   即時同步         │ + Authentication（Email）  │          └──────────────────┘
                                      └──────────────────────────┘
          網頁本身放喺 GitHub Pages（或 Firebase Hosting），任何裝置開網址就用得
```

**點解咁揀（穩定性）**

| 設計 | 效果 |
|---|---|
| 時鐘只儲「結束時間（伺服器時間）」或「暫停時剩餘時間」 | 所有裝置計出嚟嘅時間一樣，唔會走時；OBS 或手機 reload、斷線再連都即刻返正確時間 |
| 開始／暫停／比分用 transaction | 兩部手機同時撳都唔會互相覆蓋或者加錯分 |
| 夠鐘自動定格 0.0 | 唔會跌落負數；多部控制台同時觸發都只寫一次 |
| 斷線時控制台按鈕自動停用並顯示紅色提示 | 避免離線時按咗、復線後先生效嘅意外 |
| Overlay 斷線照行鐘 | 按最後狀態繼續倒數，復線自動同步 |
| Firebase SDK、字型、隊徽全部打包喺網站入面 | 比賽時唔靠任何 CDN |
| 安全規則限定只有你個 email 可以寫，並檢查每個欄位格式 | 觀眾拎到網址都改唔到比分，亂資料寫唔入 |

**目錄**

```
nba-scoreboard/
├── index.html               入口頁：輸入比賽 ID，揀開控制台或 Overlay
├── control.html             控制台（手機優先設計）
├── overlay.html             OBS 記分板畫面（透明背景）
├── css/
│   ├── control.css
│   └── overlay.css
├── js/
│   ├── firebase-config.js   ★ 你要填嘅 Firebase 設定
│   ├── model.js             資料預設值、清理、計時運算、格式化（純邏輯）
│   ├── store.js             Firebase 讀寫（transaction、伺服器時間校正）
│   ├── auth.js              控制台登入
│   ├── control.js           控制台主程式
│   ├── overlay.js           Overlay 主程式（含 ?demo=1 示範模式）
│   ├── ui.js                提示、震動、螢幕常亮
│   ├── image.js             隊徽上載時自動縮細
│   ├── teams.js             NBA 30 隊預設（隊名、縮寫、底色、隊徽路徑）
│   └── vendor/firebase/     Firebase JS SDK 10.12.2（本地副本）
├── logos/                   NBA 30 隊隊徽（256×256 透明 PNG，檔名＝縮寫）
├── fonts/                   Overlay 字型 Barlow Condensed（本地副本）
├── database.rules.json      ★ 資料庫安全規則（要改 email）
└── firebase.json            用 Firebase Hosting 先需要，GitHub Pages 唔使理
```

---

## 2. 功能一覽

**Overlay（OBS）**
- 客隊（左）／主隊（右）：隊徽、縮寫、比分，用球隊主色做底，字色自動揀黑或白
- 節數：Q1–Q4，之後自動顯示 OT、2OT…；半場顯示 HALFTIME，完場顯示 FINAL
- 倒數時鐘：一分鐘以上 `11:59`，最後一分鐘 `59.9`（變黃），夠鐘 `0.0` 紅色閃
- 入分時比分閃一下；可以由控制台淡入淡出成個記分板
- 球隊預設顯示中文隊名（湖人、塞爾特人…），名太長自動縮細字；想顯示英文縮寫就喺網址加 `&label=short`
- 網址參數：`?game=main&pos=bottom&scale=1`（`pos=top` 放頂；`scale=0.8` 縮細）

**控制台**
- 大大粒「開始／暫停」，電腦可以用空白鍵
- −10s / −1s / −0.1 / +0.1 / +1s / +10s 微調，或者直接輸入時間（`5:30`、`24.5`）
- 上一節／下一節（自動停鐘並重設該節時間）、重設本節時間
- 每隊 +1 / +2 / +3 / −1；長按（電腦可雙擊）比分可以直接改數字
- 比賽中／半場／完場、顯示／隱藏記分板、一鍵複製 Overlay 網址
- **揀球隊**（控制台時鐘下面）：30 隊一揀即填好隊名、縮寫、底色同隊徽（比分唔會變）
- 設定：隊名、縮寫、主色、隊徽（上載圖片或貼網址）、主客對調、每節分鐘、加時分鐘、正規節數、重新開始比賽
- 連線狀態燈、手機「螢幕常亮」、按掣震動回饋

---

## 3. 安裝同上線（第一次大約 20 分鐘，之後唔使再做）

### A. 建立 Firebase（免費 Spark 方案，唔使信用卡）

1. 去 <https://console.firebase.google.com> 用 Google 帳戶登入 → **新增專案**，名隨你（例如 `my-scoreboard`），Google Analytics 可以關。
2. 打開 Realtime Database：新版介面喺左邊 **Databases & Storage → Realtime Database**（舊版係「建構 → Realtime Database」）；搵唔到就直接開 `https://console.firebase.google.com/project/你的專案ID/database`。撳 **建立資料庫**（唔好揀 Firestore）
   - 位置揀 **新加坡（asia-southeast1）**，香港用最快
   - 揀 **以鎖定模式啟動**
3. 同一頁去 **規則** 分頁，刪晒原本內容，貼上 `database.rules.json` 全部內容，
   將 `YOUR_LOGIN_EMAIL@example.com` 改做你**下一步會建立嘅登入 email** → **發布**。
4. 左邊 **Authentication**（舊版喺「建構」入面；新版喺 **Security** 分類，或者用頂部搜尋）→ **開始使用**
   - **Sign-in method** → 揀 **電子郵件/密碼** → 開啟第一個開關 → 儲存
   - **Users** → **新增使用者** → 輸入同第 3 步一樣嘅 email 同一個密碼（控制台用嚟登入）
5. 左上齒輪 **專案設定 → 一般** → 拉落 **你的應用程式** → 撳 `</>`（網頁）圖示 → 改個名 → **註冊應用程式**（唔使剔 Hosting）。
6. 佢會顯示一段 `const firebaseConfig = { ... }`。打開 `js/firebase-config.js`，將 `apiKey`、`authDomain`、`databaseURL`、`projectId`、`appId` 逐個貼入引號入面。
   - 如果嗰段冇 `databaseURL`：返去 Realtime Database 頁，最頂嗰條 `https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app` 就係，複製貼入。

### B. 放上網（GitHub Pages，免費）

1. 去 <https://github.com> 開帳戶 → 右上 **+ → New repository** → 名例如 `scoreboard` → 揀 **Public** → **Create repository**。
2. 喺新 repo 頁撳 **uploading an existing file** → 將 `nba-scoreboard` 資料夾**入面**所有嘢（`index.html`、`css`、`js` 等，包括 `js/vendor`）拖入去 → **Commit changes**。
3. repo 嘅 **Settings → Pages** → Source 揀 **Deploy from a branch** → Branch 揀 **main**、**/(root)** → **Save**。
4. 等 1–2 分鐘，頁頂會顯示網址，例如 `https://你的帳戶.github.io/scoreboard/`。
5. 返 Firebase **Authentication → Settings → Authorized domains → Add domain**，加 `你的帳戶.github.io`。

> 我可以代你開 repo 同上載，你只要話我知同埋連接 GitHub。

### C. 開始用

- **控制台**：手機打開 `https://你的帳戶.github.io/scoreboard/control.html` → 登入。第一次登入會自動建立比賽資料。iPhone 可以「分享 → 加至主畫面」當 App 用。
- **OBS**：來源 → **＋ → 瀏覽器** → 網址填 `https://你的帳戶.github.io/scoreboard/overlay.html?game=main`，闊 `1920`、高 `1080` → 確定。
- **未設定 Firebase 前想睇樣**：`overlay.html?demo=1`。
- 同一時間幾多部手機開控制台都得，全部即時同步。

### D. 之後改嘢

改任何檔案後，喺 GitHub repo 再上載同名檔案覆蓋就得，1–2 分鐘生效（OBS 入面對住來源撳右鍵 → 重新整理）。

### 常見問題

| 情況 | 解決 |
|---|---|
| 控制台顯示「未設定 Firebase」 | `js/firebase-config.js` 未填或者未上載最新版本 |
| 登入顯示「未加入授權網域」 | 做 B5 |
| 登入成功但顯示「冇寫入權限」 | Rules 入面嘅 email 同登入 email 唔一樣（大細楷都要一樣），改完記得發布 |
| Overlay 顯示「等待控制面板建立比賽」 | 用控制台登入一次就會建立；兩邊 `?game=` 要一樣 |
| OBS 見唔到記分板 | 檢查來源大細係 1920×1080；控制台「顯示記分板」；記分板係咪被其他來源遮住 |
| 頂部紅色「連線中斷」 | 手機網絡問題；Overlay 會照行鐘，恢復後自動同步 |

---

## 4. 自訂貼士

- **位置／大細**：Overlay 網址加 `&pos=top` 放頂，`&scale=0.85` 縮細。微調距離改 `css/overlay.css` 嘅 `bottom: 48px` / `top: 40px`。
- **顏色**：`css/overlay.css` 最頂 `--accent`（節數底色、最後一分鐘時鐘色）、`--panel`（時鐘區底色）、`--danger`（0.0 顏色）。
- **字型**：字型檔放喺 `fonts/`（Barlow Condensed，已打包，唔靠網絡），改 `css/overlay.css` 頂部 `@font-face` 同 `--font`。
- **節數文字**：改 `js/model.js` 嘅 `periodLabel()`（Overlay，例如改做「第1節」）同 `periodLabelZh()`（控制台）。
- **FINAL / HALFTIME 文字**：`js/overlay.js` 入面 `render()`。
- **其他賽制**：控制台設定入面改每節分鐘、加時分鐘、正規節數（例如 FIBA 10 分鐘、街場 2 節）。
- **同時做幾場**：用唔同比賽 ID，例如 `control.html?game=court2` 配 `overlay.html?game=court2`；入口頁 `index.html` 可以直接輸入。
- **多個人控制**：Firebase **Users** 加多個帳戶，再將 Rules 嗰行改做
  `"auth != null && (auth.token.email === 'a@x.com' || auth.token.email === 'b@x.com')"`。
- **加／改預設球隊**：將透明 PNG 放入 `logos/`，再喺 `js/teams.js` 加一行（`short` 要同檔名一樣）。
- **隊徽**：建議用透明背景 PNG／SVG；上載時會自動縮到 256px 再存入資料庫，唔使額外儲存空間。
- **免費額度**：記分板每次更新只傳幾十 bytes，OBS 加幾部手機連住全場，遠低於 Firebase 免費額度（同時 100 個連線、每月 10GB 下載）。
