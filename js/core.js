/**
 * 幼獅題庫系統 — 共用常數與工具
 * =====================================================
 * 此檔提供全域常數、UI 工具函式、課本快取輔助。
 * 資料存取請使用 DataService（js/firebase.js）。
 * =====================================================
 */

// ── 常數 ──────────────────────────────────────────────
const QUESTION_TYPES = {
  T1:'是非題', T2:'單選題', T3:'複選題',
  T4:'填空題', T5:'配合題', T6:'問答題'
};

const COMPOSE_DIFFICULTY = {
  hard:   { label:'偏難',     weights:{ '◎':0.6,  '':0.3,  '△':0.1 } },
  medium: { label:'適中',     weights:{ '◎':0.34, '':0.33, '△':0.33 } },
  easy:   { label:'偏易',     weights:{ '◎':0.1,  '':0.3,  '△':0.6 } },
  any:    { label:'不限難易', weights:null }
};

const SOURCE_CODES  = { A1:'課本', A2:'四技二專考題' };

const SUBJECT_CODES = {
  A1:'大學全民國防教育', B1:'高中全民國防教育', C1:'健康與護理',
  D1:'生涯規劃',         E1:'家政',             F1:'生命教育',
  G1:'高中美術',         H1:'技高美術',         I1:'生活科技'
};

const BOOK_CODES = {
  A1:{'01':'國際情勢','02':'國防政策','03':'全民國防','04':'防衛動員','05':'國防科技'},
  B1:{'01':'高中全民國防教育（甲版）','02':'高中全民國防教育（乙版）'},
  C1:{'01':'健康與護理','02':'安全教育與傷害防護','03':'運動與健康','04':'健康與休閒生活'},
  D1:{'01':'高中生涯規劃','02':'選修','03':'技高生涯規劃'},
  E1:{'01':'高中家政','02':'選修'},
  F1:{'01':'生命教育','02':'選修'},
  G1:{'01':'高中美術（上）','02':'高中美術（下）','03':'高中藝術生活','04':'選修'},
  H1:{'01':'技高美術'},
  I1:{'01':'生活科技'}
};

// ── DocImporter — 將解析後的列轉成題目物件（import 頁使用）──
const DocImporter = {
  rowToQuestion(row, subjectCode, bookCode) {
    const type    = (row['題型']||'').trim();
    const chap    = parseInt(row['章數']||'0') || 0;
    const sec     = parseInt(row['節數']||'0') || 0;
    const sub     = parseInt(row['小節']||'0') || 0;
    const chapStr = String(chap).padStart(2,'0');
    const secStr  = String(sec).padStart(2,'0');
    const subStr  = String(sub).padStart(2,'0');

    let catalogCode = '';
    if (subjectCode && bookCode) {
      if (subjectCode === 'B1')      catalogCode = `${subjectCode}-${bookCode}-${chapStr}${secStr}${subStr}`;
      else if (subjectCode === 'C1') catalogCode = `${subjectCode}-${bookCode}-${chapStr}${secStr}`;
      else                            catalogCode = `${subjectCode}-${bookCode}-${chapStr}`;
    }

    const q = {
      subjectCode, bookCode, type,
      difficulty:    (row['難易']||'').trim(),
      source:        (row['頁數/出處']||row['頁數']||'').trim(),
      sourceCode:    (row['來源']||'A1').trim(),
      answerCount:   parseInt(row['答數']||'1') || 1,
      answer:        (row['簡答/答案']||row['簡答']||'').trim(),
      text:          (row['題目']||'').trim(),
      analysis:      (row['詳答/解析']||row['詳答']||'').trim(),
      chapterNum:    chap,
      sectionNum:    sec,
      subsectionNum: sub,
      catalogCode
    };
    if (type === 'T2') {
      q.options = [row['選項1']||'',row['選項2']||'',row['選項3']||'',row['選項4']||'',row['選項5']||'']
        .filter(o => o !== '');
      q.tail = (row['結尾']||'').trim();
    }
    return q;
  }
};

