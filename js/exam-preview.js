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
.ep-q{margin-bottom:8px}
.ep-q .q-no{font-weight:700}
.ep-opts{margin:3px 0 3px 2em}
.ep-tail{margin-left:1em}
.ep-answer-blank{color:#888;margin-top:4px}
</style>
<div class="modal-overlay hidden" id="epModal">
  <div class="modal" style="max-width:900px;width:96%;max-height:94vh;display:flex;flex-direction:column">
    <div class="modal-header" style="flex-shrink:0">
      <h3 id="epTitle" style="flex:1">試卷預覽</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="window._epOpenHeader()" title="編輯試卷表頭">✎ 表頭</button>
        <button class="btn btn-primary btn-sm" onclick="window._epDoExport()">⬇ 輸出 Word</button>
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
        <span class="info-pill" id="epFontHint">調整即時生效，並會套用到 Word 輸出</span>
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
    // 字型提示
    const hint = document.getElementById('epFontHint');
    if (hint) {
      if (a.font === 'kaiti') {
        hint.textContent = '⚠ 楷體依本機字型，沒安裝者會 fallback 到預設字型';
        hint.style.color = '#b54400';
      } else if (a.font === 'system') {
        hint.textContent = '系統預設字型 — 各裝置顯示可能不同';
        hint.style.color = 'var(--text-muted)';
      } else {
        hint.textContent = '透過 Google Fonts 載入，跨平台顯示一致';
        hint.style.color = 'var(--text-muted)';
      }
    }
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
  // 同步字型提示
  const hint = document.getElementById('epFontHint');
  if (hint) {
    if (a.font === 'kaiti') {
      hint.textContent = '⚠ 楷體依本機字型，沒安裝者會 fallback 到預設字型';
      hint.style.color = '#b54400';
    } else if (a.font === 'system') {
      hint.textContent = '系統預設字型 — 各裝置顯示可能不同';
      hint.style.color = 'var(--text-muted)';
    } else {
      hint.textContent = '透過 Google Fonts 載入，跨平台顯示一致';
      hint.style.color = 'var(--text-muted)';
    }
  }
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
  window._epDoExport   = () => exportToWord(examData, questions);
  window._epOpenHeader = () => showHeaderSettings();

  renderPaper(examData, questions);
  applyAppearance();
  document.getElementById('epModal').classList.remove('hidden');
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

  document.getElementById('epBody').innerHTML = html;
}

