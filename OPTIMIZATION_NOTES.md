# 幼獅題庫系統 — 優化摘要（2026-04-16）

本次全面檢視並最佳化程式碼。以下是完整變更清單。

---

## 🗑️ 刪除的死碼檔案

| 檔案 | 原因 |
|------|------|
| `js/common.js`        | 只剩自我引用，被 `auth-guard.js` + `firebase.js` 完全取代 |
| `js/firebase-config.js` | 只被 `common.js` 引用（已連帶刪除） |
| `css/style.css`       | 無頁面引用，被 `theme.css` 完全取代 |

**影響**：減少 ~800 行死碼，降低維護混亂。

---

## 🧹 程式碼清理（階段 A）

### 1. `js/core.js` 大幅精簡
- 原 311 行 → 現 200 行
- 砍掉 localStorage 版的 `DB`、`Auth`、`UI.renderSidebar`、`UI.confirm`、`UI.buildOptions`、`DocImporter.parseMarkdownTable/parseText`、`initDefaultAccounts`
- 保留：`QUESTION_TYPES`、`SUBJECT_CODES`、`BOOK_CODES`、`COMPOSE_DIFFICULTY`、`UI.toast/formatDate/typeBadge/diffBadge`、`DocImporter.rowToQuestion`、`nav()`、課本快取輔助
- **新增**：`UI.renderIcons(root)` — 批次展開 `<span data-icon="name">` 為 SVG

### 2. `js/auth-guard.js` 改寫
- `.main.ready` 觸發時機：從「50ms setTimeout 強制」→「資料就緒後」
- 側欄 icon 全部改用 SVG（含 fallback 到 emoji）

### 3. `js/firebase.js` 改進
- **修死碼**：`getQuestionsByIds` 刪掉未完成的 `__name__ in` 段落
- **刪死碼**：移除無頁面使用的 `getChapters`（會掃全表）
- 程式碼更乾淨

### 4. 清除 14 個 HTML 的 inline 預載入
- 原本每個 HTML head 都有一段「防止 JS 初始化前空白閃爍」的 inline style + DOMContentLoaded 腳本
- 現已統一移到 `css/theme.css` + `js/auth-guard.js`

### 5. `css/theme.css` 整併
- 新增/整併：toast 系統、filter-bar、batch-bar、pagination、chapter-tree、skeleton loading、.q-detail-label、.q-options、.edit-grid、.modal-lg
- 刪除重複的 `@keyframes` 定義
- 修掉兩套「預載入動畫」衝突

---

## 🔒 資料層強化（階段 C）

### 1. 流水號改為真 Firestore Transaction
**檔案**：`js/firebase.js` — `_nextSeqNums()`

**改動前**：`get → set`，並發匯入會重號
**改動後**：`runTransaction`，Firebase 保證原子性

### 2. 題目統計改為 Aggregation 文件
**檔案**：`js/firebase.js`

**改動前**：`getQuestionStats()` 每次掃全表（數千題 × 每次 dashboard 載入 = 大量 Firestore 讀取配額）
**改動後**：
- 新增 `settings/questionStats` 文件，內容：`{ total, byType, bySubject, byDifficulty, updatedAt }`
- `addQuestion/addQuestions/deleteQuestion/deleteAllQuestions` 全部同步更新 counter（用 `increment()`）
- `getQuestionStats()` 改成 1 次讀取
- 提供 `rebuildQuestionStats()` 管理員修復用（掃全表重算）

**第一次部署影響**：若已有題目，首次讀 stats 會自動觸發 `rebuildQuestionStats()` 掃全表一次重建，之後都走快路徑。僅發生一次。

### 3. README 補上 Firestore 索引建議
6 個複合索引建議（questions、results、exams、classes），提升查詢效能。

---

## 🎨 介面升級（階段 B）

### 1. SVG Icon 系統
**檔案**：`js/icons.js`（已存在，本次未改動）
- 31 個 lucide 風格圖示
- 4 種尺寸：16 / 18 / 20 / 24 px
- 用法：`ICONS.book20` 或 HTML 標記 `<span data-icon="book20"></span>`

### 2. Toast 通知系統
**檔案**：`core.js` + `theme.css`
- 從 `cssText` 手刻 → CSS 類別規範
- 淡入淡出動畫
- 四種樣式：`toast-info/success/danger/warning`

### 3. 骨架屏載入
**檔案**：`theme.css`
- `.skeleton` 通用 shimmer 動畫
- `.skeleton-text` / `.skeleton-card` 等預設尺寸
- 取代單調的 spinner，dashboard 載入時先顯示結構框架

### 4. Dashboard 重新設計
**檔案**：`dashboard.html`
- 骨架屏 → welcome banner → 4 卡統計 → 雙欄長條圖 → 快速操作 → 最近試卷
- 教師/管理員 / 學生 兩套不同視圖
- SVG icon 全面統一

### 5. Topbar 按鈕 SVG 化
- `coded.html`、`exams.html` topbar 按鈕從 emoji 改成 SVG

### 6. questions.html 表格 ↔ 卡片切換
- 結果列右上方加入切換按鈕
- 預設表格檢視（保留密度與效率）
- 卡片檢視：題目全文 + 選項（單選/複選正解標綠色） + 答案 + 出處 + 章節
- 切換偏好用 localStorage 記住
- 卡片每頁 20 筆、表格 50 筆
- 響應式：手機版卡片自動把按鈕摺到下方

---

## 📊 效益總結

| 指標 | 改動前 | 改動後 |
|------|--------|--------|
| JS 檔數 | 6 檔（2 檔是死碼） | 5 檔（全有用） |
| CSS 檔數 | 2 檔（1 檔是死碼） | 1 檔 |
| `core.js` 行數 | 311 | 200 |
| Dashboard 讀 stats | N 次 doc 讀取 | **1 次** doc 讀取 |
| 並發匯入重號風險 | ❌ 有 | ✓ 無 |
| Inline 預載入片段 | 14 處重複 | 0 |
| Icon 一致性 | emoji 混 SVG | 統一 SVG（含 emoji fallback） |

---

## ⚠️ 部署注意事項

### 1. Firestore 規則不需更新
`settings/questionStats` 文件存於既有的 `settings/` collection，現有規則 `allow read: if isSignedIn(); allow write: if isAdmin()` 已涵蓋。

### 2. 第一次載入 dashboard 會變慢
讀 stats 時找不到 `settings/questionStats` 文件 → 自動 fallback `rebuildQuestionStats()` 掃全表建立。**僅發生一次**。

### 3. 建議在 Firebase Console 建立複合索引
README 末段列出 6 個建議索引。若不建立，複雜查詢會在 Console 噴錯並提供一鍵建立連結。

### 4. Icon 展開
- 靜態 HTML：`<span data-icon="upload20"></span>` 會在 `DOMContentLoaded` 自動展開
- 動態生成：在 `el.innerHTML = ...` 之後呼叫 `UI.renderIcons(el)`

---

## 🔮 可繼續優化的方向（未做）

1. 剩餘頁面 topbar emoji 按鈕（`my-results.html`、`questions.html`）
2. `questions.html` 表格改卡片顯示（行動裝置友善）
3. `compose.html` / `manual.html` 預覽區的精緻化
4. Firebase API Key 設定網域限制（在 Firebase Console）
5. 考慮加上 App Check
