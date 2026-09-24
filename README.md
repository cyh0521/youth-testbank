# 幼獅題庫系統 v2（出題列印版）

## 系統定位

本系統是供管理員與教師使用的線上題庫與試卷製作工具，主要流程為題庫建置、選題組卷、試卷存檔、預覽、列印與 Word／PDF 匯出。

班級功能目前只作為教師整理試卷的分類資料夾，不包含學生名單、班級加入代碼、線上試卷、線上作答或成績管理。

Bug 修正與驗證紀錄請見 [`fix_report.md`](fix_report.md)。

## 2026-09-24 試卷匯出與排版更新

- Word 匯出與網頁預覽共用試卷內容，表頭、題目、選項、題尾與解答不再各自維護一套 HTML；Word 仍以 HTML 格式的 `.doc` 檔提供下載。
- 試卷列表和預覽視窗新增 PDF 下載。PDF 由瀏覽器以 `html2pdf.js` 產生，保留預覽外觀；其頁面內容為影像，文字無法像一般文字型 PDF 一樣選取。
- Word／PDF 下載與直接列印前可選擇 A3（297×420 mm）、A4（210×297 mm）或 JIS B4（257×364 mm）。選擇會記在目前瀏覽器，並套用到輸出頁面尺寸。
- Word／PDF 頁邊距共用設定，預設上下左右各 10 mm，可在側邊欄「進階設定 → 試卷版面設定 → 試卷邊距」調整為 5～50 mm；設定儲存在目前瀏覽器。直接列印仍使用上下 18 mm、左右 20 mm 頁邊距。
- 側邊欄「我的帳號」提供個人資料與密碼設定；管理員另有「帳號管理」入口。「進階設定」包含選擇科目、試卷版面設定與試卷表頭設定。選擇科目的圖卡標題為「選擇要顯示的科目」；試卷版面設定分為「字體與行距」、「試卷邊距」兩張圖卡，各自儲存與重設。個人資料分頁的圖卡標題使用「帳號資訊」，密碼設定分頁的圖卡標題使用「更新密碼」，避免重複分頁名稱。
- 試卷版面設定的初始值為黑體、16 px、行距 1.85；試卷表頭設定分為「表頭文字」與「欄位位置」兩張卡片，可分別修改預設文字及每個欄位所在列與列內順序，並各自儲存與重設。預覽、列印、Word 與 PDF 共用這些設定。
- 是非題及選擇題以「（　　）題號」作為答題欄；長題目換行時，後續文字對齊第一行題目文字。預覽、列印與 PDF 使用表格定位，Word 匯出改用同一段落的懸掛縮排，避免儲存格交界造成題號後空白與可見編輯記號。
- 選擇題的題目、選項、題尾在同一段自然接續，不強制在三者之間換行；題尾若只有「。」，不在句號前加入空格。
- 已完成 `js/exam-preview.js` 的 JavaScript 語法檢查與變更空白檢查。尚未以實際試卷在 Microsoft Word 與 PDF 閱讀器中完成視覺、分頁及紙張尺寸驗證。

## 2026-09-23 介面調整

