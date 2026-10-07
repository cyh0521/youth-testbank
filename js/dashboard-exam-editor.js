import { showExamPreview, loadHeader, loadAppearance, mountInlineHeaderEditor, buildHeaderHtml, fontStackById } from './exam-preview.js?v=20261007-images-2';
import { chooseExamReplacement } from './exam-question-replacement.js';
import { examScopeSummaryHtml } from './exam-scope-summary.js';

const TYPE_SCORES = { T1:2, T2:2, T3:4, T4:2, T5:2, T6:10 };
let allExams = [];
let allQuestions = {};
let editExamId = null;
let editDraftExam = null;
let editQOrder = [];
const editCollapsedTypes = new Set();
let editQMap = {};
let editReplaceBusy = false;
let editTypeOrder = [];
let typeOrderDraft = [];
let draggedEditType = null;
let onSaved = () => {};
let mounted = false;

async function loadExamQuestions(exam) {
  const questions = await DataService.getQuestionsByIds(exam.questionIds || []);
  questions.forEach(question => { allQuestions[question.id] = question; });
}

export async function openDashboardExamEditor(exam, refresh) {
  if (!mounted) {
    document.body.insertAdjacentHTML('beforeend', "<!-- 試卷編輯 Modal -->\r\n<div class=\"modal-overlay hidden\" id=\"editModal\">\r\n  <div class=\"modal modal-xl\">\r\n    <div class=\"modal-header\">\r\n      <h3 id=\"editTitle\">編輯試卷</h3>\r\n      <div style=\"display:flex;gap:6px;align-items:center\">\r\n        <button class=\"btn btn-ghost btn-sm\" onclick=\"shuffleEditQs()\" title=\"各題型內隨機重新排序\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2.5a6 6 0 0 0 5.1-3l4.8-8a6 6 0 0 1 5.1-3H22M2 6h2.5a6 6 0 0 1 5.1 3l.5.8M14 17.2a6 6 0 0 0 5.5 2.8H22\"/></svg>重新排序</button>\r\n        <button class=\"btn btn-ghost btn-sm\" id=\"editTypeOrderToggle\" type=\"button\" onclick=\"openEditTypeOrder()\" aria-haspopup=\"dialog\" aria-controls=\"editTypeOrderModal\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 6h16M4 12h16M4 18h16\"/><path d=\"m8 3-2 3 2 3m8 6 2 3-2 3\"/></svg>題型排序</button>\r\n        <button class=\"btn btn-ghost btn-sm ep-panel-toggle\" id=\"editHeaderToggle\" onclick=\"toggleEditHeader()\" aria-expanded=\"false\" aria-controls=\"editHeaderPanel\" title=\"設定試卷上方表頭資訊\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg>試卷表頭</button>\r\n        <button class=\"btn btn-outline btn-sm\" onclick=\"previewEdit()\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>預覽</button>\r\n        <button class=\"btn btn-primary btn-sm\" onclick=\"saveEdit()\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8\"/></svg>儲存</button>\r\n        <button class=\"modal-close\" onclick=\"closeEdit()\">✕</button>\r\n      </div>\r\n    </div>\r\n    <div class=\"modal-body\" style=\"padding:16px 20px\">\r\n      <div id=\"editHeaderPanel\" class=\"ep-inline-header hidden\">\r\n        <div id=\"editHeaderSample\" class=\"edit-header-sample\"></div>\r\n        <div id=\"editHeaderFields\"></div>\r\n      </div>\r\n      <!-- 基本資訊 -->\r\n      <div class=\"edit-basic-fields\">\r\n        <div class=\"form-group\">\r\n          <label class=\"form-label\" for=\"editExamTitle\">試卷名稱 <span class=\"required\">*</span></label>\r\n          <input class=\"form-control\" id=\"editExamTitle\">\r\n        </div>\r\n        <div class=\"form-group\">\r\n          <label class=\"form-label\" for=\"editExamDescription\">說明</label>\r\n          <input class=\"form-control\" id=\"editExamDescription\" placeholder=\"可填寫考試類型、試題範圍等資訊。\">\r\n        </div>\r\n      </div>\r\n      <div style=\"font-size:.88rem;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between\">\r\n        <span>題目清單（可拖曳排序或移除）</span>\r\n        <span id=\"editQCount\" style=\"font-weight:600;color:var(--primary)\"></span>\r\n      </div>\r\n      <div id=\"editQList\" style=\"border:1px solid var(--border);border-radius:var(--radius);max-height:400px;overflow-y:auto;background:white\"></div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class=\"modal-overlay hidden\" id=\"editTypeOrderModal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"editTypeOrderTitle\" style=\"z-index:1100\">\r\n  <div class=\"modal\" style=\"max-width:460px;width:96%\">\r\n    <div class=\"modal-header\"><h3 id=\"editTypeOrderTitle\">題型排序</h3><button class=\"modal-close\" type=\"button\" onclick=\"closeEditTypeOrder()\" aria-label=\"關閉\">✕</button></div>\r\n    <div class=\"modal-body\">\r\n      <p style=\"font-size:.88rem;color:var(--text-secondary);margin-bottom:12px\">拖曳題型以調整試卷中的顯示順序。</p>\r\n      <div id=\"editTypeOrderList\" class=\"edit-type-order-list\"></div>\r\n    </div>\r\n    <div class=\"modal-footer\"><button class=\"btn btn-ghost\" type=\"button\" onclick=\"closeEditTypeOrder()\">取消</button><button class=\"btn btn-primary\" type=\"button\" onclick=\"applyEditTypeOrder()\">套用順序</button></div>\r\n  </div>\r\n</div>\r\n\r\n");
    const descriptionInput = document.getElementById('editExamDescription');
    const descriptionGroup = descriptionInput.closest('.form-group');
    const descriptionControl = document.createElement('div');
    descriptionControl.className = 'edit-description-control';
    descriptionGroup.append(descriptionControl);
    descriptionControl.append(descriptionInput);
    descriptionControl.insertAdjacentHTML('beforeend', '<button class="btn btn-ghost btn-sm ep-panel-toggle" id="editScopeToggle" type="button" onclick="toggleEditScope()" aria-expanded="false" aria-controls="editScopePanel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>命題範圍</button>');
    document.querySelector('#editModal .edit-basic-fields').insertAdjacentHTML('afterend', '<div id="editScopePanel" class="edit-scope-panel" hidden></div>');
    document.querySelector('#editModal .modal-header .modal-close').insertAdjacentHTML('beforebegin',
      `<button class="btn btn-ghost btn-sm" id="editFullscreenToggle" type="button" onclick="toggleEditFullscreen()" aria-pressed="false" aria-label="放大視窗" title="放大視窗"><svg class="edit-fullscreen-icon-expand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg><svg class="edit-fullscreen-icon-restore" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg><span id="editFullscreenLabel">放大</span></button>`);
    document.getElementById('editQList').previousElementSibling.style.fontSize = '.9rem';
    const countLabel = document.getElementById('editQCount');
    countLabel.style.marginLeft = 'auto';
    countLabel.insertAdjacentHTML('afterend', '<div class="edit-q-view-toggle" role="group" aria-label="題目顯示模式"><button id="editQCompactBtn" class="active" type="button" onclick="setEditQDisplay(false)" aria-pressed="true" aria-controls="editQList"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>精簡顯示</button><button id="editQFullBtn" type="button" onclick="setEditQDisplay(true)" aria-pressed="false" aria-controls="editQList"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 10 5-10 5L2 7l10-5ZM2 12l10 5 10-5M2 17l10 5 10-5"/></svg>完整顯示</button></div>');
    mounted = true;
  }
  allExams = [exam];
  onSaved = refresh;
  await window.openEdit(exam.id);
}

