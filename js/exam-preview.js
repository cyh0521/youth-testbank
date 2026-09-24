/**
 * 幼獅題庫系統 — 試卷預覽 & Word 輸出模組 v3
 * - 表頭設定獨立成 showHeaderSettings()
 * - 預覽試卷支援即時調整字型 / 字體大小 / 行距
 * - 表頭與外觀偏好都會記在 localStorage
 */

const TYPE_ORDER  = ['T1','T2','T3','T4','T5','T6'];
const TYPE_LABELS = { T1:'是非題', T2:'選擇題', T3:'複選題', T4:'填空題', T5:'配合題', T6:'問答題' };
const ROMANS      = ['一','二','三','四','五','六','七','八'];

const GRADE_OPTIONS = ['一年級','二年級','三年級','四年級'];
const EXAM_OPTIONS  = ['第一次段考','第二次段考','期中考','期末考','隨堂測驗','其他'];

// ── 字型 / 字體大小 / 行距 預設與選項 ─────────────────
// 字型優先用 Google Fonts Web Font（跨平台一致），fallback 到本機相近字型
const FONT_OPTIONS = [
  { id:'serif',  label:'宋體（Noto Serif）',  stack:'"Noto Serif TC","新細明體","PMingLiU",serif' },
  { id:'sans',   label:'黑體（Noto Sans）',   stack:'"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif' },
  { id:'kaiti',  label:'楷體（依本機字型）',   stack:'"標楷體","DFKai-SB","BiauKai","cwTeXKai",serif' },
  { id:'system', label:'系統預設字型',        stack:'system-ui,-apple-system,"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif' },
];
const FONT_SIZE_RANGE = { min: 11, max: 20, step: 1, default: 14 };
const LINE_HEIGHT_RANGE = { min: 1.4, max: 2.4, step: 0.05, default: 1.85 };

// ── localStorage Keys ─────────────────────────────────
const HEADER_KEY = 'examHeaderData';
const APPEARANCE_KEY = 'examAppearance';
const WORD_MARGIN_KEY = 'examWordMargins';
export const DEFAULT_WORD_MARGINS = { top:10, right:10, bottom:10, left:10 };
const PAPER_SIZE_KEY = 'examPaperSize';
const PAPER_SIZES = {
  A3: { width:297, height:420 },
  A4: { width:210, height:297 },
  B4: { width:257, height:364 },
};
let pdfLibraryPromise;