- 全站採用 Mac 風格的半透明深色側欄、淺色圓角卡片與藍色主要按鈕，版面直接貼齊瀏覽器邊界。
- 側欄頂部第一行以白色幼獅 Logo（`img/youth.png`）搭配「幼獅文化」，第二行以跨欄白色區塊顯示「線上命題系統」，文字使用側欄底色；整組可點擊，收合後只顯示白獅圖示。側欄使用者資訊已移除；首頁移除問候區，選題入口統一稱為「手動選題」。
- 點擊整塊品牌按鈕可收合／展開側欄，支援鍵盤操作並記憶狀態；移除漢堡按鈕。
- 首頁優先呈現建立試卷、題庫概況與最近試卷；管理員另有快速入口。
- 換頁時同步顯示側欄，移除整頁透明淡入；支援的瀏覽器使用原生跨頁過渡。側欄角色提示只用於顯示，每頁仍需完成 Firebase 驗證才可操作內容。
- 題庫概況整合題型分布長條圖，可依科目與冊別篩選；冊別只顯示課本管理中該科的實際冊別，並合併重複名稱，顯示所選範圍的題數。
- 側欄底部只保留登出操作；首頁右上角以登入者姓名顯示歡迎訊息。
- 側欄寬度略為縮小。使用者可在「我的帳號」選擇原始線條頭像或彩色男女預設人像，也可上傳 JPG、PNG、WebP 圖片；上傳圖會縮小後儲存在個人資料中，首頁右上角同步顯示。
- 「我的帳號」的「密碼設定」分頁會先驗證目前密碼，再更新新密碼。
- 建立新試卷提供「電腦選題」、「手動選題」、「編碼選題」及「題本列印」四個入口；題本列印標示「即將推出」，目前不開放操作。
- 最近試卷支援名稱搜尋、科目篩選與建立時間排序，最多顯示六份；完整操作仍位於試卷管理。
- 首頁專屬樣式位於 `css/dashboard.css`，全站樣式位於 `css/theme.css`。
- 登入頁同步更新視覺風格，試卷列表在窄螢幕上將操作按鈕另起一列。

## 2026-09-21 功能調整

- 移除學生帳號、線上試卷、線上作答與班級成績功能。
- 移除 `take.html`、`results.html`、`my-results.html` 與獨立的 `classes.html`。
- 儲存試卷後留在原選題頁，只顯示儲存成功訊息，不再自動開啟預覽。
- 恢復班級分類資料，教師可依任教學校與班級建立試卷資料夾。
- 將班級新增、編輯、刪除及試卷分類整合至 `exams.html`。
- 試卷管理提供三種瀏覽方式：
  - **依班級分類**：先顯示班級圖卡，再進入該班試卷列表。
  - **依科目分類**：先顯示科目圖卡，再進入該科試卷列表。
  - **不分類**：直接顯示全部試卷。
- 班級圖卡封面優先顯示學校、班級與科目；科目圖卡顯示涵蓋的學校與班級數。
- 試卷列表可依建立時間、班級或科目排序。
- 目前使用中的排序按鈕會顯示 `↑` 或 `↓`；重複點擊同一按鈕即可切換升冪與降冪。
- 試卷建立時間以 24 小時制顯示，例如 `2026/09/21 14:35`。
- 保留舊試卷 `classIds`、`classNames` 欄位的讀取相容性；重新編輯後會轉為目前的單一班級分類格式。

## 技術架構

- 前端：HTML、CSS、原生 JavaScript 與 ES Modules
- 身分驗證：Firebase Authentication（Email/Password）
- 資料庫：Cloud Firestore
- 圖片儲存：Firebase Storage
- Word 題目匯入：Mammoth.js
- 試卷輸出：瀏覽器列印、Word HTML 匯出與 PDF 下載（使用 html2pdf.js）

網站沒有建置步驟，但因為使用 ES Modules，必須透過 HTTP Server 開啟，不能直接雙擊 HTML 檔案。

```bash
npx serve .
```

也可使用 VS Code Live Server 或其他靜態網站伺服器。

入口檔案為 `index.html`。

## 目前目錄結構

```text
youth-testbank/
├─ index.html                 登入與第一次初始化管理員
├─ dashboard.html             題庫及試卷總覽
├─ textbooks.html             科目、冊別、章節管理
├─ import-textbooks.html      初次建立或重建課本結構工具
├─ import.html                Word 題目匯入
├─ questions.html             題目查詢與維護
├─ compose.html               電腦自動選題
├─ manual.html                人工選題
├─ coded.html                 依題目編號選題
├─ exams.html                 試卷、班級分類、預覽與輸出
├─ settings.html              我的帳號、進階設定與管理員帳號管理（依網址檢視）
├─ firestore.rules            Firestore 安全規則
├─ css/
│  ├─ theme.css               全站版面、元件與列印樣式
│  └─ dashboard.css           首頁專屬樣式
├─ js/
│  ├─ firebase.js             Firebase 初始化與 DataService
│  ├─ auth-guard.js           登入守衛與角色檢查
│  ├─ shell.js                同步繪製側邊欄與收合控制
│  ├─ core.js                 共用常數、UI 工具與選單資料
│  ├─ exam-preview.js         表頭、預覽、列印與 Word／PDF 匯出
│  └─ icons.js                共用 SVG 圖示
└─ _Firebase舊版/             舊功能備份，不屬於現行網站
```