function setEditFullscreen(fullscreen) {
  document.getElementById('editModal').classList.toggle('is-fullscreen', fullscreen);
  const button = document.getElementById('editFullscreenToggle');
  button.setAttribute('aria-pressed', String(fullscreen));
  button.setAttribute('aria-label', fullscreen ? '還原視窗' : '放大視窗');
  button.title = fullscreen ? '還原視窗' : '放大視窗';
  document.getElementById('editFullscreenLabel').textContent = fullscreen ? '還原' : '放大';
}
window.toggleEditFullscreen = () => {
  setEditFullscreen(!document.getElementById('editModal').classList.contains('is-fullscreen'));
};

// ── 編輯 Modal ───────────────────────────────────
window.openEdit = async (id) => {
  const e = allExams.find(x => x.id===id); if (!e) return;
  await loadExamQuestions(e);
  editExamId = id;
  editDraftExam = { id, scoreUnits:e.scoreUnits, header:{ ...(e.header ?? loadHeader()) }, appearance:{ ...(e.appearance ?? loadAppearance()) },
    onHeaderSaved:() => { e.header = { ...editDraftExam.header }; },
    onAppearanceSaved:() => { e.appearance = { ...editDraftExam.appearance }; } };
  editQOrder = [...(e.questionIds||[])];
  editQMap   = {};
  editQOrder.forEach(qid => { if (allQuestions[qid]) editQMap[qid] = allQuestions[qid]; });
  // Remove ids without question data
  editQOrder = editQOrder.filter(qid => editQMap[qid]);
  editCollapsedTypes.clear();
  editTypeOrder = [...new Set([...(e.typeOrder || []), ...EDIT_TYPE_ORDER])];
  editQOrder = orderedEditTypes().flatMap(type => editQOrder.filter(id => editQMap[id].type === type));

  document.getElementById('editTitle').textContent = `編輯試卷：${e.title||''}`;
  document.getElementById('editExamTitle').value  = e.title || '';
  document.getElementById('editExamDescription').value = e.description || '';
  document.getElementById('editScopePanel').hidden = true;
  document.getElementById('editScopePanel').innerHTML = '';
  document.getElementById('editScopeToggle').setAttribute('aria-expanded', 'false');
  renderEditQList(e.typeScores||{});
  setEditQDisplay(false);
  document.getElementById('editTypeOrderModal').classList.add('hidden');
  document.getElementById('editHeaderPanel').classList.add('hidden');
  document.getElementById('editHeaderToggle').setAttribute('aria-expanded', 'false');
  setEditFullscreen(false);
  document.getElementById('editModal').classList.remove('hidden');
};

