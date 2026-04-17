# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案性質

個人記帳網站。前端是純 JS（無 build step、無 npm），後端是 Node.js + Express，資料儲存在 PostgreSQL（Zeabur 託管）。透過 JWT 做帳號登入。

## 執行方式

需要先設定 `server/.env`（複製 `server/.env.example`），然後：

**從專案根目錄（推薦，符合部署環境）**：
```bash
npm install            # 第一次：自動透過 postinstall 連 server/ 也裝
npm run migrate        # 第一次或 schema 改動時
npm start              # 起 server，預設 http://localhost:3000
```

**或從 server/ 目錄（純 backend 開發時）**：
```bash
cd server
npm install
npm start              # 或 npm run dev (使用 node --watch)
```

打開 http://localhost:3000/，server 同時 serve 前端靜態檔（API 走 `/api/*`），所以不會有 CORS 問題。

## Zeabur 部署

整個專案以**單一 Node service** 部署（不要再用純靜態 site，否則 `/api/*` 會 405）：

1. Zeabur 後台 → Project → 新增 Service → Git → 連這個 repo
2. Zeabur 會偵測根目錄 `package.json` 的 `start` script，自動 `npm install`（觸發 postinstall 安裝 server 依賴）→ `npm start`
3. 環境變數（在 service 的 Variables 頁設定）：
   - `DATABASE_URL`：用同一 project 的 PostgreSQL service「內網」連線字串（`postgresql://root:PASSWORD@postgresql.zeabur.internal:5432/zeabur`），不要用對外 IP
   - `JWT_SECRET`：長隨機字串
   - `PORT`：Zeabur 自動注入，不要手動設
4. 第一次部署後執行 migration：在 Zeabur service 的 Console 跑 `npm run migrate`
5. Domain 頁綁一個 `.zeabur.app` 子網域或自訂域名

`postinstall` 會跑 `npm --prefix server install --omit=dev`，所以 Zeabur 端不需要額外設定 build command。

目前沒有測試框架、linter、build 指令 —— 驗證靠手動操作。

## 架構大局

```
[Browser]
  index.html / styles.css
  js/main.js              ← 進入點，持有 state、綁定事件、協調所有模組
    ├─ js/api.js          ← fetch 包裝、JWT 處理（唯一呼叫 /api/* 的地方）
    ├─ js/auth.js         ← login / register / logout / 目前使用者
    ├─ js/records.js      ← 純函式：appendRecord / replaceRecord / removeRecord / sortByDateDesc
    ├─ js/categories.js   ← 預設類別常數
    ├─ js/stats.js        ← 月份摘要、趨勢計算（純函式）
    ├─ js/csv.js          ← CSV 匯出與 JSON 備份/還原（唯一觸發下載的地方）
    ├─ js/ui.js           ← DOM 渲染輔助（表單、清單、Toast）
    └─ js/charts.js       ← Chart.js 初始化與更新（持有 chart 實例）
                          ↓ HTTP /api/*
[Node.js + Express]
  server/index.js         ← express app、註冊路由、serve 前端
    ├─ server/auth.js     ← /api/auth/{register,login,me} + authMiddleware (JWT)
    ├─ server/records.js  ← /api/records CRUD + /restore（受 authMiddleware 保護）
    ├─ server/db.js       ← pg Pool（DATE 型別保留為 'YYYY-MM-DD' 字串避免時區位移）
    ├─ server/migrate.js  ← node migrate.js 跑 schema.sql
    └─ server/schema.sql  ← users + records 資料表 + 索引
                          ↓ TCP
[PostgreSQL @ Zeabur]
```

**資料模型**：
```js
// users
{ id: UUID, email: text, password_hash: text, created_at: timestamptz }
// records (FK user_id ON DELETE CASCADE)
{ id: UUID, user_id: UUID, type: 'income'|'expense', amount: NUMERIC>0,
  category: text, merchant: text, date: 'YYYY-MM-DD', note: text, created_at: timestamptz }
```

