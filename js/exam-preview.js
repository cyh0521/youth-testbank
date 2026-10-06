import { createDocxBlob } from './docx-export.js';

/**
 * 幼獅題庫系統 — 試卷預覽 & Word 輸出模組 v3
 * - 表頭設定獨立成 showHeaderSettings()
 * - 預覽試卷支援即時調整字型 / 字體大小 / 行距
 * - 預設表頭與外觀偏好儲存在使用者帳號
 */

const TYPE_ORDER  = ['T1','T2','T3','T4','T5','T6'];
const TYPE_LABELS = { T1:'是非題', T2:'選擇題', T3:'複選題', T4:'填空題', T5:'配合題', T6:'問答題' };
const ROMANS      = ['一','二','三','四','五','六','七','八'];

// ── 字型 / 字體大小 / 行距 預設與選項 ─────────────────
// 字型優先用 Google Fonts Web Font（跨平台一致），fallback 到本機相近字型
export const FONT_OPTIONS = [
  { id:'serif',  label:'明體（Noto Serif）',  stack:'"Noto Serif TC","新細明體","PMingLiU",serif' },
  { id:'sans',   label:'黑體（Noto Sans）',   stack:'"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif' },
  { id:'kaiti',  label:'楷體（依本機字型）',   stack:'"標楷體","DFKai-SB","BiauKai","cwTeXKai",serif' },
  { id:'system', label:'系統預設字型',        stack:'system-ui,-apple-system,"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif' },
];
export const FONT_SIZE_RANGE = { min: 11, max: 20, step: 1, default: 16 };
export const LINE_HEIGHT_RANGE = { min: 1.0, max: 2.4, step: 0.05, default: 1.3 };
export const HEADER_FIELDS = [
  { id:'school', label:'學校' }, { id:'year', label:'學年度與學期' },
  { id:'subject', label:'科目' }, { id:'examType', label:'試別' },
  { id:'range', label:'考試範圍' }, { id:'class', label:'班級' },
  { id:'name', label:'姓名' }, { id:'seat', label:'座號' },
];
export const DEFAULT_HEADER_LAYOUT = {
  school:{ row:1, position:1 }, year:{ row:1, position:2 }, subject:{ row:1, position:3 },
  examType:{ row:1, position:4 }, range:{ row:1, position:5 },
  class:{ row:2, position:1 }, name:{ row:2, position:2 }, seat:{ row:2, position:3 },
};
export function normalizeHeaderLayout(layout = {}) {
  const ordered = HEADER_FIELDS.map((field, index) => {
    const place = layout?.[field.id] || DEFAULT_HEADER_LAYOUT[field.id];
    const row = Number(place.row);
    return { id:field.id, index, row:row === 1 || row === 2 || row === 3 ? row : DEFAULT_HEADER_LAYOUT[field.id].row,
      position:Number(place.position) || DEFAULT_HEADER_LAYOUT[field.id].position };
  }).sort((a,b) => a.row - b.row || a.position - b.position || a.index - b.index);
  const counts = { 1:0, 2:0 };
  return Object.fromEntries(ordered.map(({id,row}) => {
    const targetRow = row === 1 ? 1 : 2;
    return [id, { row:targetRow, position:++counts[targetRow] }];
  }));
}

export const DEFAULT_WORD_MARGINS = { top:10, right:10, bottom:10, left:10 };
const PAPER_SIZES = {
  A3: { width:297, height:420 },
  A4: { width:210, height:297 },
  B4: { width:257, height:364 },
};
let docxLibraryPromise;
let appearanceSaveQueue = Promise.resolve();

function loadDocxLibrary() {
  if (window.docx?.Packer) return Promise.resolve(window.docx);
  if (!docxLibraryPromise) {
    docxLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/docx.iife.js', import.meta.url).href;
      script.onload = () => window.docx?.Packer ? resolve(window.docx) : reject(new Error('DOCX 元件載入失敗'));
      script.onerror = () => reject(new Error('DOCX 元件載入失敗'));
      document.head.appendChild(script);
    }).catch(error => { docxLibraryPromise = null; throw error; });
  }
  return docxLibraryPromise;
}