window.toggleEditScope = async () => {
  const panel = document.getElementById('editScopePanel');
  const button = document.getElementById('editScopeToggle');
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (!open) return;
  const exam = allExams.find(item => item.id === editExamId);
  if (!exam) return;
  panel.textContent = '載入中…';
  const html = await examScopeSummaryHtml(exam);
  if (editExamId === exam.id && !panel.hidden) panel.innerHTML = html;
};

function renderEditHeaderSample() {
  const sample = document.getElementById('editHeaderSample');
  sample.style.fontFamily = fontStackById(editDraftExam.appearance.font);
  sample.innerHTML = buildHeaderHtml(editDraftExam.header);
}
document.addEventListener('exam-header-saved', event => {
  const { id, header, source } = event.detail;
  const exam = allExams.find(item => item.id === id);
  if (exam) exam.header = { ...header };
  if (editExamId !== id || !editDraftExam || source === editDraftExam) return;
  editDraftExam.header = { ...header };
  if (!document.getElementById('editHeaderPanel').classList.contains('hidden')) {
    renderEditHeaderSample();
    mountInlineHeaderEditor(document.getElementById('editHeaderFields'), editDraftExam, renderEditHeaderSample, () => {
      document.getElementById('editHeaderPanel').classList.add('hidden');
      document.getElementById('editHeaderToggle').setAttribute('aria-expanded', 'false');
    });
  }
});
window.toggleEditHeader = () => {
  const panel = document.getElementById('editHeaderPanel');
  const expanded = !panel.classList.toggle('hidden');
  document.getElementById('editHeaderToggle').setAttribute('aria-expanded', String(expanded));
  if (expanded) {
    renderEditHeaderSample();
    mountInlineHeaderEditor(document.getElementById('editHeaderFields'), editDraftExam, renderEditHeaderSample, () => {
      panel.classList.add('hidden');
      document.getElementById('editHeaderToggle').setAttribute('aria-expanded', 'false');
    });
  }
};