**Render 流程**：任何狀態變動 → 呼叫 API → 後端寫 DB → 回傳新/更新的 record → 更新 `state.records` → 全量 `render()` 重繪摘要 + 清單 + 兩張圖。

**Auth 流程**：登入或註冊成功後 server 回傳 JWT (7 天有效)，前端存在 `localStorage.accounting.auth.token`，之後所有 API 都帶 `Authorization: Bearer`。401 時前端會自動登出回到登入畫面。

## 必守的設計原則

- **驗證雙層**：前端 form 屬性 + HTML5 驗證做 UX，後端 `server/records.js` 的 `validateInput()` 是權威驗證入口（新增欄位時兩邊都要改）。
- **單一職責的模組邊界**：
  - 前端：API 呼叫只走 `js/api.js`、下載只由 `js/csv.js` 觸發、Chart 實例只由 `js/charts.js` 管理（含 `destroy()` 舊實例避免記憶體洩漏）。
  - 後端：DB 連線只透過 `server/db.js` 的 `pool`、JWT 簽發/驗證只在 `server/auth.js`。
- **使用者隔離**：所有 records 查詢/更新/刪除 SQL 都必須帶 `WHERE user_id = $1`。`authMiddleware` 已把 `req.user.id` 注入，路由層別忘了用。
- **PG DATE 型別**：`db.js` 已用 `types.setTypeParser(1082, …)` 把 DATE 保留為字串，不要改回預設（會在非 UTC 機器跑出來差一天）。
- **XSS 防護**：`ui.js` 渲染清單時所有使用者輸入（category、note、merchant）都手動 escape `&<>`。新增會顯示使用者輸入的欄位時必須同樣處理（或改用 `textContent`）。
- **CSV 必須含 BOM**：`csv.js` 開頭的 `\uFEFF` 是為了 Excel 開中文不亂碼，不要移除。
- **Service Worker 排除 /api/**：`service-worker.js` 已在 fetch handler 開頭 return `/api/*`，新增任何後端路徑時要確認沒被誤快取。
- **`[hidden]` CSS 強制 override**：`styles.css` 有 `[hidden] { display: none !important; }`，因為 `.auth-screen` 的 `display: flex` 會覆蓋 HTML `hidden` 屬性（造成登入後登入畫面不消失）。**不要移除這個規則**。
- **DOM ID 是 main.js 與 index.html 的契約**：`main.js` 啟動時做一次性 `document.getElementById` 把所有需要的元素抓到 `el` 物件。改 `index.html` 的 ID 必須同步改 `main.js` 的 `el = { ... }`。

## PWA 維護

- **改前端模組（新增/刪除/改名 `js/*.js`）**：必須同步更新 `service-worker.js` 的 `PRECACHE_URLS` 陣列，並 bump `CACHE_VERSION`（例如 `v10` → `v11`），否則：
  - 新模組沒進 precache，離線時會 404
  - 舊版瀏覽器不會抓新版本
- **改 CSS / index.html / 其他靜態資源**：bump `CACHE_VERSION`，不然舊客戶端會看到舊版（`network-first` 策略需要前端有網才會更新）。
- **改 icons**：用 `python icons/generate_icons.py` 重新產出（基底是漸層藍方塊 + 白色 `$`），不要手動編輯 PNG。`PRECACHE_URLS` 也要同步。
- **`window.__deferredInstallPrompt`**：`index.html` `<head>` 裡那段 inline script 是為了在 module script defer 之前就攔截 `beforeinstallprompt`，否則安裝按鈕會抓不到 prompt。不要移到 main.js。

## 機密資訊

`server/.env` 含 DB 連線字串與 JWT secret，已在 `.gitignore`。**不要把它推上 git**。`server/.env.example` 是範本。

## 驗證變更

沒有自動化測試，變更後手動跑過：
1. 註冊新帳號 → 進入主畫面
2. 新增 → 編輯 → 刪除一筆記帳
3. 重新整理頁面（資料應從 DB 載入）
4. 切換月份篩選
5. 匯出 CSV
6. 備份 → 還原（會清空 DB 中該使用者所有資料再寫回）
7. 登出 → 重新登入