async function choosePaperLayout(format, chooseDestination = null) {
  try { await DataService.refreshExamPreferences(); }
  catch (error) { UI.toast(`無法取得最新列印設定：${error.message}`, 'danger'); return null; }
  let modal = document.getElementById('epPaperSizeModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay hidden" id="epPaperSizeModal" style="z-index:1300">
      <div class="modal ep-layout-modal">
        <div class="modal-header"><h3 id="epPaperSizeTitle">列印與下載設定</h3><button class="modal-close" type="button" id="epPaperSizeClose">✕</button></div>
        <div class="modal-body ep-layout-body">
          <fieldset class="ep-layout-fieldset"><legend>紙張大小</legend><div class="ep-layout-options ep-paper-options">
            ${Object.entries(PAPER_SIZES).map(([key, size]) => `<label class="ep-layout-option">
              <input type="radio" name="epPaperSize" value="${key}"><span class="ep-layout-visual"><span class="ep-paper-icon ep-paper-${key.toLowerCase()}"><i></i><i></i><i></i></span></span><strong>${key}${key.startsWith('B') ? '（JIS）' : ''}</strong><small>${size.width} × ${size.height} mm</small>
            </label>`).join('')}
          </div></fieldset>
          <fieldset class="ep-layout-fieldset"><legend>列印欄數</legend><div class="ep-layout-options ep-column-options">
            ${[1, 2].map(count => `<label class="ep-layout-option"><input type="radio" name="epPaperColumns" value="${count}"><span class="ep-layout-visual"><span class="ep-column-icon ep-column-${count}"><i></i><i></i><i></i><i></i><i></i><i></i></span></span><strong>${count === 1 ? '單欄' : '雙欄'}</strong><small>${count === 1 ? '題目使用整頁寬度' : '題目由左欄接續右欄'}</small></label>`).join('')}
          </div></fieldset>
        </div>
        <div class="modal-footer"><button class="btn btn-ghost" type="button" id="epPaperSizeCancel">取消</button><button class="btn btn-primary" type="button" id="epPaperSizeConfirm">確定</button></div>
      </div></div>`);
    modal = document.getElementById('epPaperSizeModal');
  }
  document.getElementById('epPaperSizeTitle').textContent = format === '列印' ? '列印設定' : '下載檔案設定';
  document.getElementById('epPaperSizeConfirm').textContent = format === '列印' ? '列印' : '下載';
  const saved = DataService.getExamPreferences().paperLayout || {};
  modal.querySelector(`input[name="epPaperSize"][value="${PAPER_SIZES[saved.paperKey] ? saved.paperKey : 'A4'}"]`).checked = true;
  modal.querySelector(`input[name="epPaperColumns"][value="${saved.columns === 2 ? '2' : '1'}"]`).checked = true;
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
    document.getElementById('epPaperSizeConfirm').onclick = async () => {
      const confirm = document.getElementById('epPaperSizeConfirm');
      confirm.disabled = true;
      const paperKey = modal.querySelector('input[name="epPaperSize"]:checked').value;
      const columns = Number(modal.querySelector('input[name="epPaperColumns"]:checked').value);
      let fileHandle;
      if (chooseDestination) {
        try { fileHandle = await chooseDestination(); }
        catch (error) {
          if (error.name !== 'AbortError') UI.toast(`無法選擇存放位置：${error.message}`, 'danger');
          confirm.disabled = false;
          return;
        }
      }
      try {
        await DataService.refreshExamPreferences();
        await DataService.updateExamPreferences({ paperLayout:{ paperKey, columns } });
      }
      catch (error) { UI.toast(`列印與下載設定儲存失敗：${error.message}`, 'danger'); confirm.disabled = false; return; }
      confirm.disabled = false;
      close({ paperKey, columns, fileHandle });
    };
  });
}

export async function downloadExam(examData, questions, format) {
  if (format !== 'Word') throw new Error('不支援的下載格式');
  if (!window.showSaveFilePicker) {
    UI.toast('請使用支援另存新檔的 Chrome 或 Edge，並透過 HTTPS 或 localhost 開啟網站', 'warning');
    return;
  }
  const layout = await choosePaperLayout(format, () => window.showSaveFilePicker({
    id:'exam-downloads',
    suggestedName:`${(examData.title || '試卷').replace(/[\\/:*?"<>|]/g, '_')}.docx`,
    types:[{ description:'Word 文件', accept:{ 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'] } }],
  }));
  if (!layout) return;
  await exportToWord(examData, questions, layout.paperKey, layout.columns, layout.fileHandle);
}

function confirmPrintSettings() {
  let modal = document.getElementById('epPrintReminder');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay hidden" id="epPrintReminder" style="z-index:1300"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="epPrintReminderTitle"><div class="modal-header"><h3 id="epPrintReminderTitle">列印設定提醒</h3><button type="button" class="modal-close" id="epPrintReminderClose" aria-label="關閉列印提醒">✕</button></div><div class="modal-body"><p>請在瀏覽器列印視窗中調整設定：</p><ul style="padding-left:1.5em;line-height:1.8"><li>選擇要列印的紙張大小。</li><li>設定「頁首及首尾」、「雙面列印」等選項。</li><li>將「邊界」設為「預設值」，以套用頁邊距設定。</li><li>將「縮放比例」設為 100%。</li></ul></div><div class="modal-footer"><button type="button" class="btn btn-ghost" id="epPrintReminderCancel">取消</button><button type="button" class="btn btn-primary" id="epPrintReminderConfirm">繼續列印</button></div></div></div>`);
    modal = document.getElementById('epPrintReminder');
  }
  const previousFocus = document.activeElement;
  modal.classList.remove('hidden');
  return new Promise(resolve => {
    const close = accepted => {
      modal.classList.add('hidden');
      document.getElementById('epPrintReminderClose').onclick = null;
      document.getElementById('epPrintReminderCancel').onclick = null;
      document.getElementById('epPrintReminderConfirm').onclick = null;
      modal.removeEventListener('keydown', onKeydown);
      previousFocus?.focus();
      resolve(accepted);
    };
    const onKeydown = event => { if (event.key === 'Escape') close(false); };
    modal.addEventListener('keydown', onKeydown);
    document.getElementById('epPrintReminderClose').onclick = () => close(false);
    document.getElementById('epPrintReminderCancel').onclick = () => close(false);
    document.getElementById('epPrintReminderConfirm').onclick = () => close(true);
    document.getElementById('epPrintReminderConfirm').focus();
  });
}

export async function printWithPaperChoice(examData, questions) {
  try { await DataService.refreshExamPreferences(); }
  catch (error) { UI.toast(`無法取得最新列印設定：${error.message}`, 'danger'); return; }
  if (await confirmPrintSettings()) printExam(examData, questions);
}

export function loadWordMargins() {
  const saved = DataService.getExamPreferences().margins || {};
  return Object.fromEntries(Object.entries(DEFAULT_WORD_MARGINS).map(([side, fallback]) => {
    const value = Number(saved[side]);
    return [side, Number.isFinite(value) && value >= 5 && value <= 50 ? value : fallback];
  }));
}

export async function saveWordMargins(values) {
  const margins = {};
  for (const side of Object.keys(DEFAULT_WORD_MARGINS)) {
    const value = Number(values[side]);
    if (!Number.isFinite(value) || value < 5 || value > 50) throw new Error('頁邊距需介於 5 至 50 mm');
    margins[side] = value;
  }
  await DataService.updateExamPreferences({ margins });
}

export async function resetWordMargins() {
  await DataService.updateExamPreferences({ margins:{ ...DEFAULT_WORD_MARGINS } });
}

// ══════════════════════════════════════════════════════════
//  讀寫表頭 / 外觀偏好
// ══════════════════════════════════════════════════════════
export function loadHeader() {
  return DataService.getExamPreferences().header || {};
}
export function newExamHeader() {
  return { layout: normalizeHeaderLayout(loadHeader().layout) };
}
export async function saveHeader(d) {
  await DataService.updateExamPreferences({ header:{ ...loadHeader(), ...d } });
}

export const HEADER_BLANK_DEFAULTS = { class:8, name:8, seat:0 };
export const HEADER_BLANK_LABELS = { class:'班級：', name:'姓名：', seat:'座號：' };
export function headerYearSemesterText(data) {
  if (data.yearSemesterText != null) return data.yearSemesterText === '○○○學年度第○學期' ? '' : data.yearSemesterText;
  return data.year && data.year !== '○○○' ? `${data.year}學年度第${data.semester || '○'}學期` : '';
}
export function headerBlankParts(data, field) {
  const storedText = data[`${field}Text`];
  const raw = String(storedText ?? `${HEADER_BLANK_LABELS[field]}${'＿'.repeat(HEADER_BLANK_DEFAULTS[field])}`);
  const trailing = raw.match(/[＿_]+$/)?.[0].length || 0;
  const savedLength = data[`${field}Length`];
  const length = savedLength === undefined || savedLength === null || savedLength === ''
    ? storedText == null ? HEADER_BLANK_DEFAULTS[field] : trailing
    : Number(savedLength) || 0;
  return { text:HEADER_BLANK_LABELS[field], length:Math.max(0, Math.min(12, length)) };
}

// 舊版字型 id → 新版對應（相容處理：使用者上次選的 mingti/heiti 還能正常還原）
const FONT_ID_MIGRATION = {
  mingti: 'serif',
  heiti:  'sans',
};

export function loadAppearance() {
  const a = DataService.getExamPreferences().appearance || {};
  let font = a.font || 'system';
  if (FONT_ID_MIGRATION[font]) font = FONT_ID_MIGRATION[font];
  // 若 id 已不存在於選項中（更新後遺留），回到預設
  if (!FONT_OPTIONS.find(f => f.id === font)) font = 'system';
  return {
    font,
    fontSize:   Number(a.fontSize) >= FONT_SIZE_RANGE.min && Number(a.fontSize) <= FONT_SIZE_RANGE.max ? Number(a.fontSize) : FONT_SIZE_RANGE.default,
    lineHeight: Number(a.lineHeight) >= LINE_HEIGHT_RANGE.min && Number(a.lineHeight) <= LINE_HEIGHT_RANGE.max ? Number(a.lineHeight) : LINE_HEIGHT_RANGE.default,
  };
}
export async function saveAppearance(d) {
  await DataService.updateExamPreferences({ appearance:d });
}

function examAppearance(examData) {
  return examData.appearance ??= { ...loadAppearance() };
}

export function fontStackById(id) {
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
function orderedTypes(g, typeOrder) {
  const order = Array.isArray(typeOrder) ? [...new Set([...typeOrder, ...TYPE_ORDER])] : TYPE_ORDER;
  return [...order.filter(t => g[t]?.length), ...Object.keys(g).filter(t => !order.includes(t) && g[t]?.length)];
}


// ══════════════════════════════════════════════════════════
//  ❶  獨立 Modal：試卷表頭設定
// ══════════════════════════════════════════════════════════
function ensureHeaderModal() {
  if (document.getElementById('hdModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay hidden" id="hdModal" style="z-index:1100">
  <div class="modal" style="max-width:760px;width:96%;max-height:94vh;display:flex;flex-direction:column">
    <div class="modal-header">
      <h3>試卷表頭設定</h3>
      <button class="modal-close" onclick="document.getElementById('hdModal').classList.add('hidden')">✕</button>
    </div>
    <div class="modal-body" style="padding:16px 20px;overflow-y:auto">
      <p style="font-size:.9rem;color:var(--text-muted);margin-bottom:14px">
        於此設定試卷上方表頭資訊。空白欄位的範例不會輸出；設定會套用到預覽、列印、Word。
      </p>
      <div class="grid-2">
        <div class="form-group"><label class="form-label" for="hdSchool">學校</label><input class="form-control header-example-input" id="hdSchool" placeholder="例：幼獅高中"></div>
        <div class="form-group"><label class="form-label" for="hdYearSemesterText">學年度與學期</label><input class="form-control header-example-input" id="hdYearSemesterText" placeholder="例：115學年度上學期"></div>
        <div class="form-group"><label class="form-label" for="hdExamType">試別</label><input class="form-control header-example-input" id="hdExamType" placeholder="例：第一次段考"></div>
        <div class="form-group"><label class="form-label" for="hdSubjectText">科目</label><input class="form-control header-example-input" id="hdSubjectText" placeholder="例：全民國防教育"></div>
        <div class="form-group"><label class="form-label" for="hdRange">考試範圍</label><input class="form-control header-example-input" id="hdRange" placeholder="例：第1-3章"></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
          ${Object.entries(HEADER_BLANK_LABELS).map(([field,label]) => `<div class="form-group"><label class="form-label" for="hdLength-${field}">${label.replace('：','')}欄</label><select class="form-control" id="hdLength-${field}" aria-label="${label}空格數">${Array.from({length:13}, (_,count) => `<option value="${count}">${count} 格</option>`).join('')}</select></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="document.getElementById('hdModal').classList.add('hidden')">取消</button>
      <button class="btn btn-outline" id="hdResetBtn">清除表頭文字</button>
      <button class="btn btn-primary" id="hdSaveBtn">儲存</button>
    </div>
  </div>
</div>`);

  document.getElementById('hdSaveBtn').onclick = async () => {
    const data = readHeaderForm();
    try {
      if (headerModalExam) {
        const header = { ...(headerModalExam.header ?? loadHeader()), ...data };
        if (headerModalExam.id) await DataService.saveExam({ id:headerModalExam.id, header });
        headerModalExam.header = header;
      } else await saveHeader(data);
    } catch (error) { UI.toast(`表頭儲存失敗：${error.message}`, 'danger'); return; }
    document.getElementById('hdModal').classList.add('hidden');
    UI.toast('表頭資訊已儲存', 'success');
    // 若預覽 modal 開著，立即更新
    if (window._epRefresh) window._epRefresh();
  };
  document.getElementById('hdResetBtn').onclick = async () => {
    if (!confirm('確定要清除這些表頭文字？')) return;
    const defaults = { school:'', yearSemesterText:'', examType:'', subjectText:'', range:'',
      classLength:HEADER_BLANK_DEFAULTS.class, nameLength:HEADER_BLANK_DEFAULTS.name, seatLength:HEADER_BLANK_DEFAULTS.seat,
      classText:HEADER_BLANK_LABELS.class, nameText:HEADER_BLANK_LABELS.name, seatText:HEADER_BLANK_LABELS.seat };
    try {
      if (headerModalExam) {
        const header = { ...(headerModalExam.header ?? loadHeader()), ...defaults };
        if (headerModalExam.id) await DataService.saveExam({ id:headerModalExam.id, header });
        headerModalExam.header = header;
      } else await saveHeader(defaults);
    } catch (error) { UI.toast(`表頭重設失敗：${error.message}`, 'danger'); return; }
    fillHeaderForm(defaults);
    if (window._epRefresh) window._epRefresh();
    UI.toast('已清除', 'info');
  };
}

function readHeaderForm() {
  return {
    school:   (document.getElementById('hdSchool').value   || '').trim(),
    yearSemesterText: (document.getElementById('hdYearSemesterText').value || '').trim(),
    examType: (document.getElementById('hdExamType').value || '').trim(),
    subjectText: (document.getElementById('hdSubjectText').value || '').trim(),
    range:    (document.getElementById('hdRange').value    || '').trim(),
    ...Object.fromEntries(Object.keys(HEADER_BLANK_LABELS).flatMap(field => [
      [`${field}Length`, Number(document.getElementById(`hdLength-${field}`).value)],
      [`${field}Text`, HEADER_BLANK_LABELS[field]],
    ])),
  };
}
function fillHeaderForm(d) {
  document.getElementById('hdSchool').value   = d.school   || '';
  document.getElementById('hdYearSemesterText').value = headerYearSemesterText(d);
  document.getElementById('hdExamType').value = d.examType || '';
  document.getElementById('hdSubjectText').value = d.subjectText || '';
  document.getElementById('hdRange').value    = d.range    || '';
  for (const field of Object.keys(HEADER_BLANK_LABELS)) {
    document.getElementById(`hdLength-${field}`).value = headerBlankParts(d, field).length;
  }
}

let headerModalExam = null;
export function showHeaderSettings(examData = null) {
  ensureHeaderModal();
  headerModalExam = examData;
  fillHeaderForm(headerModalExam?.header ?? loadHeader());
  document.getElementById('hdModal').classList.remove('hidden');
}

export function mountInlineHeaderEditor(container, examData, onChange, onCancel) {
  const fields = [
    ['school','學校','例：幼獅高中'],
    ['yearSemesterText','學年度與學期','例：115學年度上學期'],
    ['examType','試別','例：第一次段考'],
    ['subjectText','科目','例：全民國防教育'],
    ['range','考試範圍','例：第1-3章'],
  ];
  const header = examData.header ?? loadHeader();
  let savedHeader = { ...header };
  container.innerHTML = `<div class="ep-inline-header-fields">
    ${fields.map(([key,label,placeholder]) => `<label class="form-group"><span class="form-label">${label}</span><input class="form-control header-example-input" data-header-field="${key}" placeholder="${placeholder}"></label>`).join('')}
    <div class="ep-inline-header-lengths">${Object.entries(HEADER_BLANK_LABELS).map(([field,label]) => `<label class="form-group"><span class="form-label">${label.replace('：','')}欄</span><select class="form-control" data-header-length="${field}">${Array.from({length:13}, (_,n) => `<option value="${n}">${n} 格</option>`).join('')}</select></label>`).join('')}</div>
  </div><button class="ep-header-layout-toggle" type="button" data-header-layout-toggle aria-expanded="false"><span class="ep-header-layout-toggle-icon" aria-hidden="true">↕</span><span class="ep-header-layout-toggle-copy"><strong>調整欄位位置</strong><small>點此展開，可拖曳欄位到第一行或第二行</small></span><span class="ep-header-layout-toggle-chevron" data-layout-chevron aria-hidden="true">▾</span></button>
  <div class="ep-header-layout-panel" data-header-layout-panel hidden><p>拖曳欄位到第一行或第二行，變更會立即顯示在表頭。</p>
    <div class="ep-header-layout-board">${[1,2].map(row => `<div class="ep-header-layout-line"><strong>第 ${row} 行</strong><div class="ep-header-layout-zone" data-row="${row}" aria-label="第 ${row} 行欄位"></div></div>`).join('')}</div>
  </div><div class="ep-inline-header-actions"><button class="btn btn-primary btn-sm" type="button" data-header-save>儲存變更</button><button class="btn btn-outline btn-sm" type="button" data-header-clear>清除</button><button class="btn btn-ghost btn-sm" type="button" data-header-cancel>取消</button><span data-header-status role="status" aria-live="polite"></span></div>`;
  for (const [key] of fields) container.querySelector(`[data-header-field="${key}"]`).value = key === 'yearSemesterText' ? headerYearSemesterText(header) : header[key] || '';
  for (const field of Object.keys(HEADER_BLANK_LABELS)) container.querySelector(`[data-header-length="${field}"]`).value = headerBlankParts(header, field).length;
  const layoutToggle = container.querySelector('[data-header-layout-toggle]');
  const layoutPanel = container.querySelector('[data-header-layout-panel]');
  layoutToggle.onclick = () => {
    layoutPanel.hidden = !layoutPanel.hidden;
    layoutToggle.setAttribute('aria-expanded', String(!layoutPanel.hidden));
    layoutToggle.querySelector('[data-layout-chevron]').textContent = layoutPanel.hidden ? '▾' : '▴';
  };
  const zones = Object.fromEntries([1,2].map(row => [row, layoutPanel.querySelector(`.ep-header-layout-zone[data-row="${row}"]`)]));
  const layout = normalizeHeaderLayout(header.layout);
  HEADER_FIELDS.slice().sort((a,b) => layout[a.id].row - layout[b.id].row || layout[a.id].position - layout[b.id].position)
    .forEach(field => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ep-header-layout-chip';
      chip.draggable = true;
      chip.dataset.field = field.id;
      chip.textContent = field.label;
      chip.title = `拖曳「${field.label}」調整位置`;
      zones[layout[field.id].row].appendChild(chip);
    });
  const board = layoutPanel.querySelector('.ep-header-layout-board');
  let draggedChip = null;
  const placeholder = document.createElement('span');
  placeholder.className = 'ep-header-layout-placeholder';
  const finishDrag = () => {
    draggedChip?.classList.remove('dragging');
    draggedChip = null;
    placeholder.remove();
    Object.values(zones).forEach(zone => zone.classList.remove('is-target'));
  };
  board.addEventListener('dragstart', event => {
    const chip = event.target.closest('.ep-header-layout-chip');
    if (!chip) return;
    draggedChip = chip;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', chip.dataset.field);
    chip.classList.add('dragging');
  });
  board.addEventListener('dragover', event => {
    const zone = event.target.closest('.ep-header-layout-zone');
    if (!draggedChip || !zone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    Object.values(zones).forEach(item => item.classList.toggle('is-target', item === zone));
    const before = [...zone.querySelectorAll('.ep-header-layout-chip:not(.dragging)')].find(chip => {
      const rect = chip.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2 || (event.clientY <= rect.bottom && event.clientX < rect.left + rect.width / 2);
    });
    zone.insertBefore(placeholder, before || null);
  });
  board.addEventListener('drop', event => {
    const zone = event.target.closest('.ep-header-layout-zone');
    if (!draggedChip || !zone) return;
    event.preventDefault();
    zone.insertBefore(draggedChip, placeholder);
    finishDrag();
    examData.header = { ...examData.header, layout:Object.fromEntries([1,2].flatMap(row =>
      [...zones[row].querySelectorAll('.ep-header-layout-chip')].map((chip, index) =>
        [chip.dataset.field, { row, position:index+1 }])))};
    onChange?.();
    const status = container.querySelector('[data-header-status]');
    if (status) status.textContent = '尚未儲存';
  });
  board.addEventListener('dragend', finishDrag);
  const update = () => {
    const data = Object.fromEntries(fields.map(([key]) => [key, container.querySelector(`[data-header-field="${key}"]`).value]));
    for (const field of Object.keys(HEADER_BLANK_LABELS)) {
      data[`${field}Length`] = Number(container.querySelector(`[data-header-length="${field}"]`).value);
      data[`${field}Text`] = HEADER_BLANK_LABELS[field];
    }
    examData.header = { ...examData.header, ...data };
    onChange?.();
    const status = container.querySelector('[data-header-status]');
    if (status) status.textContent = '尚未儲存';
  };
  container.querySelectorAll('input').forEach(input => input.addEventListener('input', update));
  container.querySelectorAll('select').forEach(select => select.addEventListener('change', update));
  container.querySelector('[data-header-clear]').onclick = () => {
    for (const [key] of fields) container.querySelector(`[data-header-field="${key}"]`).value = '';
    for (const field of Object.keys(HEADER_BLANK_LABELS)) container.querySelector(`[data-header-length="${field}"]`).value = HEADER_BLANK_DEFAULTS[field];
    update();
  };
  container.querySelector('[data-header-cancel]').onclick = () => {
    examData.header = { ...savedHeader };
    onChange?.();
    onCancel?.();
  };
  const save = container.querySelector('[data-header-save]');
  const clear = container.querySelector('[data-header-clear]');
  const cancel = container.querySelector('[data-header-cancel]');
  save.onclick = async () => {
    const controls = [...container.querySelectorAll('input,select')];
    save.disabled = clear.disabled = cancel.disabled = true;
    controls.forEach(control => { control.disabled = true; });
    try {
      if (examData.id) await DataService.saveExam({ id:examData.id, header:examData.header });
      savedHeader = { ...examData.header };
      examData.onHeaderSaved?.();
      if (examData.id) document.dispatchEvent(new CustomEvent('exam-header-saved', {
        detail:{ id:examData.id, header:{ ...examData.header }, source:examData }
      }));
      container.querySelector('[data-header-status]').textContent = examData.id ? '已儲存至此試卷' : '已套用至目前草稿';
      onCancel?.();
    } catch (error) { container.querySelector('[data-header-status]').textContent = `儲存失敗：${error.message}`; }
    finally {
      save.disabled = clear.disabled = cancel.disabled = false;
      controls.forEach(control => { control.disabled = false; });
    }
  };
}


// ══════════════════════════════════════════════════════════
//  ❷  Modal：試卷預覽（含外觀調整）
// ══════════════════════════════════════════════════════════
function ensurePreviewModal() {
  if (document.getElementById('epModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<style>
/* 預覽視窗大小 */
.ep-preview-modal{max-width:900px;width:96%;max-height:94vh;display:flex;flex-direction:column}
#epModal.is-fullscreen{left:var(--sidebar-width);padding:0}
.sidebar-collapsed #epModal.is-fullscreen{left:var(--sidebar-collapsed-width)}
#epModal.is-fullscreen .ep-preview-modal{width:100%;max-width:none;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;border:0;border-radius:0}
#epModal .ep-fullscreen-icon-restore{display:none}
#epModal.is-fullscreen .ep-fullscreen-icon-expand{display:none}
#epModal.is-fullscreen .ep-fullscreen-icon-restore{display:block}
/* 外觀調整工具列 */
.ep-toolbar{
  display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  padding:10px 16px;background:#f5f3ee;border:1px solid #e0dcd2;
  border-radius:6px;margin-bottom:14px;font-size:.88rem;
}
.ep-toolbar .group{display:flex;align-items:center;gap:6px}
.ep-toolbar .group label{color:var(--text-secondary);white-space:nowrap}
.ep-toolbar select,.ep-toolbar input[type=range]{font-size:.88rem}
.ep-toolbar .val{font-family:var(--font-mono);font-size:.86rem;color:var(--text-muted);min-width:36px;text-align:right}
.ep-toolbar .info-pill{
  margin-left:auto;font-size:.85rem;color:var(--text-muted);
}
.ep-preview-options{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.ep-preview-options label{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#fff;border:1px solid #b9cadc;border-radius:5px;color:#244566;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s}
.ep-preview-options label:hover{border-color:#3974c7;background:#f7fbff}
.ep-preview-options label:has(input:checked){background:#dcecff;border-color:#3974c7;box-shadow:inset 0 0 0 1px #3974c7}
.ep-preview-options label:has(input:focus-visible){outline:2px solid #3974c7;outline-offset:2px}
.ep-preview-options input{width:16px;height:16px;margin:0;accent-color:#3974c7}
/* 試卷區 */
#epPaper{color:#000;padding:0 4px}
.ep-exam-header{border:0;border-bottom:2px solid #333;padding:10px 14px;margin-bottom:14px;font-size:.94em;line-height:1.6}
.ep-exam-header .ep-header-row{display:flex;flex-wrap:wrap;gap:4px 20px}
.ep-exam-header .ep-header-row span{white-space:pre-wrap}
.ep-exam-header .ep-header-row + .ep-header-row{margin-top:6px}
.ep-exam-header .title-row{font-size:1.05em;font-weight:700;column-gap:.5em}
.ep-section-head{font-weight:700;margin:14px 0 8px}
.ep-q{margin-bottom:8px;line-height:inherit;text-align:left}
.ep-q .q-no{font-weight:700}
.ep-answer-table{width:100%;border:0;border-collapse:collapse;table-layout:auto;font:inherit;line-height:inherit}
.ep-answer-table td{border:0;padding:0;vertical-align:top;font:inherit;line-height:inherit}
.ep-answer-table .ep-answer-prefix{width:1%;white-space:nowrap}
.ep-answer-table td:not(.ep-answer-prefix){text-align:left}
.ep-q p,.ep-answer-table p{margin:0;line-height:inherit}
.ep-answer-blank{color:#888;margin-top:4px}
.ep-essay-blank{min-height:2lh;margin-top:4px}
.ep-labeled-answer{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:start}
.ep-labeled-answer .ep-answer-value{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
#epBody .ep-answer-blank{color:#555}
#epBody .ep-answer-slot{display:inline-flex;align-items:center;width:4em;white-space:nowrap;color:#000}
#epBody .ep-answer-slot .ep-answer-value{display:inline-block;width:2em;text-align:center}
#epBody .ep-answer-value,#epBody .ep-labeled-answer .ep-answer-label{color:#b4232c;font-weight:400}
#epBody .ep-q-difficulty{display:inline-block;padding:2px 6px;margin-right:6px;border-radius:5px;background:#edf1f6;color:#526780;font-size:.75em;font-weight:600;line-height:1.4;vertical-align:middle;white-space:nowrap}
#epBody .ep-q-difficulty.is-hard{background:#fff0e5;color:#a34d17}
#epBody .ep-q-difficulty.is-easy{background:#e3f3ec;color:#237553}
#epBody .ep-q-source{color:#27734c;white-space:nowrap}
#epBody .ep-q-analysis{display:flex;margin:2px 0 0;color:#245fa5;font-size:.9em;text-align:left}
#epBody .ep-analysis-label{flex:none}
#epBody .ep-analysis-text{min-width:0}
</style>
<div class="modal-overlay hidden" id="epModal">
  <div class="modal ep-preview-modal">
    <div class="modal-header" style="flex-shrink:0">
      <h3 id="epTitle" style="flex:1">試卷預覽</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm ep-panel-toggle" type="button" id="epHeaderToggle" aria-expanded="false" aria-controls="epHeaderPanel" title="編輯試卷表頭"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>試卷表頭</button>
        <button class="btn btn-ghost btn-sm ep-panel-toggle" type="button" id="epAppearanceToggle" aria-expanded="false" aria-controls="epToolbar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h11M4 17h16"/><circle cx="18" cy="12" r="2"/></svg>字體與行距</button>
        <button class="btn btn-ghost btn-sm" onclick="window._epDoPrint()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>列印</button>
        <button class="btn btn-ghost btn-sm" onclick="window._epDoExport()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>下載</button>
        <button class="btn btn-ghost btn-sm" id="epFullscreenToggle" type="button" onclick="window._epToggleFullscreen()" aria-pressed="false" aria-label="放大視窗" title="放大視窗"><svg class="ep-fullscreen-icon-expand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg><svg class="ep-fullscreen-icon-restore" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg><span id="epFullscreenLabel">放大</span></button>
        <button class="modal-close" onclick="window._epClose()">✕</button>
      </div>
    </div>
    <div style="padding:14px 20px 0;flex-shrink:0">
      <div class="ep-inline-header hidden" id="epHeaderPanel"></div>
      <div class="ep-toolbar hidden" id="epToolbar">
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
      <div class="ep-preview-options" role="group" aria-label="預覽內容">
        <label><input type="checkbox" id="epShowAnswers">解答</label>
        <label><input type="checkbox" id="epShowAnalysis">解析</label>
        <label><input type="checkbox" id="epShowSource">頁數</label>
        <label><input type="checkbox" id="epShowDifficulty">難易度</label>
      </div>
    </div>
    <div id="epBody" style="padding:0 20px 20px;overflow-y:auto;flex:1;overscroll-behavior:contain"></div>
  </div>
</div>`);

  // 外觀控制事件
  window._epToggleFullscreen = () => {
    setPreviewFullscreen(!document.getElementById('epModal').classList.contains('is-fullscreen'));
  };
  const fontSel  = document.getElementById('epFont');
  const sizeRng  = document.getElementById('epFontSize');
  const sizeVal  = document.getElementById('epFontSizeVal');
  const lineRng  = document.getElementById('epLineHeight');
  const lineVal  = document.getElementById('epLineHeightVal');
  const appearanceToggle = document.getElementById('epAppearanceToggle');
  const toolbar = document.getElementById('epToolbar');
  appearanceToggle.addEventListener('click', () => {
    const expanded = !toolbar.classList.toggle('hidden');
    appearanceToggle.setAttribute('aria-expanded', String(expanded));
  });
  const headerToggle = document.getElementById('epHeaderToggle');
  headerToggle.addEventListener('click', () => {
    const panel = document.getElementById('epHeaderPanel');
    const expanded = !panel.classList.toggle('hidden');
    headerToggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) mountInlineHeaderEditor(panel, window._epExamData, window._epRefresh, () => {
      panel.classList.add('hidden');
      headerToggle.setAttribute('aria-expanded', 'false');
    });
  });

  const onAppearChange = () => {
    const a = {
      font:       fontSel.value,
      fontSize:   +sizeRng.value,
      lineHeight: +lineRng.value,
    };
    sizeVal.textContent = a.fontSize + 'px';
    lineVal.textContent = a.lineHeight.toFixed(2);
    window._epExamData.appearance = a;
    applyAppearance();
  };
  fontSel.addEventListener('change', onAppearChange);
  sizeRng.addEventListener('input',  onAppearChange);
  lineRng.addEventListener('input',  onAppearChange);
  const persistAppearance = () => {
    const exam = window._epExamData;
    if (!exam?.id) return;
    const appearance = { ...exam.appearance };
    appearanceSaveQueue = appearanceSaveQueue.catch(() => {}).then(async () => {
      try {
        await DataService.saveExam({ id:exam.id, appearance });
        exam.onAppearanceSaved?.();
      } catch (error) { UI.toast(`試卷版面儲存失敗：${error.message}`, 'danger'); }
    });
  };
  fontSel.addEventListener('change', persistAppearance);
  sizeRng.addEventListener('change', persistAppearance);
  lineRng.addEventListener('change', persistAppearance);

  document.getElementById('epAppearReset').onclick = () => {
    fontSel.value = 'system';
    sizeRng.value = FONT_SIZE_RANGE.default;
    lineRng.value = LINE_HEIGHT_RANGE.default;
    onAppearChange();
    persistAppearance();
  };
  ['epShowAnswers', 'epShowAnalysis', 'epShowSource', 'epShowDifficulty'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => window._epRefresh?.());
  });
}

function setPreviewFullscreen(fullscreen) {
  document.getElementById('epModal').classList.toggle('is-fullscreen', fullscreen);
  const button = document.getElementById('epFullscreenToggle');
  button.setAttribute('aria-pressed', String(fullscreen));
  button.setAttribute('aria-label', fullscreen ? '還原視窗' : '放大視窗');
  button.title = fullscreen ? '還原視窗' : '放大視窗';
  document.getElementById('epFullscreenLabel').textContent = fullscreen ? '還原' : '放大';
}

function previewDisplay() {
  return {
    answers: document.getElementById('epShowAnswers')?.checked ?? false,
    analysis: document.getElementById('epShowAnalysis')?.checked ?? false,
    source: document.getElementById('epShowSource')?.checked ?? false,
    difficulty: document.getElementById('epShowDifficulty')?.checked ?? false,
  };
}

// 套用目前試卷的外觀設定
function applyAppearance() {
  const a = examAppearance(window._epExamData);
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
  setPreviewFullscreen(false);
  if (!examData.booklet) examData.header ??= loadHeader();
  document.getElementById('epHeaderToggle').classList.toggle('hidden', !!examData.booklet);
  document.querySelector('#epShowSource').parentElement.lastChild.textContent = examData.booklet ? '出處' : '頁數';
  examAppearance(examData);
  document.getElementById('epToolbar').classList.add('hidden');
  document.getElementById('epAppearanceToggle').setAttribute('aria-expanded', 'false');
  document.getElementById('epHeaderPanel').classList.add('hidden');
  document.getElementById('epHeaderToggle').setAttribute('aria-expanded', 'false');

  document.getElementById('epTitle').textContent = `預覽：${examData.title || '試卷'}`;

  window._epExamData   = examData;
  window._epQuestions  = questions;
  document.getElementById('epShowAnswers').checked = examData.booklet ? (examData.display?.answers ?? true) : false;
  document.getElementById('epShowAnalysis').checked = examData.booklet ? (examData.display?.analysis ?? true) : false;
  document.getElementById('epShowSource').checked = examData.booklet ? (examData.display?.source ?? true) : false;
  document.getElementById('epShowDifficulty').checked = examData.booklet ? (examData.display?.difficulty ?? true) : false;
  window._epRefresh    = () => { const display = previewDisplay(); if (examData.booklet) examData.display = display; renderPaper(examData, questions, display); applyAppearance(); };
  window._epDoPrint    = () => printWithPaperChoice(examData, questions);
  window._epDoExport   = () => downloadExam(examData, questions, 'Word');
  window._epClose = () => {
    setPreviewFullscreen(false);
    document.getElementById('epModal').classList.add('hidden');
    examData.onPreviewClose?.();
  };

  renderPaper(examData, questions, previewDisplay());
  applyAppearance();
  document.getElementById('epModal').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════
//  直接列印（使用與預覽相同的表頭、字型與版面）
// ══════════════════════════════════════════════════════════
export function printExam(examData, questions) {
  ensurePreviewModal();
  const paper = document.createElement('div');
  paper.innerHTML = buildPaperHtml(examData, questions);
  const appearance = examAppearance(examData);
  const printContent = paper.firstElementChild;
  printContent.style.fontFamily = fontStackById(appearance.font);
  printContent.style.fontSize = `${appearance.fontSize}px`;
  printContent.style.lineHeight = appearance.lineHeight;
  const margins = loadWordMargins();
  const printPaper = printContent;

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
      @page { margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; }
      .ep-exam-header { border: 0; border-bottom: 2px solid #333; padding: 10px 14px; margin-bottom: 14px; font-size: .94em; line-height: 1.6; }
      .ep-exam-header .ep-header-row { display:flex; flex-wrap:wrap; gap:4px 20px; }
      .ep-exam-header .ep-header-row span { white-space: pre-wrap; }
      .ep-exam-header .ep-header-row + .ep-header-row { margin-top:6px; }
      .ep-exam-header .title-row { font-size: 1.05em; font-weight: 700; column-gap: .5em; }
      .ep-section-head { font-weight: 700; margin: 14px 0 8px; }
      .ep-q { margin-bottom: 8px; break-inside: avoid; line-height: inherit; text-align: left; }
      .question-paragraph-break { display:block; height:0; margin-top:.45em; }
      .ep-answer-table { width: 100%; border: 0; border-collapse: collapse; table-layout: auto; font: inherit; line-height: inherit; }
      .ep-answer-table td { border: 0; padding: 0; vertical-align: top; font: inherit; line-height: inherit; }
      .ep-answer-table .ep-answer-prefix { width: 1%; white-space: nowrap; }
      .ep-answer-table td:not(.ep-answer-prefix) { text-align: left; }
      .ep-q p, .ep-answer-table p { margin: 0; line-height: inherit; }
      .ep-answer-blank { color: #555; margin-top: 4px; }
      .ep-essay-blank { min-height: 2lh; margin-top: 4px; }
      .ep-labeled-answer { display: grid; grid-template-columns: max-content minmax(0,1fr); align-items: start; }
      .ep-labeled-answer .ep-answer-value { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    </style></head><body>${printPaper.outerHTML}</body></html>`);
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
function renderPaper(examData, questions, display) {
  document.getElementById('epBody').innerHTML = buildPaperHtml(examData, questions, display);
}

export function buildHeaderHtml(h) {
  const escapeHeader = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const blankValue = field => {
    const { text, length } = headerBlankParts(h, field);
    return text + '　'.repeat(length);
  };
  const headerValues = {
    year: headerYearSemesterText(h),
    subject: h.subjectText || '',
    examType: h.examType || '',
    class: blankValue('class'),
    name: blankValue('name'),
    seat: blankValue('seat'),
    school: h.school || '', range: h.range ? `範圍：${h.range}` : '',
  };
  const headerLayout = normalizeHeaderLayout(h.layout);
  const headerRows = [1,2].map(row => HEADER_FIELDS
    .filter(field => {
      const place = headerLayout[field.id];
      return Number(place.row) === row && headerValues[field.id];
    })
    .sort((a,b) => {
      const pa = headerLayout[a.id];
      const pb = headerLayout[b.id];
      return Number(pa.position) - Number(pb.position) || HEADER_FIELDS.indexOf(a) - HEADER_FIELDS.indexOf(b);
    })
    .map(field => {
      const value = escapeHeader(headerValues[field.id]);
      return `<span><strong>${value}</strong></span>`;
    }).join(''));

  return `<div class="ep-exam-header">
    ${headerRows.map((content, index) => content ? `<div class="ep-header-row${index === 0 ? ' title-row' : ''}">${content}</div>` : '').join('')}
  </div>`;
}

function buildPaperHtml(examData, questions, previewOptions) {
  if (examData.booklet) previewOptions = {answers:true, analysis:true, source:true, difficulty:true, ...(previewOptions || examData.display || {}), booklet:true};
  if (examData.booklet) return buildBookletHtml(examData, questions, previewOptions);
  const h = examData.header ?? loadHeader();
  const typeScores = examData.typeScores || {};
  const grouped = groupByType(questions);
  const types = orderedTypes(grouped, examData.typeOrder);

  let html = `<div id="epPaper">${examData.booklet ? '' : buildHeaderHtml(h)}`;

  html += '<div class="ep-question-columns">';
  types.forEach((type, secIdx) => {
    const qs    = grouped[type];
    const score = typeScores[type] || 2;
    const byBlank = type === 'T4' && examData.scoreUnits?.T4 === 'blank';
    const blanks = byBlank ? qs.reduce((sum, q) => sum + (Number.isInteger(Number(q.answerCount)) && Number(q.answerCount) > 0 ? Number(q.answerCount) : 1), 0) : 0;
    const total = (byBlank ? blanks : qs.length) * score;
    html += examData.booklet ? `<div class="ep-section-head">${ROMANS[secIdx]}、${TYPE_LABELS[type]}（${qs.length} 題）</div>` : `<div class="ep-section-head">${ROMANS[secIdx]}、${TYPE_LABELS[type]}（${byBlank ? `${qs.length} 題，共 ${blanks} 格；每格` : '每題'} ${score} 分，共 ${total} 分）</div>`;
    qs.forEach((q, i) => { html += renderQPreview(q, i+1, type, previewOptions); });
  });

  html += '</div>';
  if (!previewOptions) {
    const display = { answers:true, analysis:true };
    const label = display.answers && display.analysis ? '解答與解析' : display.answers ? '解答' : '解析';
    html += `<div class="ep-answers" style="border-top:2px dashed #aaa;margin-top:20px;padding-top:12px">
      <div style="font-weight:700;margin-bottom:8px">【${label}】</div>`;
    types.forEach((type, secIdx) => {
      const qs = grouped[type];
      if (display.analysis && !display.answers && !qs.some(q => q.analysis)) return;
      html += `<div style="margin-bottom:6px"><b>${ROMANS[secIdx]}、${TYPE_LABELS[type]}：</b>`;
      if (type === 'T6' || type === 'T5' || type === 'T4') {
        html += '</div>';
        qs.forEach((q,i) => {
          if (!display.answers && !q.analysis) return;
          html += `<div style="margin-bottom:4px">${i+1}.${display.answers ? ` ${q.answer||'—'}` : ''}`;
          if (display.analysis && q.analysis) html += `<div style="margin-left:1.5em;color:#555;font-size:.86em">【解析】${q.analysis}</div>`;
          html += '</div>';
        });
      } else {
        html += (display.answers ? qs.map((q,i) => `${i+1}.${q.answer||'—'}`).join('　　') : '') + '</div>';
        if (display.analysis) qs.forEach((q,i) => {
          if (q.analysis) html += `<div style="margin-left:1.5em;color:#555;font-size:.86em;margin-bottom:3px">${i+1}.【解析】${q.analysis}</div>`;
        });
      }
    });
    html += '</div>';
  }
  html += '</div>';

  return html;
}

function buildBookletHtml(examData, questions, display) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const catalog = examData.chapterCatalog || { labels: ['章', '節', ''], chapters: [] };
  const normalize = value => {
    const number = String(value ?? '').trim().replace(/^0+(?=\d)/, '');
    return number === '0' ? '' : number;
  };
  const fields = ['chapterNum', 'sectionNum', 'subsectionNum'];
  const groups = new Map();
  for (const q of questions) {
    const path = fields.map(field => normalize(q[field]));
    const key = JSON.stringify(path);
    if (!groups.has(key)) groups.set(key, { path, questions: [] });
    groups.get(key).questions.push(q);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    for (let i = 0; i < fields.length; i++) {
      const difference = a.path[i].localeCompare(b.path[i], 'zh-TW', { numeric: true });
      if (difference) return difference;
    }
    return 0;
  });
  let html = '<div id="epPaper"><div class="ep-question-columns">';
  for (const group of ordered) {
    const [chapter, section, subsection] = group.path;
    const ch = catalog.chapters.find(item => normalize(item.chapterNum) === chapter);
    const sec = ch?.sections?.find(item => normalize(item.sectionNum) === section);
    const sub = sec?.subsections?.find(item => normalize(item.num) === subsection);
    const titles = [ch?.title, sec?.title, sub?.title];
    const heading = group.path.map((num, index) => {
      if (!num) return '';
      const label = catalog.labels[index] || ['章', '節', '小節'][index];
      const prefix = label === '單元' ? `${label}${num}` : `第${num}${label}`;
      const title = titles[index] || '';
      const text = /^(?:第\s*)?(?:[0-9０-９一二三四五六七八九十百]+\s*(?:章|節|單元)|單元\s*[0-9０-９一二三四五六七八九十百]+)/.test(title) ? title : `${prefix}${title ? `　${title}` : ''}`;
      const lastLine = !group.path.slice(index + 1).some(Boolean);
      return `<div class="ep-section-head ep-booklet-chapter-line${lastLine ? ' ep-booklet-chapter-end' : ''}" style="margin:0 0 6px;break-after:avoid;${lastLine ? 'padding-bottom:16px;margin-bottom:22px;border-bottom:1px solid #000;' : ''}">${escape(text)}</div>`;
    }).join('');
    html += heading || '<div class="ep-section-head ep-booklet-chapter-end" style="padding-bottom:16px;margin-bottom:22px;border-bottom:1px solid #000">未標示章節</div>';
    const grouped = groupByType(group.questions);
    orderedTypes(grouped, examData.typeOrder).forEach((type, index) => {
      html += `<div class="ep-section-head">${ROMANS[index]}、${TYPE_LABELS[type]}（${grouped[type].length} 題）</div>`;
      grouped[type].sort((a, b) => {
        const first = String(a.qnum ?? '').trim();
        const second = String(b.qnum ?? '').trim();
        if (!first || !second) return first ? -1 : second ? 1 : 0;
        return first.localeCompare(second, 'zh-TW', { numeric: true });
      });
      grouped[type].forEach((q, questionIndex) => { html += renderBookletQuestion(q, questionIndex + 1, type, display); });
    });
    html += '<div class="ep-booklet-chapter-spacer" aria-hidden="true" style="height:1lh"></div>';
  }
  return html + '</div></div>';
}

function renderBookletQuestion(q, num, type, display) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const code = q.qnum === undefined || q.qnum === null || q.qnum === '' ? '未編碼' : String(q.qnum).padStart(5, '0');
  const difficulty = q.difficulty === '◎' ? '較難題' : q.difficulty === '△' ? '簡易題' : '未標示';
  const sources = typeof SOURCE_CODES === 'undefined' ? {A1:'課本', A2:'四技二專考題'} : SOURCE_CODES;
  const meta = [`編碼：${escape(code)}`];
  if (display.difficulty) meta.push(`難易度：${difficulty}`);
  if (display.source) {
    const page = String(q.source || '未註明').trim();
    const pageLabel = /^\d+(?:\s*[-–、,]\s*\d+)*$/.test(page) ? `P.${page}` : page;
    meta.push(`出處：${escape(sources[q.sourceCode] || q.sourceCode || '未註明')}`, `頁數：${escape(pageLabel)}`);
  }
  // Reuse the exam question layout with numbering within each chapter's question type.
  const rendered = renderQPreview(q, num, type, {...display, booklet:false, source:false, difficulty:false});
  const body = rendered.slice('<div class="ep-q">'.length, -'</div>'.length);
  return `<div class="ep-q ep-booklet-question" style="margin-bottom:18px;break-inside:avoid"><div class="ep-booklet-meta" style="margin-bottom:6px;font-size:1em;color:#000;line-height:inherit">${meta.join('︱')}</div>${body}</div>`;

}

function renderQPreview(q, num, type, previewOptions) {
  if (previewOptions?.booklet) return renderBookletQuestion(q, num, type, previewOptions);
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const numberLabel = previewOptions?.hideNumber ? '' : `${num}.`;
  const answer = String(q.answer ?? '').trim();
  const answerValue = previewOptions?.answers && answer
    ? escapeText(answer.replace(/[A-Z]/g, char => String.fromCharCode(char.charCodeAt(0) + 65248)))
    : '　　';
  const answerSlot = `<span class="ep-answer-slot">（<span class="ep-answer-value">${answerValue}</span>）</span>`;
  const source = String(q.source ?? '').trim();
  const sourceTag = previewOptions?.source && source ? `<span class="ep-q-source">${source.startsWith('【') ? escapeText(source) : `【${escapeText(source)}】`}</span>` : '';
  const difficultyLabel = q.difficulty === '◎' ? '較難' : q.difficulty === '△' ? '簡易' : '未標示';
  const difficultyTag = previewOptions?.difficulty ? `<span class="ep-q-difficulty ${q.difficulty === '◎' ? 'is-hard' : q.difficulty === '△' ? 'is-easy' : ''}">${difficultyLabel}</span>` : '';
  let body = '';
  if (type === 'T1') {
    body = `<table class="ep-answer-table" role="presentation"><tr><td class="ep-answer-prefix">${difficultyTag}${answerSlot}${numberLabel}</td><td>${UI.questionHtml(q.text)}${sourceTag}</td></tr></table>`;
  } else if (type === 'T2' || type === 'T3') {
    const opts = q.options?.length
      ? ` ${q.options.map((o,i)=>`(${String.fromCharCode(65+i)})${o}`).join(' ')}` : '';
    const tail = q.tail?.trim() || '';
    body = `<table class="ep-answer-table" role="presentation"><tr><td class="ep-answer-prefix">${difficultyTag}${answerSlot}${numberLabel}</td><td>${UI.questionHtml(q.text)}${opts}${tail ? `${tail === '。' ? '' : ' '}${tail}` : ''}${sourceTag}</td></tr></table>`;
  } else if (type === 'T4' || type === 'T5' || type === 'T6') {
    const questionText = type === 'T5' ? UI.matchingQuestionHtml(q.text)
      : UI.questionHtml(q.text);
    const labeledAnswer = `<span class="ep-answer-label">【答案】</span><span class="ep-answer-value">${escapeText(answer)}</span>`;
    const answerArea = type === 'T6'
      ? `<div class="ep-essay-blank${previewOptions?.answers && answer ? ' ep-labeled-answer' : ''}">${previewOptions?.answers && answer ? labeledAnswer : ''}</div>`
      : previewOptions?.answers && answer
        ? `<div class="ep-answer-blank ep-labeled-answer">${labeledAnswer}</div>` : '';
    body = `<table class="ep-answer-table ep-indented-question" role="presentation"><tr><td class="ep-answer-prefix">${difficultyTag}${numberLabel}</td><td>${questionText}${sourceTag}${answerArea}</td></tr></table>`;
  } else {
    body = `${difficultyTag}${numberLabel}${UI.questionHtml(q.text)}${sourceTag}`;
    if (previewOptions?.answers && answer) body += `<div class="ep-answer-blank">【答案】<span class="ep-answer-value">${escapeText(answer)}</span></div>`;
  }
  if (previewOptions?.analysis && q.analysis) {
    const alignWithAnswer = type === 'T1' || type === 'T2';
    const analysis = `<div class="ep-q-analysis"${alignWithAnswer ? ' style="display:flex;margin:6px 0 0;text-align:left"' : ''}><span class="ep-analysis-label" style="flex:none;white-space:nowrap">【解析】</span><span class="ep-analysis-text" style="min-width:0;overflow-wrap:anywhere">${escapeText(q.analysis)}</span></div>`;
    const tableEnd = '</td></tr></table>';
    body = !alignWithAnswer && body.endsWith(tableEnd)
      ? body.slice(0, -tableEnd.length) + analysis + tableEnd
      : body + analysis;
  }
  return `<div class="ep-q">${body}</div>`;
}


// ══════════════════════════════════════════════════════════
//  輸出 Word（讀取相同的表頭與外觀偏好）
// ══════════════════════════════════════════════════════════
export async function exportToWord(examData, questions, paperKey = 'A4', columns = 1, fileHandle = null) {
  const a = examAppearance(examData);
  const margins = loadWordMargins();
  const size = PAPER_SIZES[paperKey] || PAPER_SIZES.A4;
  const title = examData.title || '試卷';
  const fontStack = fontStackById(a.font);
  const lineHeightPx = `${(a.fontSize * a.lineHeight).toFixed(2)}px`;
  const paper = document.createElement('div');
  paper.innerHTML = buildPaperHtml(examData, questions, window._epExamData === examData ? previewDisplay() : undefined);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${a.fontSize}px ${fontStack}`;
  // Word 在表格欄位交界加入可見編輯記號，也容易拉大題號後的空白。
  // Word 版改為單一段落的懸掛縮排；預覽仍使用原本表格版面。
  paper.querySelectorAll('.ep-q').forEach(question => {
    const table = question.querySelector('.ep-answer-table');
    if (!table) return;
    const prefix = table.querySelector('.ep-answer-prefix');
    const content = table.querySelector('td:not(.ep-answer-prefix)');
    if (!prefix || !content) return;
    const indent = Math.ceil(measure.measureText(prefix.textContent).width + a.fontSize * .2);
    const paragraph = document.createElement('p');
    paragraph.className = 'ep-word-question';
    const questionGap = parseFloat(question.style?.marginBottom) || 8;
    paragraph.style.margin = `0 0 ${questionGap}px ${indent}px`;
    paragraph.style.textIndent = `-${indent}px`;
    paragraph.style.fontFamily = fontStack;
    paragraph.style.fontSize = `${a.fontSize}px`;
    paragraph.style.lineHeight = lineHeightPx;
    const metadata = question.querySelector('.ep-booklet-meta');
    if (metadata) {
      const metadataLine = document.createElement('p');
      metadataLine.className = 'ep-word-meta';
      metadataLine.textContent = metadata.textContent;
      question.before(metadataLine);
    }
    while (prefix.firstChild) paragraph.appendChild(prefix.firstChild);
    paragraph.appendChild(document.createTextNode(' '));
    while (content.firstChild) paragraph.appendChild(content.firstChild);
    const externalAnalyses = [...question.children].filter(child => child.classList.contains('ep-q-analysis'));
    const analysis = externalAnalyses[0] || paragraph.querySelector('.ep-q-analysis');
    if (analysis) {
      const label = analysis.querySelector('.ep-analysis-label')?.textContent || '【解析】';
      measure.font = `${a.fontSize * .9}px ${fontStack}`;
      paragraph.dataset.analysisIndent = String(Math.ceil(measure.measureText(label).width));
      paragraph.dataset.analysisOffset = externalAnalyses.length ? '0' : String(indent);
      paragraph.dataset.analysisGap = externalAnalyses.length ? '6' : '2';
      measure.font = `${a.fontSize}px ${fontStack}`;
    }
    externalAnalyses.forEach(analysis => paragraph.appendChild(analysis));
    const answerLabel = paragraph.querySelector('.ep-labeled-answer .ep-answer-label');
    if (answerLabel) paragraph.dataset.answerIndent = String(Math.ceil(measure.measureText(answerLabel.textContent).width));
    const essayBlank = paragraph.querySelector('.ep-essay-blank');
    if (essayBlank && !essayBlank.classList.contains('ep-labeled-answer')) {
      essayBlank.replaceChildren(document.createElement('br'));
    }
    question.replaceWith(paragraph);
  });
  try {
    const docx = await loadDocxLibrary();
    const blob = await createDocxBlob({ docx, content:paper.firstElementChild, title, appearance:a, margins, paperSize:size, columns });
    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => {});
        throw error;
      }
      UI.toast(`已儲存 ${fileHandle.name}`, 'success');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  } catch (error) {
    console.error('DOCX 匯出失敗', error);
    UI.toast(`Word 下載失敗：${error.message || '請稍後再試'}`, 'danger');
  }
}