function choosePaperSize(format) {
  let modal = document.getElementById('epPaperSizeModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay hidden" id="epPaperSizeModal" style="z-index:1300">
      <div class="modal" style="max-width:420px;width:96%">
        <div class="modal-header"><h3 id="epPaperSizeTitle">選擇紙張大小</h3><button class="modal-close" type="button" id="epPaperSizeClose">✕</button></div>
        <div class="modal-body" style="padding:16px 20px">
          ${Object.entries(PAPER_SIZES).map(([key, size]) => `<label style="display:flex;align-items:center;gap:10px;padding:10px 4px;cursor:pointer">
            <input type="radio" name="epPaperSize" value="${key}"><span><strong>${key}${key.startsWith('B') ? '（JIS）' : ''}</strong>　${size.width} × ${size.height} mm</span>
          </label>`).join('')}
        </div>
        <div class="modal-footer"><button class="btn btn-ghost" type="button" id="epPaperSizeCancel">取消</button><button class="btn btn-primary" type="button" id="epPaperSizeConfirm">確定</button></div>
      </div></div>`);
    modal = document.getElementById('epPaperSizeModal');
  }
  document.getElementById('epPaperSizeTitle').textContent = `${format === '列印' ? '列印' : `下載 ${format}`}：選擇紙張大小`;
  document.getElementById('epPaperSizeConfirm').textContent = format === '列印' ? '列印' : '下載';
  let saved = 'A4';
  try { saved = localStorage.getItem(PAPER_SIZE_KEY) || 'A4'; } catch {}
  modal.querySelector(`input[value="${PAPER_SIZES[saved] ? saved : 'A4'}"]`).checked = true;
  modal.classList.remove('hidden');
  return new Promise(resolve => {
    const close = value => {
      modal.classList.add('hidden');
      document.getElementById('epPaperSizeClose').onclick = null;
      document.getElementById('epPaperSizeCancel').onclick = null;
      document.getElementById('epPaperSizeConfirm').onclick = null;
      resolve(value);
    };
    document.getElementById('epPaperSizeClose').onclick = () => close(null);
    document.getElementById('epPaperSizeCancel').onclick = () => close(null);
    document.getElementById('epPaperSizeConfirm').onclick = () => {
      const selected = modal.querySelector('input[name="epPaperSize"]:checked').value;
      try { localStorage.setItem(PAPER_SIZE_KEY, selected); } catch {}
      close(selected);
    };
  });
}

export async function downloadExam(examData, questions, format) {
  if (format !== 'Word' && format !== 'PDF') throw new Error('不支援的下載格式');
  const paperKey = await choosePaperSize(format);
  if (!paperKey) return;
  if (format === 'Word') exportToWord(examData, questions, paperKey);
  else await exportToPdf(examData, questions, paperKey);
}

export async function printWithPaperChoice(examData, questions) {
  const paperKey = await choosePaperSize('列印');
  if (paperKey) printExam(examData, questions, paperKey);
}

function loadPdfLibrary() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.integrity = 'sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==';
      script.crossOrigin = 'anonymous';
      script.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error('PDF 工具載入失敗'));
      script.onerror = () => reject(new Error('PDF 工具載入失敗，請檢查網路連線'));
      document.head.appendChild(script);
    }).catch(error => { pdfLibraryPromise = null; throw error; });
  }
  return pdfLibraryPromise;
}

export function loadWordMargins() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORD_MARGIN_KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_WORD_MARGINS).map(([side, fallback]) => {
      const value = Number(saved[side]);
      return [side, Number.isFinite(value) && value >= 5 && value <= 50 ? value : fallback];
    }));
  } catch { return { ...DEFAULT_WORD_MARGINS }; }
}

export function saveWordMargins(values) {
  const margins = {};
  for (const side of Object.keys(DEFAULT_WORD_MARGINS)) {
    const value = Number(values[side]);
    if (!Number.isFinite(value) || value < 5 || value > 50) throw new Error('頁邊距需介於 5 至 50 mm');
    margins[side] = value;
  }
  localStorage.setItem(WORD_MARGIN_KEY, JSON.stringify(margins));
}

export function resetWordMargins() {
  localStorage.removeItem(WORD_MARGIN_KEY);
}

// ══════════════════════════════════════════════════════════
//  讀寫表頭 / 外觀偏好
// ══════════════════════════════════════════════════════════
function loadHeader() {
  try { return JSON.parse(localStorage.getItem(HEADER_KEY) || '{}'); }
  catch { return {}; }
}
function saveHeader(d) {
  try { localStorage.setItem(HEADER_KEY, JSON.stringify(d)); } catch{}
}

// 舊版字型 id → 新版對應（相容處理：使用者上次選的 mingti/heiti 還能正常還原）
const FONT_ID_MIGRATION = {
  mingti: 'serif',
  heiti:  'sans',
};

function loadAppearance() {
  try {
    const a = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}');
    let font = a.font || 'serif';
    if (FONT_ID_MIGRATION[font]) font = FONT_ID_MIGRATION[font];
    // 若 id 已不存在於選項中（更新後遺留），回到預設
    if (!FONT_OPTIONS.find(f => f.id === font)) font = 'serif';
    return {
      font,
      fontSize:   a.fontSize   || FONT_SIZE_RANGE.default,
      lineHeight: a.lineHeight || LINE_HEIGHT_RANGE.default,
    };
  } catch {
    return { font:'serif', fontSize:FONT_SIZE_RANGE.default, lineHeight:LINE_HEIGHT_RANGE.default };
  }
}
function saveAppearance(d) {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(d)); } catch{}
}

function fontStackById(id) {
  return FONT_OPTIONS.find(f => f.id === id)?.stack || FONT_OPTIONS[0].stack;
}

// ══════════════════════════════════════════════════════════
//  共用：分組
// ══════════════════════════════════════════════════════════
function groupByType(questions) {
  const g = {};
  questions.forEach(q => { if (!g[q.type]) g[q.type] = []; g[q.type].push(q); });
  return g;
}
function orderedTypes(g) { return TYPE_ORDER.filter(t => g[t]?.length); }


// ══════════════════════════════════════════════════════════
//  ❶  獨立 Modal：試卷表頭設定
// ══════════════════════════════════════════════════════════
function ensureHeaderModal() {
  if (document.getElementById('hdModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay hidden" id="hdModal" style="z-index:1100">
  <div class="modal" style="max-width:560px;width:96%">
    <div class="modal-header">
      <h3>試卷表頭設定</h3>
      <button class="modal-close" onclick="document.getElementById('hdModal').classList.add('hidden')">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 20px">
      <p style="font-size:.84rem;color:var(--text-muted);margin-bottom:14px">
        於此設定試卷上方表頭資訊。設定會記住，預覽試卷與輸出 Word 時自動套用。
      </p>
      <div class="form-group">
        <label class="form-label">學校</label>
        <input class="form-control" id="hdSchool" placeholder="學校名稱（選填）">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">學年度</label>
          <input class="form-control" id="hdYear" placeholder="例：113">
        </div>
        <div class="form-group">
          <label class="form-label">學期</label>
          <select class="form-control" id="hdSemester">
            <option value="○">未指定</option>
            <option value="一">一</option>
            <option value="二">二</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">年級</label>
          <select class="form-control" id="hdGrade">
            <option value="">請選擇</option>
            ${GRADE_OPTIONS.map(g=>`<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">試別</label>
          <select class="form-control" id="hdExamType">
            <option value="">請選擇</option>
            ${EXAM_OPTIONS.map(e=>`<option value="${e}">${e}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">考試範圍</label>
        <input class="form-control" id="hdRange" placeholder="例：第一單元 ~ 第三單元">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="document.getElementById('hdModal').classList.add('hidden')">取消</button>
      <button class="btn btn-outline" id="hdResetBtn">清除設定</button>
      <button class="btn btn-primary" id="hdSaveBtn">儲存</button>
    </div>
  </div>
</div>`);

  document.getElementById('hdSaveBtn').onclick = () => {
    const data = readHeaderForm();
    saveHeader(data);
    document.getElementById('hdModal').classList.add('hidden');
    UI.toast('表頭資訊已儲存', 'success');
    // 若預覽 modal 開著，立即更新
    if (window._epRefresh) window._epRefresh();
  };
  document.getElementById('hdResetBtn').onclick = () => {
    if (!confirm('確定要清除表頭設定？')) return;
    localStorage.removeItem(HEADER_KEY);
    fillHeaderForm({});
    UI.toast('已清除', 'info');
  };
}

function readHeaderForm() {
  return {
    school:   (document.getElementById('hdSchool').value   || '').trim(),
    year:     (document.getElementById('hdYear').value     || '').trim(),
    semester: (document.getElementById('hdSemester').value || '○'),
    grade:    (document.getElementById('hdGrade').value    || ''),
    examType: (document.getElementById('hdExamType').value || ''),
    range:    (document.getElementById('hdRange').value    || '').trim(),
  };
}
function fillHeaderForm(d) {
  document.getElementById('hdSchool').value   = d.school   || '';
  document.getElementById('hdYear').value     = d.year     || '';
  document.getElementById('hdSemester').value = d.semester || '○';
  document.getElementById('hdGrade').value    = d.grade    || '';
  document.getElementById('hdExamType').value = d.examType || '';
  document.getElementById('hdRange').value    = d.range    || '';
}

export function showHeaderSettings() {
  ensureHeaderModal();
  fillHeaderForm(loadHeader());
  document.getElementById('hdModal').classList.remove('hidden');
}


// ══════════════════════════════════════════════════════════
//  ❷  Modal：試卷預覽（含外觀調整）
// ══════════════════════════════════════════════════════════
function ensurePreviewModal() {
  if (document.getElementById('epModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<style>
/* 外觀調整工具列 */
.ep-toolbar{
  display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  padding:10px 16px;background:#f5f3ee;border:1px solid #e0dcd2;
  border-radius:6px;margin-bottom:14px;font-size:.82rem;
}
.ep-toolbar .group{display:flex;align-items:center;gap:6px}
.ep-toolbar .group label{color:var(--text-secondary);white-space:nowrap}
.ep-toolbar select,.ep-toolbar input[type=range]{font-size:.82rem}
.ep-toolbar .val{font-family:var(--font-mono);font-size:.78rem;color:var(--text-muted);min-width:36px;text-align:right}
.ep-toolbar .info-pill{
  margin-left:auto;font-size:.76rem;color:var(--text-muted);
}
/* 試卷區 */
#epPaper{color:#000;padding:0 4px}
.ep-exam-header{border:2px solid #333;padding:10px 14px;margin-bottom:14px;font-size:.94em}
.ep-exam-header .title-row{font-size:1.05em;font-weight:700;margin-bottom:6px}
.ep-exam-header .info-row{display:flex;gap:24px}
.ep-section-head{font-weight:700;margin:14px 0 8px}
.ep-q{margin-bottom:8px;line-height:inherit}
.ep-q .q-no{font-weight:700}
.ep-answer-table{width:100%;border:0;border-collapse:collapse;table-layout:auto;font:inherit;line-height:inherit}
.ep-answer-table td{border:0;padding:0;vertical-align:top;font:inherit;line-height:inherit}
.ep-answer-table .ep-answer-prefix{width:1%;white-space:nowrap}
.ep-q p,.ep-answer-table p{margin:0;line-height:inherit}
.ep-answer-blank{color:#888;margin-top:4px}
</style>
<div class="modal-overlay hidden" id="epModal">
  <div class="modal" style="max-width:900px;width:96%;max-height:94vh;display:flex;flex-direction:column">
    <div class="modal-header" style="flex-shrink:0">
      <h3 id="epTitle" style="flex:1">試卷預覽</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="window._epOpenHeader()" title="編輯試卷表頭">✎ 表頭</button>
        <button class="btn btn-outline btn-sm" onclick="window._epDoPrint()">🖨 列印</button>
        <button class="btn btn-primary btn-sm" onclick="window._epDoExport()">⬇ 輸出 Word</button>
        <button class="btn btn-outline btn-sm" onclick="window._epDoExportPdf()">⬇ 下載 PDF</button>
        <button class="modal-close" onclick="document.getElementById('epModal').classList.add('hidden')">✕</button>
      </div>
    </div>
    <div style="padding:14px 20px 0;flex-shrink:0">
      <div class="ep-toolbar">
        <div class="group">
          <label>字型</label>
          <select id="epFont" class="form-control" style="padding:3px 6px">
            ${FONT_OPTIONS.map(f=>`<option value="${f.id}">${f.label}</option>`).join('')}
          </select>
        </div>
        <div class="group">
          <label>字體大小</label>
          <input type="range" id="epFontSize"
                 min="${FONT_SIZE_RANGE.min}" max="${FONT_SIZE_RANGE.max}"
                 step="${FONT_SIZE_RANGE.step}" value="${FONT_SIZE_RANGE.default}"
                 style="width:110px">
          <span class="val" id="epFontSizeVal">${FONT_SIZE_RANGE.default}px</span>
        </div>
        <div class="group">
          <label>行距</label>
          <input type="range" id="epLineHeight"
                 min="${LINE_HEIGHT_RANGE.min}" max="${LINE_HEIGHT_RANGE.max}"
                 step="${LINE_HEIGHT_RANGE.step}" value="${LINE_HEIGHT_RANGE.default}"
                 style="width:110px">
          <span class="val" id="epLineHeightVal">${LINE_HEIGHT_RANGE.default}</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="epAppearReset" title="恢復預設">↺ 重設</button>
      </div>
    </div>
    <div id="epBody" style="padding:0 20px 20px;overflow-y:auto;flex:1;overscroll-behavior:contain"></div>
  </div>
</div>`);

  // 外觀控制事件
  const fontSel  = document.getElementById('epFont');
  const sizeRng  = document.getElementById('epFontSize');
  const sizeVal  = document.getElementById('epFontSizeVal');
  const lineRng  = document.getElementById('epLineHeight');
  const lineVal  = document.getElementById('epLineHeightVal');

  const onAppearChange = () => {
    const a = {
      font:       fontSel.value,
      fontSize:   +sizeRng.value,
      lineHeight: +lineRng.value,
    };
    sizeVal.textContent = a.fontSize + 'px';
    lineVal.textContent = a.lineHeight.toFixed(2);
    saveAppearance(a);
    applyAppearance();
  };
  fontSel.addEventListener('change', onAppearChange);
  sizeRng.addEventListener('input',  onAppearChange);
  lineRng.addEventListener('input',  onAppearChange);

  document.getElementById('epAppearReset').onclick = () => {
    fontSel.value = 'serif';
    sizeRng.value = FONT_SIZE_RANGE.default;
    lineRng.value = LINE_HEIGHT_RANGE.default;
    onAppearChange();
  };
}

// 套用外觀（讀 localStorage → 設定 #epPaper 樣式）
function applyAppearance() {
  const a = loadAppearance();
  const paper = document.getElementById('epPaper');
  if (!paper) return;
  paper.style.fontFamily = fontStackById(a.font);
  paper.style.fontSize   = a.fontSize + 'px';
  paper.style.lineHeight = a.lineHeight;
  // 同步 UI 控制（可能由其他來源變更，例如重設）
  const fontSel = document.getElementById('epFont');
  const sizeRng = document.getElementById('epFontSize');
  const sizeVal = document.getElementById('epFontSizeVal');
  const lineRng = document.getElementById('epLineHeight');
  const lineVal = document.getElementById('epLineHeightVal');
  if (fontSel) fontSel.value = a.font;
  if (sizeRng) sizeRng.value = a.fontSize;
  if (sizeVal) sizeVal.textContent = a.fontSize + 'px';
  if (lineRng) lineRng.value = a.lineHeight;
  if (lineVal) lineVal.textContent = a.lineHeight.toFixed(2);
}


// ══════════════════════════════════════════════════════════
//  ❸  顯示預覽（對外 API）
// ══════════════════════════════════════════════════════════
export function showExamPreview(examData, questions) {
  ensurePreviewModal();

  document.getElementById('epTitle').textContent = `預覽：${examData.title || '試卷'}`;

  window._epExamData   = examData;
  window._epQuestions  = questions;
  window._epRefresh    = () => { renderPaper(examData, questions); applyAppearance(); };
  window._epDoPrint    = () => printWithPaperChoice(examData, questions);
  window._epDoExport   = () => downloadExam(examData, questions, 'Word');
  window._epDoExportPdf = () => downloadExam(examData, questions, 'PDF');
  window._epOpenHeader = () => showHeaderSettings();

  renderPaper(examData, questions);
  applyAppearance();
  document.getElementById('epModal').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════
//  直接列印（使用與預覽相同的表頭、字型與版面）
// ══════════════════════════════════════════════════════════
export function printExam(examData, questions, paperKey = 'A4') {
  ensurePreviewModal();
  renderPaper(examData, questions);
  applyAppearance();

  const paper = document.getElementById('epPaper');
  if (!paper) return;
  const size = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;

  const frame = document.createElement('iframe');
  frame.setAttribute('title', '試卷列印');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>${examData.title || '試卷'}</title>
    <style>
      @page { size: ${size.width}mm ${size.height}mm; margin: 18mm 20mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; }
      .ep-exam-header { border: 2px solid #333; padding: 10px 14px; margin-bottom: 14px; font-size: .94em; }
      .ep-exam-header .title-row { font-size: 1.05em; font-weight: 700; margin-bottom: 6px; }
      .ep-exam-header .info-row { display: flex; gap: 24px; }
      .ep-section-head { font-weight: 700; margin: 14px 0 8px; }
      .ep-q { margin-bottom: 8px; break-inside: avoid; line-height: inherit; }
      .ep-answer-table { width: 100%; border: 0; border-collapse: collapse; table-layout: auto; font: inherit; line-height: inherit; }
      .ep-answer-table td { border: 0; padding: 0; vertical-align: top; font: inherit; line-height: inherit; }
      .ep-answer-table .ep-answer-prefix { width: 1%; white-space: nowrap; }
      .ep-q p, .ep-answer-table p { margin: 0; line-height: inherit; }
      .ep-answer-blank { color: #555; margin-top: 4px; }
    </style></head><body>${paper.outerHTML}</body></html>`);
  doc.close();

  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(cleanup, 30000);
  }, 100);
}


// ══════════════════════════════════════════════════════════
//  渲染試卷 HTML
// ══════════════════════════════════════════════════════════
function buildSubjectLabel(examData) {
  const subjLabel = (typeof tbSubjectName === 'function') ? tbSubjectName(examData.subjectCode) : (examData.subjectCode || '');
  const bookLabel = (typeof tbBookName === 'function')    ? tbBookName(examData.bookCode)       : (examData.bookCode || '');
  return subjLabel + (bookLabel ? `（${bookLabel}）` : '');
}

function renderPaper(examData, questions) {
  document.getElementById('epBody').innerHTML = buildPaperHtml(examData, questions);
}

function buildPaperHtml(examData, questions) {
  const h    = loadHeader();
  const subject = buildSubjectLabel(examData);
  const typeScores = examData.typeScores || {};
  const grouped    = groupByType(questions);
  const types      = orderedTypes(grouped);

  const yearText = h.year ? h.year : '○○○';
  const semText  = h.semester || '○';
  const headerLine1 = [
    `${yearText}學年度第${semText}學期`,
    subject,
    h.grade,
    h.examType,
  ].filter(Boolean).join('　');
  const rangeText = h.range ? '　範圍：' + h.range : '';

  let html = `<div id="epPaper">
    <div class="ep-exam-header">
      <div class="title-row">${headerLine1}</div>
      <div class="info-row">
        <span>班級：＿＿＿</span>
        <span>姓名：＿＿＿＿＿＿</span>
        <span>座號：＿＿＿</span>
        ${h.school ? `<span style="margin-left:auto">${h.school}</span>` : ''}
      </div>
      ${rangeText ? `<div style="margin-top:4px;font-size:.86em">範圍：${h.range}</div>` : ''}
    </div>`;

  types.forEach((type, secIdx) => {
    const qs    = grouped[type];
    const score = typeScores[type] || 2;
    const total = qs.length * score;
    html += `<div class="ep-section-head">${ROMANS[secIdx]}、${TYPE_LABELS[type]}（每題 ${score} 分，共 ${total} 分）</div>`;
    qs.forEach((q, i) => { html += renderQPreview(q, i+1, type); });
  });

  // 解答
  html += `<div style="border-top:2px dashed #aaa;margin-top:20px;padding-top:12px">
    <div style="font-weight:700;margin-bottom:8px">【解答】</div>`;
  types.forEach((type, secIdx) => {
    const qs = grouped[type];
    html += `<div style="margin-bottom:6px"><b>${ROMANS[secIdx]}、${TYPE_LABELS[type]}：</b>`;
    if (type === 'T6' || type === 'T5' || type === 'T4') {
      html += `</div>`;
      qs.forEach((q,i) => {
        html += `<div style="margin-bottom:4px">${i+1}. ${q.answer||'—'}`;
        if (q.analysis) html += `<div style="margin-left:1.5em;color:#555;font-size:.86em">【解析】${q.analysis}</div>`;
        html += `</div>`;
      });
    } else {
      html += qs.map((q,i) => `${i+1}.${q.answer||'—'}`).join('　　') + `</div>`;
      const withAnalysis = qs.filter(q => q.analysis);
      if (withAnalysis.length) {
        withAnalysis.forEach(q => {
          const no = qs.indexOf(q)+1;
          html += `<div style="margin-left:1.5em;color:#555;font-size:.86em;margin-bottom:3px">${no}.【解析】${q.analysis}</div>`;
        });
      }
    }
  });
  html += `</div></div>`;

  return html;
}

function renderQPreview(q, num, type) {
  let body = '';
  if (type === 'T1') {
    body = `<table class="ep-answer-table" role="presentation"><tr><td class="ep-answer-prefix">（　　）${num}.</td><td>${q.text||''}</td></tr></table>`;
  } else if (type === 'T2') {
    const opts = q.options?.length
      ? `　${q.options.map((o,i)=>`(${String.fromCharCode(65+i)})${o}`).join('　')}` : '';
    const tail = q.tail?.trim() || '';
    body = `<table class="ep-answer-table" role="presentation"><tr><td class="ep-answer-prefix">（　　）${num}.</td><td>${q.text||''}${opts}${tail ? `${tail === '。' ? '' : '　'}${tail}` : ''}</td></tr></table>`;
  } else if (type === 'T6') {
    body = `${num}.${q.text||''}<div class="ep-answer-blank">答：</div>`;
  } else {
    body = `${num}.${q.text||''}`;
  }
  return `<div class="ep-q">${body}</div>`;
}


// ══════════════════════════════════════════════════════════
//  輸出 Word（讀取相同的表頭與外觀偏好）
// ══════════════════════════════════════════════════════════
export function exportToWord(examData, questions, paperKey = 'A4') {
  const a = loadAppearance();
  const margins = loadWordMargins();
  const size = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;
  const title = examData.title || '試卷';
  const fontStack = fontStackById(a.font);
  const lineHeightPx = `${(a.fontSize * a.lineHeight).toFixed(2)}px`;
  const paper = document.createElement('div');
  paper.innerHTML = buildPaperHtml(examData, questions);
  // Word 在表格欄位交界加入可見編輯記號，也容易拉大題號後的空白。
  // Word 版改為單一段落的懸掛縮排；預覽與 PDF 仍使用原本表格版面。
  paper.querySelectorAll('.ep-q').forEach(question => {
    const table = question.querySelector('.ep-answer-table');
    if (!table) return;
    const prefix = table.querySelector('.ep-answer-prefix');
    const content = table.querySelector('td:not(.ep-answer-prefix)');
    if (!prefix || !content) return;
    const number = prefix.textContent.match(/\d+(?=\.$)/)?.[0] || '1';
    const indent = Math.round(a.fontSize * (4.2 + 0.6 * number.length));
    const paragraph = document.createElement('p');
    paragraph.className = 'ep-word-question';
    paragraph.style.margin = `0 0 8px ${indent}px`;
    paragraph.style.textIndent = `-${indent}px`;
    paragraph.style.fontFamily = fontStack;
    paragraph.style.fontSize = `${a.fontSize}px`;
    paragraph.style.lineHeight = lineHeightPx;
    paragraph.appendChild(document.createTextNode(prefix.textContent));
    while (content.firstChild) paragraph.appendChild(content.firstChild);
    question.replaceWith(paragraph);
  });
  const body = paper.innerHTML;

  // ── Word HTML wrapper：套用使用者外觀偏好 ──────────────
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<meta name=ProgId content=Word.Document>
<!--[if gte mso 9]><xml><w:WordDocument>
<w:View>Print</w:View><w:Zoom>90</w:Zoom>
</w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size:${size.width}mm ${size.height}mm; margin:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
  div.Section1 { page:Section1; }
  body { margin:0; color:#000; }
  #epPaper { font-family:${fontStack}; font-size:${a.fontSize}px; line-height:${lineHeightPx}; color:#000; }
  .ep-exam-header { border:2px solid #333; padding:10px 14px; margin-bottom:14px; font-size:.94em; }
  .ep-exam-header .title-row { font-size:1.05em; font-weight:700; margin-bottom:6px; }
  .ep-exam-header .info-row { display:flex; gap:24px; }
  .ep-section-head { font-weight:700; margin:14px 0 8px; }
  .ep-q { margin-bottom:8px; page-break-inside:avoid; line-height:${lineHeightPx}; }
  .ep-q .q-no { font-weight:700; }
  .ep-word-question { page-break-inside:avoid; }
  .ep-q p { margin:0; line-height:${lineHeightPx}; }
  .ep-answer-blank { color:#888; margin-top:4px; }
</style>
</head><body><div class="Section1">${body}</div></body></html>`;

  const blob = new Blob(['\uFEFF' + wordHtml], { type:'application/msword;charset=utf-8' });
  const a2 = document.createElement('a');
  a2.href = URL.createObjectURL(blob);
  a2.download = `${title}.doc`;
  document.body.appendChild(a2); a2.click();
  document.body.removeChild(a2); URL.revokeObjectURL(a2.href);
}

// PDF 以預覽的試卷 HTML 製作，保留中文及瀏覽器中的視覺樣式。
export async function exportToPdf(examData, questions, paperKey = 'A4') {
  try {
    ensurePreviewModal();
    const html2pdf = await loadPdfLibrary();
    const appearance = loadAppearance();
    const margins = loadWordMargins();
    const size = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;
    const paper = document.createElement('div');
    paper.innerHTML = buildPaperHtml(examData, questions);
    const content = paper.firstElementChild;
    content.style.fontFamily = fontStackById(appearance.font);
    content.style.fontSize = `${appearance.fontSize}px`;
    content.style.lineHeight = appearance.lineHeight;
    content.style.color = '#000';
    content.style.background = '#fff';
    const filename = `${(examData.title || '試卷').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
    await html2pdf().set({
      margin: [margins.top, margins.right, margins.bottom, margins.left],
      filename,
      image: { type:'jpeg', quality:0.98 },
      html2canvas: { scale:2, useCORS:true, backgroundColor:'#fff' },
      jsPDF: { unit:'mm', format:[size.width, size.height], orientation:'portrait', compress:true },
      pagebreak: { mode:['css','legacy'], avoid:['.ep-q', '.ep-section-head'] }
    }).from(content).save();
  } catch (error) {
    console.error('PDF 匯出失敗', error);
    UI.toast(`PDF 下載失敗：${error.message || '請稍後再試'}`, 'danger');
  }
}
