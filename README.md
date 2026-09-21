# 幼獅題庫系統 v2（出題列印版）

## 系統定位

本系統提供管理員與教師使用的線上題庫、組卷、試卷存檔、預覽、列印及 Word 匯出功能。班級功能僅作為教師的試卷分類；學生帳號、線上作答與成績功能已移除。

## 技術架構

- 前端：純 HTML、CSS、JavaScript（ES Modules）
- 後端：Firebase Authentication、Firestore、Storage
- 題目匯入：Mammoth.js 解析 `.docx`

因使用 ES Modules，必須透過 HTTP Server 開啟，不能直接雙擊 HTML。

```bash
npx serve .
```

或：

```bash
python -m http.server 8080
```

## 主要頁面

| 檔案 | 功能 | 角色 |
|---|---|---|
| `index.html` | 登入及首次初始化管理員 | 管理員／教師 |
| `dashboard.html` | 題庫與試卷總覽 | 管理員／教師 |
| `textbooks.html` | 科目、冊別與章節管理 | 管理員 |
| `import.html` | 從 Word 匯入題目 | 管理員 |
| `questions.html` | 題目查詢、編輯與刪除 | 管理員 |
| `compose.html` | 電腦自動選題 | 管理員／教師 |
| `manual.html` | 人工選題 | 管理員／教師 |
| `coded.html` | 依題目編號選題 | 管理員／教師 |
| `exams.html` | 試卷與班級管理，可依班級、科目或全部瀏覽、排序與輸出 | 管理員／教師 |
| `settings.html` | 工作人員帳號與個人資料 | 管理員／教師 |

`import-textbooks.html` 是首次建立或重建課本結構時使用的管理工具，不在主導覽中。

## 共用程式

| 檔案 | 用途 |
|---|---|
| `js/firebase.js` | Firebase 資料層與 `DataService` |
| `js/auth-guard.js` | 登入／角色守衛及側邊欄 |
| `js/core.js` | 題型常數、UI 工具與課本快取 |
| `js/exam-preview.js` | 試卷表頭、預覽、列印與 Word 匯出 |
| `js/icons.js` | 共用 SVG 圖示 |
| `css/theme.css` | 全站共用樣式 |

## 權限

| 功能 | 管理員 | 教師 |
|---|:---:|:---:|
| 工作人員帳號管理 | ✓ | |
| 課本結構管理 | ✓ | |
| 題目匯入 | ✓ | |
| 題目查詢與選題 | ✓ | ✓ |
| 電腦／人工／編碼選題 | ✓ | ✓ |
| 試卷存檔、編輯與輸出 | ✓ | ✓ |
| 班級分類管理 | ✓ | ✓ |

## Firebase 設定

1. 啟用 Authentication 的 Email/Password。
2. 建立 Firestore Database。
3. 如需題目圖片，啟用 Storage。
4. 將專案設定填入 `js/firebase.js` 與 `index.html`。
5. 部署 `firestore.rules`。

第一次使用時，在登入頁點選「初始化管理員」，以管理員驗證碼建立第一個帳號。

## 題目與試卷資料

- 題目統計保存在 `settings/questionStats`。
- 題目流水號保存在 `settings/questionCounter`，批次匯入使用 Firestore transaction。
- 班級分類保存在 `classes` collection，並整合於試卷管理頁；每個教師只能管理自己的分類，管理員可管理全部分類。
- 試卷保存題目 ID、題型配分、排序、基本資料及所屬班級分類。
- 試卷管理可依班級或科目先顯示分類圖卡，也可不分類直接顯示全部試卷；列表支援依建立時間、班級或科目升冪／降冪排序。
- 儲存試卷後留在原選題頁；需要預覽、列印或 Word 匯出時，可前往試卷管理頁操作。

Word 入題檔的表格欄位為：難易、章數、節數、小節、題型、頁數／出處、來源、答數、簡答／答案、題目、選項1～5、結尾、詳答／解析。

## 建議索引

| Collection | 欄位 | 用途 |
|---|---|---|
| questions | `subjectCode` ASC, `bookCode` ASC | 題目篩選 |
| questions | `subjectCode` ASC, `type` ASC | 科目與題型篩選 |
| exams | `createdBy` ASC, `createdAt` DESC | 教師讀取自己的試卷 |
| classes | `teacherUid` ASC | 教師讀取自己的班級分類 |

若 Firestore 回報查詢需要複合索引，可依錯誤訊息提供的連結建立。
