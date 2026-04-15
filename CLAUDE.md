# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案性質

個人用純前端記帳網站。**無 build step、無 npm、無後端**。所有資料存於瀏覽器 `localStorage`（key: `accounting.records.v1`），圖表透過 CDN 載入 Chart.js。

## 執行方式

因為使用 ES modules (`<script type="module">`)，必須透過 HTTP 協定載入，不能雙擊 `index.html`（瀏覽器會因 CORS 封鎖）：

```bash
python -m http.server 8765
# 開啟 http://localhost:8765/
```

目前沒有測試框架、linter、或 build 指令 —— 驗證靠手動操作。

## 架構大局

資料流單向：`localStorage` ← → `state.records` (main.js 內的單一可變參照) → 純函式計算 → DOM/Chart 渲染。

```
main.js                   ← 進入點，持有 state、綁定事件、協調所有模組
  ├─ storage.js           ← localStorage 讀寫（唯一存取 localStorage 的地方）
  ├─ records.js           ← CRUD 純函式，回傳新陣列（immutable）
  ├─ categories.js        ← 預設類別常數
  ├─ stats.js             ← 彙總/分類/趨勢計算（純函式）
  ├─ csv.js               ← CSV 匯出與 JSON 備份/還原（唯一觸發下載的地方）
  ├─ ui.js                ← DOM 渲染輔助（表單、清單、Toast）
  └─ charts.js            ← Chart.js 初始化與更新（持有 chart 實例）
```

**render 流程**：任何狀態變動都走 `persist(nextRecords)` → 存檔 → 覆蓋 `state.records` → 全量 `render()` 重繪摘要 + 清單 + 兩張圖。不做 diff，不做部分更新。

**Record 資料模型**：
```js
{ id, type: 'income'|'expense', amount: number>0, category, date: 'YYYY-MM-DD', note, createdAt }
```

## 必守的設計原則

- **Immutability**：`records.js` 裡所有操作回傳新陣列，絕不 mutate 原陣列。新程式碼加功能時必須延續這個模式。
- **單一職責的模組邊界**：localStorage 只由 `storage.js` 動、下載只由 `csv.js` 觸發、Chart 實例只由 `charts.js` 管理（含 `destroy()` 舊實例避免記憶體洩漏）。不要繞過去。
- **XSS 防護**：`ui.js` 渲染清單時所有使用者輸入（category、note）都手動 escape 了 `&<>`。若新增會顯示使用者輸入的欄位，必須同樣處理（或改用 `textContent`）。
- **驗證在 `records.js`**：`validateInput()` 是唯一的資料驗證入口，新增欄位時在這裡擴充。
- **CSV 必須含 BOM**：`recordsToCsv()` 開頭的 `\uFEFF` 是為了 Excel 開中文不亂碼，不要移除。

## 驗證變更

沒有自動化測試，變更後手動跑過：新增 → 編輯 → 刪除 → 重新整理（持久化）→ 月份切換 → CSV 匯出 → JSON 備份/還原。
