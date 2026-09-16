# 幼獅題庫系統 v2（Firebase 版）

## 技術架構
- **前端**：純 HTML + CSS + JavaScript (ES Modules)
- **後端**：Firebase（Firestore + Authentication）
- **題目匯入**：mammoth.js（.docx 解析）

## Firebase 設定步驟

### 1. 建立 Firebase 專案
1. 前往 https://console.firebase.google.com
2. 建立專案，名稱：`youth-testbank`
3. 啟用 **Authentication** → Email/Password
4. 建立 **Firestore Database**（Production Mode）

### 2. 取得 Firebase 設定碼
Firebase Console → 專案設定 → 一般 → 您的應用程式 → 取得設定物件

將取得的設定填入 `firebase-config.js`：
```javascript
const firebaseConfig = {
  apiKey: "你的 API Key",
  authDomain: "youth-testbank.firebaseapp.com",
  projectId: "youth-testbank",
  storageBucket: "youth-testbank.appspot.com",
  messagingSenderId: "你的 sender ID",
  appId: "你的 App ID"
};
```

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

| 檔案 | 功能 |
|------|------|
| `index.html`     | 登入頁 + 初始化管理員 |
| `dashboard.html` | 首頁總覽 |
| `settings.html`  | 帳號管理（新增/編輯/刪除） + 個人資料 |
| `import.html`    | 題目匯入（.docx）|
| `questions.html` | 題目維護 |
| `compose.html`   | 電腦選題（自動出卷）|
| `manual.html`    | 人工選題 |
| `exams.html`     | 試卷管理 |
| `take.html`      | 學生線上考試 |
| `results.html`   | 成績查詢（教師）|
| `my-results.html`| 我的成績（學生）|
| `style.css`      | 共用樣式 |
| `common.js`      | 共用工具（side bar、toast、auth 等）|
| `firebase-config.js` | Firebase 設定 |
| `firestore.rules`    | Firestore 安全規則 |

## 帳號角色權限

| 功能 | 管理員 | 教師 | 學生 |
|------|:------:|:----:|:----:|
| 帳號管理    | ✓ | | |
| 題目維護    | ✓ | ✓ | |
| 題目匯入    | ✓ | ✓ | |
| 電腦/人工選題| ✓ | ✓ | |
| 試卷管理    | ✓ | ✓ | |
| 成績查詢    | ✓ | ✓ | |
| 線上考試    | | | ✓ |
| 我的成績    | | | ✓ |

## 注意事項

### 關於「幫他人更改密碼」
前端 JavaScript 只能更改**自己**的密碼。若要讓管理員強制重設他人密碼，需要使用 **Firebase Admin SDK**（需要 Node.js 後端或 Cloud Functions）。

建議做法：
1. 在 settings.html 的編輯帳號功能中，跳過密碼欄位
2. 如需重設密碼，讓使用者自行透過「忘記密碼」功能

### 關於刪除帳號
目前前端只能刪除 Firestore 的使用者資料（文件），Firebase Authentication 的帳號仍存在。
完整刪除需要 Admin SDK。可在 Firebase Console 手動刪除，或搭配 Cloud Functions。

### Word 匯入格式
系統解析 .docx 中的表格，第一列為標題列，欄位名稱對應：
難易、章數、節數、小節、題型、頁數/出處、來源、答數、簡答/答案、題目、選項1~5、結尾、詳答/解析

## 待開發頁面
- [x] index.html（登入）
- [x] dashboard.html（首頁）
- [x] settings.html（帳號管理）
- [x] import.html（題目匯入）
- [x] questions.html（題目維護）
- [ ] compose.html（電腦選題）
- [ ] manual.html（人工選題）
- [ ] exams.html（試卷管理）
- [ ] take.html（學生考試）
- [ ] results.html（成績查詢）
- [ ] my-results.html（我的成績）