function renderQPreview(q, num, type) {
  let body = '';
  if (type === 'T1') {
    body = `（　）${num}.${q.text||''}`;
  } else if (type === 'T2') {
    const opts = q.options?.length
      ? `<div class="ep-opts">${q.options.map((o,i)=>`(${String.fromCharCode(65+i)})${o}`).join('　')}</div>` : '';
    if (q.tail) body = `${num}.${q.text||''}${opts}<div class="ep-tail">${q.tail}</div>`;
    else        body = `${num}.${q.text||''}${opts}`;
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
export function exportToWord(examData, questions) {
  const h          = loadHeader();
  const a          = loadAppearance();
  const subject    = buildSubjectLabel(examData);
  const typeScores = examData.typeScores || {};
  const grouped    = groupByType(questions);
  const types      = orderedTypes(grouped);

  const title       = examData.title || '試卷';
  const yearText    = h.year || '○○○';
  const semText     = h.semester || '○';
  const headerLine1 = [
    `${yearText}學年度第${semText}學期`,
    subject,
    h.grade,
    h.examType,
  ].filter(Boolean).join('　');

  let body = '';

  body += `<table border="1" cellspacing="0" cellpadding="6"
    style="width:100%;border-collapse:collapse;margin-bottom:10pt">
    <tr>
      <td colspan="4" style="font-weight:bold;text-align:left">
        ${headerLine1}
      </td>
    </tr>
    <tr>
      <td style="width:15%;font-weight:bold">班級</td>
      <td style="width:35%">　　　　　　</td>
      <td style="width:15%;font-weight:bold">姓名</td>
      <td style="width:35%">　　　　　　　</td>
    </tr>
    <tr>
      <td style="font-weight:bold">座號</td>
      <td>　　　　　　</td>
      ${h.school ? `<td style="font-weight:bold">學校</td><td>${h.school}</td>` : `<td colspan="2"></td>`}
    </tr>
    ${h.range ? `<tr><td style="font-weight:bold">範圍</td><td colspan="3">${h.range}</td></tr>` : ''}
  </table>`;

  types.forEach((type, secIdx) => {
    const qs    = grouped[type];
    const score = typeScores[type] || 2;
    const total = qs.length * score;
    body += `<p style="font-weight:bold;margin-top:10pt">${ROMANS[secIdx]}、${TYPE_LABELS[type]}（每題 ${score} 分，共 ${total} 分）</p>`;
    qs.forEach((q, i) => {
      const num = i + 1;
      if (type === 'T1') {
        body += `<p style="margin:3pt 0">（　）${num}.${q.text||''}</p>`;
      } else if (type === 'T2') {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
        if (q.options?.length) {
          body += `<p style="margin:2pt 0 2pt 2em">${q.options.map((o,i)=>`(${String.fromCharCode(65+i)})${o}`).join('　')}</p>`;
        }
        if (q.tail) body += `<p style="margin:2pt 0 2pt 1em">${q.tail}</p>`;
      } else if (type === 'T6') {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
        body += `<p style="margin:2pt 0;color:#555">答：</p><p>&nbsp;</p><p>&nbsp;</p>`;
      } else {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
      }
    });
  });

  body += `<p style="page-break-before:always;font-weight:bold;margin-bottom:8pt">【解答】</p>`;
  types.forEach((type, secIdx) => {
    const qs = grouped[type];
    body += `<p style="font-weight:bold;margin-top:6pt">${ROMANS[secIdx]}、${TYPE_LABELS[type]}</p>`;
    if (type === 'T6' || type === 'T5' || type === 'T4') {
      qs.forEach((q,i) => {
        body += `<p style="margin:3pt 0">${i+1}.${q.answer||''}</p>`;
        if (q.analysis) body += `<p style="margin:2pt 0 2pt 1.5em;color:#444">【解析】${q.analysis}</p>`;
      });
    } else {
      const row = qs.map((q,i) => `${i+1}.${q.answer||''}`).join('　　');
      body += `<p style="margin:3pt 0">${row}</p>`;
      qs.forEach((q,i) => {
        if (q.analysis) body += `<p style="margin:2pt 0 2pt 1.5em;color:#444">${i+1}.【解析】${q.analysis}</p>`;
      });
    }
    body += `<p>&nbsp;</p>`;
  });

  // ── Word HTML wrapper：套用使用者外觀偏好 ──────────────
  const fontStack = fontStackById(a.font);
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<meta name=ProgId content=Word.Document>
<!--[if gte mso 9]><xml><w:WordDocument>
<w:View>Print</w:View><w:Zoom>90</w:Zoom>
</w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size:210mm 297mm; margin:2cm 2.5cm; }
  body { font-family:${fontStack}; font-size:${a.fontSize}pt; line-height:${a.lineHeight}; div:Section1; }
  p    { margin:3pt 0; }
  table { border-collapse:collapse; width:100%; }
  td   { padding:5pt 8pt; }
</style>
</head><body>${body}</body></html>`;

  const blob = new Blob(['\uFEFF' + wordHtml], { type:'application/msword;charset=utf-8' });
  const a2 = document.createElement('a');
  a2.href = URL.createObjectURL(blob);
  a2.download = `${title}.doc`;
  document.body.appendChild(a2); a2.click();
  document.body.removeChild(a2); URL.revokeObjectURL(a2.href);
}
