# 幼獅題庫系統 v2（Firebase 版）

## 技術架構
- **前端**：純 HTML + CSS + JavaScript (ES Modules)
- **後端**：Firebase（Firestore + Authentication + Storage）
- **題目匯入**：mammoth.js（.docx 解析）

## v2.1 升級重點（2026-04-16）

### 程式碼整理
- 刪除死碼：`js/common.js`、`js/firebase-config.js`、`css/style.css`
- `js/core.js` 從 311 行精簡到 180 行（移除 localStorage 舊資料層）
- 抽出共用樣式到 `css/theme.css`：toast、filter-bar、batch-bar、章節樹、骨架屏

### 資料層強化
- **流水號 transaction**：題目編號改用 Firestore `runTransaction`，多人同時匯入也不會重號
- **統計即時讀取**：`getQuestionStats()` 改從 `settings/questionStats` 文件讀取，不再掃全表
  - 新增/刪除題目時用 `increment()` 同步更新
  - 提供 `rebuildQuestionStats()` 供管理員修復統計

### Firestore 索引建議
為提升查詢效能，建議在 Firebase Console → Firestore → 索引 建立以下複合索引：

| Collection | 欄位                                  | 用途             |
|------------|---------------------------------------|------------------|
| questions  | subjectCode (Asc), bookCode (Asc)     | 篩選題目         |
| questions  | subjectCode (Asc), type (Asc)         | 依科目+題型篩選  |
| exams      | createdBy (Asc), createdAt (Desc)     | 教師檢視自己試卷 |
| results    | studentUid (Asc), submittedAt (Desc)  | 學生檢視自己成績 |
| results    | examId (Asc), submittedAt (Desc)      | 檢視某張試卷成績 |
| classes    | teacherUid (Asc)                      | 教師檢視自己班級 |

> 提示：當 Firestore 查詢需要索引時會自動回報錯誤並提供建立連結，可不必預先建立。

## Firebase 設定步驟

### 1. 建立 Firebase 專案
1. 前往 https://console.firebase.google.com
2. 建立專案，名稱：`youth-testbank`
3. 啟用 **Authentication** → Email/Password
4. 建立 **Firestore Database**（Production Mode）
5. 啟用 **Storage**（題目圖片用）

### 2. 取得 Firebase 設定碼
Firebase Console → 專案設定 → 一般 → 您的應用程式 → 取得設定物件

設定值請填入 `js/firebase.js` 內的 `firebaseConfig`。

### 3. 部署 Firestore 安全規則
將 `firestore.rules` 內容複製到 Firebase Console → Firestore → 規則 → 發布

### 4. 第一次建立管理員
1. 開啟 `index.html`
2. 點擊「初始化管理員」分頁
3. 驗證碼填入：`admin2024`
4. 填入信箱、姓名、密碼 → 建立

### 5. 本機運行（需要 HTTP Server）
由於使用 ES Modules，必須透過 HTTP Server 開啟（不能直接雙擊 HTML 檔案）

```bash
# 方法一：npx serve
npx serve .

# 方法二：Python
python -m http.server 8080

# 方法三：VS Code Live Server 擴充套件
```

## 檔案說明

### HTML 頁面
| 檔案              | 功能                       | 角色           |
|-------------------|----------------------------|----------------|
| `index.html`      | 登入頁 + 初始化管理員      | 所有人         |
| `dashboard.html`  | 首頁總覽                   | 所有人         |
| `settings.html`   | 帳號管理 + 個人資料        | 管理員/個人    |
| `import.html`     | 題目匯入（.docx）          | 管理員/教師    |
| `questions.html`  | 題目維護                   | 管理員/教師    |
| `compose.html`    | 電腦選題（自動出卷）       | 教師           |
| `manual.html`     | 人工選題                   | 教師           |
| `coded.html`      | 編碼選題                   | 教師           |
| `exams.html`      | 試卷管理                   | 教師           |
| `take.html`       | 學生線上考試               | 學生           |
| `results.html`    | 成績查詢（教師）           | 教師           |
| `my-results.html` | 我的成績（學生）           | 學生           |
| `classes.html`    | 班級管理                   | 教師/學生      |
| `textbooks.html`  | 課本結構管理               | 管理員         |

### JS / CSS
| 檔案                  | 用途                                        |
|-----------------------|---------------------------------------------|
| `js/firebase.js`      | DataService — Firebase 資料層統一介面       |
| `js/auth-guard.js`    | 頁面守衛 + 側邊欄渲染                       |
| `js/core.js`          | 共用常數、UI 工具、課本快取                 |
| `js/exam-preview.js`  | 試卷預覽 + Word 輸出                        |
| `css/theme.css`       | 全部共用樣式（取代舊 style.css）            |

## 帳號角色權限

| 功能          | 管理員 | 教師 | 學生 |
|---------------|:------:|:----:|:----:|
| 帳號管理      | ✓      |      |      |
| 課本管理      | ✓      |      |      |
| 題目維護      | ✓      | ✓    |      |
| 題目匯入      | ✓      |      |      |
| 電腦/人工選題 | ✓      | ✓    |      |
| 試卷管理      | ✓      | ✓    |      |
| 成績查詢      | ✓      | ✓    |      |
| 班級管理      | ✓      | ✓    |      |
| 線上考試      |        |      | ✓    |
| 我的成績      |        |      | ✓    |

## 注意事項

### 關於「幫他人更改密碼」
前端 JavaScript 只能更改**自己**的密碼。若要讓管理員強制重設他人密碼，需要使用 **Firebase Admin SDK**（需要 Node.js 後端或 Cloud Functions）。

### 關於刪除帳號
目前前端只能刪除 Firestore 的使用者資料（文件），Firebase Authentication 的帳號仍存在。
完整刪除需要 Admin SDK。可在 Firebase Console 手動刪除，或搭配 Cloud Functions。

### 關於題目統計
- 統計值記錄在 `settings/questionStats`，新增/刪除題目時自動同步
- 若統計與實際不符（如手動在 Console 改資料），管理員可至「設定 → 系統工具」按「重建統計」
- 重建會掃全表，題庫越大耗時越久

### Word 匯入格式
系統解析 .docx 中的表格，第一列為標題列，欄位名稱對應：
難易、章數、節數、小節、題型、頁數/出處、來源、答數、簡答/答案、題目、選項1~5、結尾、詳答/解析

### 建議 Firestore 索引

以下索引可提高查詢效能。至 Firebase Console → Firestore → 索引 → 新增複合索引：

| Collection  | 索引欄位                                | 排序 |
|------------|----------------------------------------|------|
| questions  | `subjectCode` ASC, `bookCode` ASC      |      |
| questions  | `subjectCode` ASC, `type` ASC           |      |
| results    | `studentUid` ASC, `submittedAt` DESC    |      |
| results    | `examId` ASC, `submittedAt` DESC        |      |
| exams      | `createdBy` ASC, `createdAt` DESC       |      |
| classes    | `teacherUid` ASC                        |      |

> 若查詢時 Firebase Console 出現「此查詢需要索引」的連結，直接點擊建立即可。