const EDIT_TYPE_ORDER = ['T1','T2','T3','T4','T5','T6'];
const EDIT_TYPE_LABELS = {T1:'是非題',T2:'選擇題',T3:'複選題',T4:'填空題',T5:'配合題',T6:'問答題'};
const EDIT_ROMANS = ['一','二','三','四','五','六'];
function orderedEditTypes() {
  const present = [...new Set(editQOrder.map(id => editQMap[id]?.type).filter(Boolean))];
  return [...editTypeOrder.filter(type => present.includes(type)), ...present.filter(type => !editTypeOrder.includes(type))];
}

window.openEditTypeOrder = () => {
  typeOrderDraft = orderedEditTypes();
  renderEditTypeOrder();
  document.getElementById('editTypeOrderModal').classList.remove('hidden');
};

window.closeEditTypeOrder = () => {
  document.getElementById('editTypeOrderModal').classList.add('hidden');
  typeOrderDraft = [];
  draggedEditType = null;
};

function renderEditTypeOrder() {
  document.getElementById('editTypeOrderList').innerHTML = typeOrderDraft.map((type, index) =>
    `<div class="edit-type-order-item" draggable="true" data-type="${type}" ondragstart="editTypeDragStart(event)" ondragover="editTypeDragOver(event)" ondragleave="editTypeDragLeave(event)" ondrop="editTypeDrop(event)" ondragend="editTypeDragEnd()"><span class="edit-type-order-handle" aria-hidden="true">⠿</span><span>${index + 1}. ${EDIT_TYPE_LABELS[type] || type}</span></div>`
  ).join('') || '<span>尚無題目</span>';
}

window.editTypeDragStart = event => {
  draggedEditType = event.currentTarget.dataset.type;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedEditType);
  event.currentTarget.classList.add('dragging');
};
window.editTypeDragOver = event => {
  if (!draggedEditType || event.currentTarget.dataset.type === draggedEditType) return;
  event.preventDefault();
  const after = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
  event.currentTarget.classList.toggle('drop-after', after);
  event.currentTarget.classList.toggle('drop-before', !after);
};
window.editTypeDragLeave = event => event.currentTarget.classList.remove('drop-before', 'drop-after');
window.editTypeDragEnd = () => {
  draggedEditType = null;
  document.querySelectorAll('.edit-type-order-item').forEach(item => item.classList.remove('dragging', 'drop-before', 'drop-after'));
};
window.editTypeDrop = event => {
  event.preventDefault();
  const target = event.currentTarget.dataset.type;
  if (!draggedEditType || target === draggedEditType) return;
  const after = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
  const next = typeOrderDraft.filter(type => type !== draggedEditType);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, draggedEditType);
  typeOrderDraft = next;
  draggedEditType = null;
  renderEditTypeOrder();
};

window.applyEditTypeOrder = () => {
  const scores = getCurrentEditScores();
  editTypeOrder = [...typeOrderDraft, ...editTypeOrder.filter(type => !typeOrderDraft.includes(type))];
  editQOrder = typeOrderDraft.flatMap(type => editQOrder.filter(id => editQMap[id]?.type === type));
  renderEditQList(scores);
  closeEditTypeOrder();
};

function editScoreValue(value, type) {
  const parsed = parseFloat(value);
  const fallback = TYPE_SCORES[type] || 2;
  return Math.round(Math.min(99.5, Math.max(0.5, Number.isFinite(parsed) ? parsed : fallback)) * 2) / 2;
}

window.normalizeEditScore = (input, type) => {
  input.value = editScoreValue(input.value, type);
  updateEditTotal();
};