`_Firebase舊版` 中仍保留學生、線上考試與成績功能的舊程式，只供歷史參考。修改或部署現行網站時，不應從該資料夾載入檔案。

## 主要頁面與權限

| 頁面 | 功能 | 管理員 | 教師 |
|---|---|:---:|:---:|
| `index.html` | 管理員／教師登入；第一次初始化管理員 | ✓ | ✓ |
| `dashboard.html` | 題庫統計、最近試卷與快速入口 | ✓ | ✓ |
| `textbooks.html` | 科目、冊別與章節管理 | ✓ | |
| `import-textbooks.html` | 建立或重建課本資料 | ✓ | |
| `import.html` | 從 `.docx` 批次匯入題目 | ✓ | |
| `questions.html` | 查詢、編輯與刪除題目 | ✓ | |
| `compose.html` | 依條件自動選題 | ✓ | ✓ |
| `manual.html` | 瀏覽題庫並人工選題 | ✓ | ✓ |
| `coded.html` | 依題目編號加入試卷 | ✓ | ✓ |
| `exams.html` | 試卷與班級分類管理、預覽、列印、Word 與 PDF 匯出 | ✓ | ✓ |
| `settings.html?view=accounts` | 管理工作人員帳號 | ✓ | |
| `settings.html` | 修改個人資料與頭像、密碼 | ✓ | ✓ |
| `settings.html?view=catalog` | 進階設定：選擇科目、試卷版面（含試卷邊距）與試卷表頭 | ✓ | ✓ |

管理員可讀取所有試卷與班級分類；教師只能讀取及修改自己建立的試卷與班級分類。
題目維護頁僅管理員可進入；教師仍可在選題頁讀取題目。Firestore 規則要求有效角色，並限制教師試卷的建立者欄位。

## HTML、CSS 與 JavaScript 載入關係

一般登入後頁面的載入順序如下：

1. HTML 載入 `css/theme.css`。
2. `js/icons.js` 提供共用圖示。
3. `js/core.js` 提供題型常數、UI 工具、導覽與共用下拉選單。
4. 側欄元素後立即載入 `js/shell.js`，同步繪製導覽，不等待 Firebase。主內容先顯示靜態版面，以 `inert` 暫停操作。
5. 頁面內的 ES Module 匯入 `js/auth-guard.js`，載入 `js/firebase.js`、確認登入角色後啟用內容；角色相同時不重建側欄。
6. 試卷相關頁面另外匯入 `js/exam-preview.js`。

首頁科目題數沿用 `settings/questionStats` 的 `bySubject` 統計；科目名稱合併共用預設與課本管理資料，不再查詢各冊題數。跨頁過渡使用 [CSS View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)，不支援時仍可正常換頁。

各頁面應透過全域 `DataService` 存取 Firebase，不直接重複實作 Firestore 查詢。

## 使用流程

### 第一次建立系統

1. 在 Firebase Authentication 啟用 Email/Password。
2. 建立 Firestore Database。
3. 如需題目圖片，啟用 Firebase Storage。
4. 確認 `index.html` 與 `js/firebase.js` 的 `firebaseConfig` 指向正確專案。
5. 發布 `firestore.rules`。
6. 開啟 `index.html`，選擇「初始化管理員」。
7. 輸入目前程式設定的管理員驗證碼 `admin2024`，建立第一個管理員帳號。

管理員可在「帳號管理」中建立其他管理員或教師帳號。教師帳號必須填寫服務學校。

### 建立題庫

1. 在「課本管理」建立科目、冊別與章節。
2. 在「題目匯入」選擇科目與冊別，上傳 Word 入題檔。
3. 在「題目維護」查詢匯入結果；只有管理員可修改或刪除題目。