// ── UI 工具 ───────────────────────────────────────────
const UI = {
  escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  },

  /** 通知 toast — 使用 css/theme.css 內定義的 .toast 樣式 */
  toast(msg, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success:'✓', danger:'✕', warning:'⚠', info:'ℹ' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span class="toast-msg"></span>`;
    el.querySelector('.toast-msg').textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return `${UI.formatDate(iso)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  typeBadge(type) {
    return `<span class="badge badge-${type.toLowerCase()}">${QUESTION_TYPES[type]||type}</span>`;
  },

  diffBadge(diff) {
    if (diff === '◎') return `<span class="badge badge-hard">較難</span>`;
    if (diff === '△') return `<span class="badge badge-easy">簡易</span>`;
    return `<span class="badge badge-normal">一般</span>`;
  },

  /**
   * 批次替換 DOM 中的 data-icon 屬性為 SVG
   * 用法：<button><span data-icon="upload20"></span> 匯入</button>
   * 自動在 DOMContentLoaded 執行一次，若動態生成可呼叫 UI.renderIcons(container)
   */
  renderIcons(root = document) {
    if (!window.ICONS) return;
    root.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.dataset.icon;
      if (window.ICONS[name]) {
        el.innerHTML = window.ICONS[name];
        el.removeAttribute('data-icon');  // 執行過一次就清掉，避免動態內容重複展開
      }
    });
  }
};

// 頁面載入時自動渲染 static icon placeholder
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ICONS) UI.renderIcons();
  });
}

// ── 路由：side bar 用 ────────────────────────────────
function nav(page) {
  const pages = {
    dashboard:'dashboard.html', import:'import.html', questions:'questions.html',
    compose:'compose.html', manual:'manual.html', coded:'coded.html',
    exams:'exams.html', settings:'settings.html',
    textbooks:'textbooks.html'
  };
  if (pages[page]) window.location.href = pages[page];
}

// ── 課本快取（全域，供 import/questions/compose/manual 使用）──
window._tbCache = null;

window.initTextbookCache = async function() {
  if (window._tbCache) return window._tbCache;
  await window._dsReady;
  window._tbCache = await DataService.loadTextbookCache();
  return window._tbCache;
};

window.tbSubjectOptions = function(selectedCode = '') {
  if (!window._tbCache) return '<option value="">（讀取中）</option>';
  let h = '<option value="">請選擇科目</option>';
  for (const s of window._tbCache.subjects) {
    h += `<option value="${s.code}" ${selectedCode === s.code ? 'selected' : ''}>${s.name}</option>`;
  }
  return h;
};

// ── 班級分類下拉選單（各出題頁與試卷編輯共用）────────────
window.loadClassOptions = async function(selectId, selectedId = '') {
  const select = document.getElementById(selectId);
  if (!select) return [];
  try {
    const classes = await DataService.getClasses();
    select.innerHTML = '<option value="">未分類</option>' + classes.map(c => {
      const label = [c.school, c.name].filter(Boolean).join('｜');
      return `<option value="${UI.escapeHtml(c.id)}" data-name="${UI.escapeHtml(c.name || '')}" data-school="${UI.escapeHtml(c.school || '')}">${UI.escapeHtml(label || '未命名班級')}</option>`;
    }).join('');
    select.value = selectedId || '';
    return classes;
  } catch (e) {
    console.warn('Class options error:', e);
    select.innerHTML = '<option value="">未分類（班級載入失敗）</option>';
    return [];
  }
};

window.tbBookOptions = function(subjectCode, selectedCode = '') {
  if (!window._tbCache) return '<option value="">（讀取中）</option>';
  const subj = window._tbCache.subjectByCode[subjectCode];
  if (!subj) return '<option value="">請先選科目</option>';
  const books = window._tbCache.booksBySubject[subj.id] || [];
  let h = '<option value="">請選擇冊別</option>';
  for (const b of books) {
    h += `<option value="${b.code}" ${selectedCode === b.code ? 'selected' : ''}>${b.name}</option>`;
  }
  return h;
};

window.tbSubjectName = function(subjectCode) {
  return window._tbCache?.subjectByCode?.[subjectCode]?.name || subjectCode || '—';
};

window.tbBookName = function(bookCode) {
  return window._tbCache?.books?.[bookCode]?.name || bookCode || '—';
};