function updateEditTotal() {
  const scores = getCurrentEditScores();
  const typeTotals = {};
  const total = editQOrder.reduce((sum, id) => {
    const q = editQMap[id];
    const points = (scores[q?.type] || 0) * (q?.type === 'T4' && editDraftExam?.scoreUnits?.T4 === 'blank' ? Math.max(1, parseInt(q.answerCount, 10) || 1) : 1);
    if (q) typeTotals[q.type] = (typeTotals[q.type] || 0) + points;
    return sum + points;
  }, 0);
  document.getElementById('editQCount').textContent = `${editQOrder.length} 題 / 共 ${total} 分`;
  Object.entries(typeTotals).forEach(([type, points]) => {
    const label = document.getElementById(`escore-total-${type}`);
    if (label) label.textContent = points;
  });
}

function setEditQDisplay(full) {
  document.getElementById('editQList').classList.toggle('show-full', full);
  for (const [id, active] of [['editQCompactBtn', !full], ['editQFullBtn', full]]) {
    const button = document.getElementById(id);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
window.setEditQDisplay = setEditQDisplay;

window.toggleEditQSection = type => {
  const items = document.getElementById(`editQItems-${type}`);
  const button = document.querySelector(`.edit-q-section-toggle[data-type="${type}"]`);
  if (!items || !button) return;
  items.hidden = !items.hidden;
  items.parentElement.classList.toggle('is-collapsed', items.hidden);
  button.setAttribute('aria-expanded', String(!items.hidden));
  if (items.hidden) editCollapsedTypes.add(type);
  else editCollapsedTypes.delete(type);
};

function renderEditQList(typeScores = getCurrentEditScores()) {
  const container = document.getElementById('editQList');
  if (!editQOrder.length) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">尚無題目</div>';
    updateEditTotal();
    return;
  }
  container.innerHTML = orderedEditTypes().map((type, sectionIndex) => {
    const ids = editQOrder.filter(id => editQMap[id]?.type === type);
    const score = editScoreValue(typeScores[type], type);
    const byBlank = type === 'T4' && editDraftExam?.scoreUnits?.T4 === 'blank';
    const units = byBlank ? ids.reduce((sum, id) => sum + Math.max(1, parseInt(editQMap[id]?.answerCount, 10) || 1), 0) : ids.length;
    const countLabel = byBlank ? `${ids.length} 題，共 ${units} 格` : `${ids.length} 題`;
    const collapsed = editCollapsedTypes.has(type);
    return `<div class="edit-q-group${collapsed ? ' is-collapsed' : ''}"><div class="edit-q-section" onclick="if (!event.target.closest('input')) toggleEditQSection('${type}')"><button class="edit-q-section-toggle" type="button" data-type="${type}" aria-expanded="${!collapsed}" aria-controls="editQItems-${type}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><span>${EDIT_ROMANS[sectionIndex] || sectionIndex + 1}、${EDIT_TYPE_LABELS[type] || type}（${countLabel}）</span></button><label class="edit-q-score">每${byBlank ? '格' : '題'} <input class="form-control" type="number" id="escore-${type}" value="${score}" min="0.5" max="99.5" step="0.5" oninput="updateEditTotal()" onchange="normalizeEditScore(this,'${type}')"> 分，共 <span id="escore-total-${type}">${units * score}</span> 分</label></div><div class="edit-q-items" id="editQItems-${type}"${collapsed ? ' hidden' : ''}>` + ids.map((id, idx) => {
      const q = editQMap[id];
      const questionLine = [
        q.text || '—',
        ...((q.type === 'T2' || q.type === 'T3') && q.options?.length
          ? q.options.map((option, index) => `(${String.fromCharCode(65 + index)}) ${option}`)
          : []),
        q.tail || ''
      ].filter(Boolean).join('　');
      const fullQuestion = `${q.type === 'T5' ? UI.matchingQuestionHtml(q.text) : UI.questionHtml(q.text || '—')}${(q.type === 'T2' || q.type === 'T3') && q.options?.length ? ' ' + q.options.map((option, index) => `(${String.fromCharCode(65 + index)})${UI.questionHtml(option)}`).join(' ') : ''}${(q.type === 'T2' || q.type === 'T3') && q.tail ? (String(q.tail).trim() === '。' ? '' : ' ') + UI.questionHtml(q.tail) : ''}`;
      return `<div class="edit-q-item eq-item" draggable="true" data-id="${id}"
      ondragstart="eqDragStart(event,'${id}')" ondragover="eqDragOver(event,'${id}')"
      ondrop="eqDrop(event,'${id}')" ondragend="eqDragEnd()">
      <span class="drag-handle">⠿</span>
      <span class="eq-num">${idx+1}.</span>
      ${q.qnum?`<span class="eq-qnum eq-compact-meta">${UI.escapeHtml(q.qnum)}</span>`:''}
      <span class="eq-compact-meta" style="flex-shrink:0">${UI.typeBadge(q.type)}</span>
      <span class="eq-text" title="${UI.escapeHtml(questionLine)}">${UI.escapeHtml(questionLine)}</span>
      <div class="eq-full"><div class="eq-full-meta"><span class="eq-full-num">${UI.escapeHtml(q.qnum || '—')}</span>${UI.typeBadge(q.type)}${UI.diffBadge(q.difficulty)}<span class="eq-full-source">頁數 ${UI.escapeHtml(q.source || '未註明')}</span><button class="eq-full-replace" type="button" onclick="replaceEditQ('${id}',this)" title="更換此題">換題</button><button class="eq-remove eq-full-remove" type="button" onclick="removeEditQ('${id}')" title="從試卷移除" aria-label="從試卷移除">✕</button></div><div class="eq-full-question">${fullQuestion}</div>${q.type !== 'T2' && q.type !== 'T3' && q.tail ? `<div>${UI.questionHtml(q.tail)}</div>` : ''}<div class="eq-full-answer"><span class="eq-full-answer-label">答案</span><span class="eq-full-answer-text">${UI.questionHtml(q.answer || '—')}</span></div></div>
      <button class="eq-full-replace eq-compact-replace" type="button" onclick="replaceEditQ('${id}',this)" title="更換此題">換題</button>
      <button class="eq-remove eq-remove-compact" onclick="removeEditQ('${id}')" title="從試卷移除">✕</button>
    </div>`;
    }).join('') + '</div></div>';
  }).join('');
  updateEditTotal();
}

window.removeEditQ = (id) => {
  const scores = getCurrentEditScores();
  editQOrder = editQOrder.filter(x => x!==id);
  renderEditQList(scores);
};

window.replaceEditQ = async (id, button) => {
  const original = editQMap[id];
  if (!original || editReplaceBusy) return;
  editReplaceBusy = true;
  button.disabled = true;
  const draft = editDraftExam;
  const scores = getCurrentEditScores();
  const list = document.getElementById('editQList');
  const scrollTop = list.scrollTop;
  try {
    const { question, sameSection } = await chooseExamReplacement(original, editQOrder);
    if (editDraftExam !== draft) return;
    if (!question) {
      UI.toast(original.type === 'T4' ? '同冊沒有未使用且格數相同的填空題' : '同冊沒有未使用的同題型題目', 'warning');
      return;
    }
    const index = editQOrder.indexOf(id);
    if (index < 0 || editQOrder.includes(question.id)) return;
    editQOrder[index] = question.id;
    editQMap[question.id] = question;
    allQuestions[question.id] = question;
    renderEditQList(scores);
    list.scrollTop = scrollTop;
    UI.toast(sameSection ? '已更換同章節題目' : '原章節無可用題目，已從同冊更換', 'success');
  } catch (error) {
    UI.toast('換題失敗：' + error.message, 'danger');
  } finally {
    editReplaceBusy = false;
    button.disabled = false;
  }
};

function getCurrentEditScores() {
  const scores = {};
  const types = orderedEditTypes();
  types.forEach(t => {
    const el = document.getElementById('escore-'+t);
    scores[t] = editScoreValue(el?.value, t);
  });
  return scores;
}

// Drag-to-reorder
let _eDragId = null;
window.eqDragStart = (e,id) => { _eDragId=id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; };
window.eqDragEnd   = ()     => { _eDragId=null; document.querySelectorAll('.eq-item').forEach(el=>el.classList.remove('dragging','drag-over')); };
window.eqDragOver  = (e,id) => {
  if (!_eDragId || id === _eDragId || editQMap[id]?.type !== editQMap[_eDragId]?.type) return;
  e.preventDefault();
  document.querySelector(`.eq-item[data-id="${id}"]`)?.classList.add('drag-over');
};
window.eqDrop      = (e,targetId) => {
  e.preventDefault();
  if (!_eDragId || _eDragId===targetId || editQMap[targetId]?.type !== editQMap[_eDragId]?.type) return;
  const from=editQOrder.indexOf(_eDragId), to=editQOrder.indexOf(targetId);
  if (from<0||to<0) return;
  editQOrder.splice(from,1); editQOrder.splice(to,0,_eDragId);
  renderEditQList();
};

// Shuffle
window.shuffleEditQs = () => {
  const byType = {};
  editQOrder.forEach(id => {
    const q = editQMap[id]; if (!q) return;
    if (!byType[q.type]) byType[q.type] = [];
    byType[q.type].push(id);
  });
  Object.values(byType).forEach(arr => arr.sort(() => Math.random()-.5));
  editQOrder = orderedEditTypes().flatMap(t => byType[t]||[]);
  renderEditQList();
  UI.toast('已重新排序', 'success');
};

// Preview
window.previewEdit = () => {
  const typeScores = getCurrentEditScores();
  const qs = editQOrder.map(id => editQMap[id]).filter(Boolean);
  const title = document.getElementById('editExamTitle').value.trim() || '試卷預覽';
  editDraftExam.title = title;
  editDraftExam.description = document.getElementById('editExamDescription').value.trim();
  editDraftExam.typeScores = typeScores;
  editDraftExam.typeOrder = orderedEditTypes();
  editDraftExam.onPreviewClose = () => {
    if (!document.getElementById('editHeaderPanel').classList.contains('hidden')) {
      renderEditHeaderSample();
      mountInlineHeaderEditor(document.getElementById('editHeaderFields'), editDraftExam, renderEditHeaderSample, () => {
        document.getElementById('editHeaderPanel').classList.add('hidden');
        document.getElementById('editHeaderToggle').setAttribute('aria-expanded', 'false');
      });
    }
  };
  showExamPreview(editDraftExam, qs);
};

// Save edit
window.saveEdit = async () => {
  const title = document.getElementById('editExamTitle').value.trim();
  if (!title) { UI.toast('請填寫試卷名稱', 'warning'); return; }
  const typeScores  = getCurrentEditScores();
  let totalScore = 0;
  editQOrder.forEach(id => {
    const q = editQMap[id]; if (!q) return;
    totalScore += (typeScores[q.type] || 2) * (q.type === 'T4' && editDraftExam?.scoreUnits?.T4 === 'blank' ? Math.max(1, parseInt(q.answerCount, 10) || 1) : 1);
  });
  try {
    await DataService.saveExam({
      id:            editExamId,
      title,
      description: document.getElementById('editExamDescription').value.trim(),
      typeScores,
      scoreUnits: editDraftExam.scoreUnits,
      typeOrder: orderedEditTypes(),
      header:        editDraftExam.header,
      appearance:    editDraftExam.appearance,
      totalScore,
      questionIds:   [...editQOrder],
      questionCount: editQOrder.length,
    });
    UI.toast('試卷已儲存', 'success');
    closeEdit();
    await onSaved();
  } catch(e) { UI.toast('儲存失敗：'+e.message, 'danger'); }
};

window.closeEdit = () => {
  closeEditTypeOrder();
  setEditFullscreen(false);
  document.getElementById('editModal').classList.add('hidden');
  editDraftExam = null;
};