Word 入題檔的表格欄位為：難易、章數、節數、小節、題型、頁數／出處、來源、答數、簡答／答案、題目、選項1～5、結尾、詳答／解析。

### 建立與輸出試卷

1. 使用電腦選題、人工選題或編碼選題建立試卷。
2. 儲存時可選擇一個班級分類，也可保留為未分類。
3. 儲存完成後仍停留在目前選題頁。
4. 前往「試卷管理」，選擇依班級、依科目或不分類瀏覽。
5. 在試卷列表中進行預覽、直接列印、Word 或 PDF 匯出、編輯或刪除。列印或下載時可選擇 A3、A4 或 JIS B4 紙張；預覽視窗也提供列印及兩種下載格式。

### 班級分類

- 班級新增、編輯與刪除位於「試卷管理 → 依班級分類」。
- 每個班級包含學校名稱、班級名稱、選填科目與備註。
- 仍有試卷的班級不能直接刪除，必須先將試卷移至其他班級或改為未分類。
- 班級只用於整理試卷，不會建立學生名單或成績資料。

## 試卷管理介面

### 分類圖卡

- 班級圖卡顯示學校、班級、科目、試卷數及備註。
- 科目圖卡顯示科目、試卷數，以及相關學校與班級數量。
- 未指定班級或科目的試卷會顯示對應的未分類圖卡。

### 列表排序

- 可選擇「建立時間」、「班級」或「科目」。
- 目前排序欄位的按鈕會顯示 `↑` 或 `↓`。
- 重複點擊同一個按鈕會切換升冪與降冪。
- 切換至其他排序欄位時，預設使用降冪。
- 建立時間同時顯示日期及 24 小時制時間。

## Firestore 資料

| Collection／文件 | 主要用途 |
|---|---|
| `users/{uid}` | 管理員與教師資料、角色、服務學校及頭像設定 |
| `questions/{questionId}` | 題目、答案、解析、題型與課本位置 |
| `exams/{examId}` | 試卷名稱、題目順序、配分、科目及班級分類 |
| `classes/{classId}` | 教師建立的學校與班級分類 |
| `textbooks/{subjectId}` | 科目資料 |
| `textbooks/{subjectId}/books/{bookId}` | 冊別資料 |
| `textbooks/{subjectId}/books/{bookId}/chapters/{chapterId}` | 章節資料 |
| `settings/questionStats` | 題庫統計快取 |
| `settings/questionCounter` | 題目流水號計數器 |

新試卷使用 `classId`、`className`、`classSchool` 記錄單一班級分類。舊資料中的 `classIds` 與 `classNames` 仍可顯示；試卷重新儲存後會改用新格式。

## 建議 Firestore 索引

| Collection | 欄位 | 用途 |
|---|---|---|
| `questions` | `subjectCode` ASC, `bookCode` ASC | 題目篩選 |
| `questions` | `subjectCode` ASC, `type` ASC | 科目與題型篩選 |
| `exams` | `createdBy` ASC, `createdAt` DESC | 教師讀取自己的試卷 |
| `classes` | `teacherUid` ASC | 教師讀取自己的班級分類 |

單欄位索引通常由 Firestore 自動建立。若查詢需要複合索引，Firebase 會在錯誤訊息中提供建立索引的連結。

## 部署注意事項

- 修改 `firestore.rules` 後必須重新發布，否則班級分類與教師試卷權限不會更新。
- Firebase 設定同時存在於 `index.html` 與 `js/firebase.js`，更換 Firebase 專案時兩處都要同步。
- 登入採用 `browserSessionPersistence`，關閉瀏覽器分頁後登入狀態會失效。
- 現行網站只接受 `admin` 與 `teacher` 角色。
- 管理員新增工作人員時使用獨立 Firebase Auth instance，不會切換目前管理員的登入帳號。
- 前端只能讓使用者修改自己的 Firebase Authentication 密碼；若要由管理員重設或完整刪除其他人的 Auth 帳號，需要 Firebase Admin SDK 或 Cloud Functions。
