/**
 * 幼獅題庫系統 — 試卷預覽 & Word 輸出模組 v2
 * 格式參考 exam-sample.docx
 */

const TYPE_ORDER  = ['T1','T2','T3','T4','T5','T6'];
const TYPE_LABELS = { T1:'是非題', T2:'選擇題', T3:'複選題', T4:'填空題', T5:'配合題', T6:'問答題' };
const ROMANS      = ['一','二','三','四','五','六','七','八'];

const GRADE_OPTIONS  = ['一年級','二年級','三年級','四年級'];
const EXAM_OPTIONS   = ['第一次段考','第二次段考','期中考','期末考','隨堂測驗','其他'];

function groupByType(questions) {
  const g = {};
  questions.forEach(q => { if (!g[q.type]) g[q.type] = []; g[q.type].push(q); });
  return g;
}
function orderedTypes(g) { return TYPE_ORDER.filter(t => g[t]?.length); }

// ══════════════════════════════════════════════════════════
//  確保 Modal 存在
// ══════════════════════════════════════════════════════════
function ensureModal() {
  if (document.getElementById('epModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
<style>
/* 試卷表頭表單 */
.ep-header-form{background:#f5f3ee;border:1px solid #ddd8d0;border-radius:6px;padding:14px 16px;margin-bottom:18px;font-size:.84rem}
.ep-header-form table{width:100%;border-collapse:collapse}
.ep-header-form td{padding:5px 8px;vertical-align:middle;white-space:nowrap}
.ep-header-form td:first-child{color:#4a5568;font-weight:500;width:52px}
.ep-header-form input,.ep-header-form select{
  border:1px solid #ccc;border-radius:4px;padding:4px 8px;font-size:.84rem;
  font-family:var(--font-sans);background:white;
}
.ep-header-form input{min-width:120px}
.ep-header-form select{min-width:110px}
/* 試卷排版 */
#epPaper{font-family:"新細明體","PMingLiU","Microsoft JhengHei",serif;font-size:14px;line-height:1.85;color:#000}
.ep-exam-header{border:2px solid #333;padding:10px 14px;margin-bottom:14px;font-size:13px}
.ep-exam-header .title-row{font-size:15px;font-weight:700;margin-bottom:6px}
.ep-exam-header .info-row{display:flex;gap:24px;font-size:13px}
.ep-section-head{font-weight:700;margin:14px 0 8px}
.ep-q{margin-bottom:8px;line-height:1.85}
.ep-q .q-no{font-weight:700}
.ep-opts{margin:3px 0 3px 2em}
.ep-tail{margin-left:1em}
.ep-answer-blank{color:#888;margin-top:4px}
</style>
<div class="modal-overlay hidden" id="epModal">
  <div class="modal" style="max-width:860px;width:96%;max-height:94vh;display:flex;flex-direction:column">
    <div class="modal-header" style="flex-shrink:0">
      <h3 id="epTitle" style="flex:1">試卷預覽</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-primary btn-sm" onclick="window._epDoExport()">⬇ 輸出 Word</button>
        <button class="modal-close" onclick="document.getElementById('epModal').classList.add('hidden')">✕</button>
      </div>
    </div>
    <!-- 表頭設定區 -->
    <div style="padding:14px 20px 0;flex-shrink:0">
      <div class="ep-header-form">
        <table>
          <tr>
            <td>學校</td>
            <td><input id="epSchool" placeholder="學校名稱（選填）" style="width:200px"></td>
            <td style="padding-left:20px">學期</td>
            <td>
              <input id="epYear" placeholder="○○○" style="width:60px"> 學年度第
              <select id="epSemester">
                <option value="○">○</option>
                <option value="一">一</option>
                <option value="二">二</option>
              </select> 學期
            </td>
          </tr>
          <tr>
            <td>年級</td>
            <td>
              <select id="epGrade">
                <option value="">請選擇</option>
                ${GRADE_OPTIONS.map(g=>`<option value="${g}">${g}</option>`).join('')}
              </select>
            </td>
            <td style="padding-left:20px">試別</td>
            <td>
              <select id="epExamType">
                <option value="">請選擇</option>
                ${EXAM_OPTIONS.map(e=>`<option value="${e}">${e}</option>`).join('')}
              </select>
            </td>
          </tr>
          <tr>
            <td>科目</td>
            <td id="epSubjectCell" colspan="3" style="font-weight:500"></td>
          </tr>
          <tr>
            <td>範圍</td>
            <td colspan="3"><input id="epRange" placeholder="考試範圍（選填）" style="width:340px"></td>
          </tr>
        </table>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <span style="font-size:.78rem;color:var(--text-muted)">修改上方欄位後試卷預覽即時更新</span>
          <button class="btn btn-ghost btn-sm" onclick="window._epRefresh()" style="margin-left:auto">🔄 重新整理預覽</button>
        </div>
      </div>
    </div>
    <!-- 試卷預覽 -->
    <div id="epBody" style="padding:0 20px 20px;overflow-y:auto;flex:1"></div>
  </div>
</div>`);

  // 表頭欄位變動時即時更新預覽
  ['epSchool','epYear','epSemester','epGrade','epExamType','epRange'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => window._epRefresh?.());
    if (el && el.tagName==='INPUT') el.addEventListener('input', () => window._epRefresh?.());
  });
}

// ══════════════════════════════════════════════════════════
//  顯示預覽
// ══════════════════════════════════════════════════════════
export function showExamPreview(examData, questions) {
  ensureModal();

  // 填入科目
  const subjLabel = (typeof tbSubjectName === 'function')
    ? tbSubjectName(examData.subjectCode)
    : (examData.subjectCode || '');
  const bookLabel = (typeof tbBookName === 'function')
    ? tbBookName(examData.bookCode)
    : (examData.bookCode || '');
  document.getElementById('epSubjectCell').textContent =
    subjLabel + (bookLabel ? `（${bookLabel}）` : '');

  document.getElementById('epTitle').textContent = `預覽：${examData.title || '試卷'}`;

  // 儲存資料供 refresh/export 使用
  window._epExamData  = examData;
  window._epQuestions = questions;
  window._epRefresh   = () => renderPaper(examData, questions);
  window._epDoExport  = () => exportToWord(examData, questions);

  renderPaper(examData, questions);
  document.getElementById('epModal').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════
//  讀取表頭欄位
// ══════════════════════════════════════════════════════════
function getHeaderInfo() {
  return {
    school:   (document.getElementById('epSchool')?.value   || '').trim(),
    year:     (document.getElementById('epYear')?.value     || '○○○').trim() || '○○○',
    semester: (document.getElementById('epSemester')?.value || '○'),
    grade:    (document.getElementById('epGrade')?.value    || ''),
    examType: (document.getElementById('epExamType')?.value || ''),
    range:    (document.getElementById('epRange')?.value    || '').trim(),
    subject:  (document.getElementById('epSubjectCell')?.textContent || '').trim(),
  };
}

// ══════════════════════════════════════════════════════════
//  渲染試卷 HTML（預覽用）
// ══════════════════════════════════════════════════════════
function renderPaper(examData, questions) {
  const h    = getHeaderInfo();
  const typeScores = examData.typeScores || {};
  const grouped    = groupByType(questions);
  const types      = orderedTypes(grouped);

  // ── 表頭 ─────────────────────────────────────────────
  const headerLine1 = [
    h.year + '學年度第' + h.semester + '學期',
    h.subject,
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
      ${rangeText ? `<div style="margin-top:4px;font-size:12px">範圍：${h.range}</div>` : ''}
    </div>`;

  // ── 題目 ─────────────────────────────────────────────
  types.forEach((type, secIdx) => {
    const qs    = grouped[type];
    const score = typeScores[type] || 2;
    const total = qs.length * score;
    html += `<div class="ep-section-head">${ROMANS[secIdx]}、${TYPE_LABELS[type]}（每題 ${score} 分，共 ${total} 分）</div>`;
    qs.forEach((q, i) => {
      html += renderQPreview(q, i+1, type);
    });
  });

  // ── 解答 ─────────────────────────────────────────────
  html += `<div style="border-top:2px dashed #aaa;margin-top:20px;padding-top:12px">
    <div style="font-weight:700;margin-bottom:8px">【解答】</div>`;
  types.forEach((type, secIdx) => {
    const qs = grouped[type];
    html += `<div style="margin-bottom:6px"><b>${ROMANS[secIdx]}、${TYPE_LABELS[type]}：</b>`;
    if (type === 'T6' || type === 'T5' || type === 'T4') {
      html += `</div>`;
      qs.forEach((q,i) => {
        html += `<div style="margin-bottom:4px">${i+1}. ${q.answer||'—'}`;
        if (q.analysis) html += `<div style="margin-left:1.5em;color:#555;font-size:.82rem">【解析】${q.analysis}</div>`;
        html += `</div>`;
      });
    } else {
      html += qs.map((q,i) => `${i+1}.${q.answer||'—'}`).join('　　') + `</div>`;
      const withAnalysis = qs.filter(q => q.analysis);
      if (withAnalysis.length) {
        withAnalysis.forEach(q => {
          const no = qs.indexOf(q)+1;
          html += `<div style="margin-left:1.5em;color:#555;font-size:.82rem;margin-bottom:3px">${no}.【解析】${q.analysis}</div>`;
        });
      }
    }
  });
  html += `</div></div>`;

  document.getElementById('epBody').innerHTML = html;
}

function renderQPreview(q, num, type) {
  // No difficulty mark shown on exam
  let body = '';
  if (type === 'T1') {
    body = `（　）${num}.${q.text||''}`;
  } else if (type === 'T2') {
    const opts = q.options?.length
      ? `<div class="ep-opts">${q.options.map((o,i)=>`(${String.fromCharCode(65+i)})${o}`).join('　')}</div>` : '';
    if (q.tail) {
      body = `${num}.${q.text||''}${opts}<div class="ep-tail">${q.tail}</div>`;
    } else {
      body = `${num}.${q.text||''}${opts}`;
    }
  } else if (type === 'T6') {
    body = `${num}.${q.text||''}<div class="ep-answer-blank">答：</div>`;
  } else {
    body = `${num}.${q.text||''}`;
  }
  return `<div class="ep-q">${body}</div>`;
}

// ══════════════════════════════════════════════════════════
//  輸出 Word
// ══════════════════════════════════════════════════════════
export function exportToWord(examData, questions) {
  const h    = getHeaderInfo();
  const typeScores = examData.typeScores || {};
  const grouped    = groupByType(questions);
  const types      = orderedTypes(grouped);

  const title = examData.title || '試卷';
  const headerLine1 = [
    h.year + '學年度第' + h.semester + '學期',
    h.subject,
    h.grade,
    h.examType,
  ].filter(Boolean).join('　');

  let body = '';

  // ── 試卷表頭（仿 exam-sample：框線表格）──────────────
  body += `<table border="1" cellspacing="0" cellpadding="6"
    style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:12pt">
    <tr>
      <td colspan="4" style="font-size:14pt;font-weight:bold;text-align:left">
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

  // ── 題目 ─────────────────────────────────────────────
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
      } else if (type === 'T4') {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
      } else if (type === 'T5') {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
      } else {
        body += `<p style="margin:3pt 0">${num}.${q.text||''}</p>`;
      }
    });
  });

  // ── 解答頁（換頁）────────────────────────────────────
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

  // ── Word HTML wrapper ─────────────────────────────────
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
  body { font-family:"新細明體","PMingLiU",serif; font-size:12pt;
         line-height:1.85; div:Section1; }
  p    { margin:3pt 0; }
  table { border-collapse:collapse; width:100%; }
  td   { padding:5pt 8pt; font-size:12pt; }
</style>
</head><body>${body}</body></html>`;

  const blob = new Blob(['\uFEFF' + wordHtml], { type:'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.doc`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
}
