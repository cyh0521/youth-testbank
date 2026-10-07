import { filterComposePool } from './compose-selection.js';

/** Shared scope panel, based on the computer-selection layout. */
export function renderScopePanel({ nextAction, nextLabel }) {
  return `<div class="scope-layout">
            <section class="card"><div class="card-header"><h2>選擇命題科目</h2></div><div class="scope-tree" id="subjectTree"></div></section>
            <section class="card"><div class="card-header"><div class="scope-title"><h2>選擇命題章節</h2><span class="scope-available" id="scopeAvailable">︱可選題數 0 題</span></div><div class="scope-header-actions"><div class="compose-action-tools" id="scopeSelectionTools" role="group" aria-label="範圍工具" hidden><button class="btn btn-ghost btn-sm" onclick="clearAllChapters()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5a2 2 0 0 1 0 3L11 21H6l-4-4a2 2 0 0 1 0-3L13 3a2 2 0 0 1 3 0zM8 8l8 8M11 21h11"/></svg>取消選取</button></div><button class="btn btn-primary btn-sm" onclick="${nextAction}"><svg class="step-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13.5 6 6 6-6 6"/><path d="m6 6 6 6-6 6" stroke-opacity=".5"/></svg>下一步：${nextLabel}</button></div></div><div class="chapter-tree scope-tree" id="chapterTree"><div class="scope-empty">請先選擇左側的科目與冊次</div></div></section>
          </div>
          <div hidden><select id="cSubject" onchange="onSubjectChange()"><option value="">請選擇科目</option></select><select id="cBook" disabled onchange="loadChapters()"><option value="">請先選科目</option></select></div>`;
}

export function mountScopeSelector({ cache, dataService, onChange }) {
  const _tbCache = cache;
  const DataService = dataService;
  const cSubject = document.getElementById('cSubject');
  const escapeTreeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let bookQuestions = [];
  let chapterData = {};
  let chapterCatalog = { labels: ['章', '節', ''], chapters: [] };
  const getSelectedChapters = () => [...document.querySelectorAll('.chap-cb:checked:not(:disabled)')]
    .map(cb => cb.dataset.sub ? `${cb.dataset.ch}-${cb.dataset.sec}-${cb.dataset.sub}` : cb.dataset.sec ? `${cb.dataset.ch}-${cb.dataset.sec}` : cb.dataset.ch);
  const selectedQuestions = () => filterComposePool(bookQuestions, {
    subjectCode: cSubject.value, bookCode: document.getElementById('cBook').value,
    chapters: getSelectedChapters()
  });
  function notify(reason = 'selection') {
    document.getElementById('scopeSelectionTools').hidden = getSelectedChapters().length === 0;
    const questions = selectedQuestions();
    document.getElementById('scopeAvailable').textContent = `︱可選題數 ${questions.length} 題`;
    onChange(bookQuestions, questions, reason);
  }
  function renderScopeCatalog() {
    const tree = document.getElementById('subjectTree');
    tree.innerHTML = (_tbCache?.subjects || []).map(subject => {
      const books = _tbCache.booksBySubject[subject.id] || [];
      return `<details class="subject-node"><summary>${escapeTreeText(subject.name)}</summary>${books.length ? books.map(book =>
        `<label class="book-node"><input type="radio" name="scopeBook" data-subject="${escapeTreeText(subject.code)}" value="${escapeTreeText(book.code)}"><span>${escapeTreeText(book.name)}</span></label>`
      ).join('') : '<div class="scope-empty">尚無冊次</div>'}</details>`;
    }).join('') || '<div class="scope-empty">尚無科目</div>';
  }
  let bookLoadRevision = 0;
  document.getElementById('subjectTree').addEventListener('change', async event => {
    const input = event.target;
    if (input.name !== 'scopeBook' || input.disabled) return;
    cSubject.value = input.dataset.subject;
    window.onSubjectChange();
    document.getElementById('cBook').value = input.value;
    await window.loadChapters();
  });

  let lastChapterAnchor = null;
  const chapterTree = document.getElementById('chapterTree');
  chapterTree.addEventListener('click', event => {
    const row = event.target.closest('.chapter-item');
    if (!row || event.target.closest('.expand-btn')) return;
    const label = event.target.closest('label');
    const directInput = event.target.matches('.chap-cb');
    const cb = directInput ? event.target : label?.control || row.querySelector(':scope > .chap-cb');
    if (!cb || cb.disabled || !chapterTree.contains(cb)) return;
    if (!directInput && !label) {
      if (event.shiftKey) {
        const anchor = lastChapterAnchor;
        lastChapterAnchor = cb;
        selectChapterRange(anchor, cb);
      } else cb.click();
      return;
    }
    if (!event.shiftKey) {
      if (directInput) lastChapterAnchor = cb;
      return;
    }
    event.preventDefault();
    const anchor = lastChapterAnchor;
    lastChapterAnchor = cb;
    // 讓核取方塊的瀏覽器預設點擊狀態先結束，再一次套用整段範圍。
    setTimeout(() => selectChapterRange(anchor, cb), 0);
  }, true);

  function selectChapterRange(anchor, target) {
    const visible = [...chapterTree.querySelectorAll('.chap-cb')].filter(cb => !cb.disabled && cb.getClientRects().length);
    const start = visible.indexOf(anchor), end = visible.indexOf(target);
    if (end < 0) return;
    const range = start < 0 ? [target] : visible.slice(Math.min(start,end), Math.max(start,end)+1);
    const sameLevel = start < 0 || (anchor.classList.contains('chapter-cb') === target.classList.contains('chapter-cb') && anchor.classList.contains('sec-cb') === target.classList.contains('sec-cb'));
    const selected = sameLevel
      ? range.filter(cb => cb.classList.contains('chapter-cb') === target.classList.contains('chapter-cb') && cb.classList.contains('sec-cb') === target.classList.contains('sec-cb'))
      : range.filter(cb => !cb.closest('.chapter-item').nextElementSibling?.classList.contains('chapter-children'));
    if (!selected.includes(target)) selected.push(target);
    for (const cb of selected) {
      cb.checked = true;
      cb.indeterminate = false;
      if (cb.classList.contains('chapter-cb')) chapterTree.querySelectorAll(`.chap-cb[data-ch="${cb.dataset.ch}"]:not(.chapter-cb):not(:disabled)`).forEach(child => { child.checked = true; child.indeterminate = false; });
      else if (cb.classList.contains('sec-cb')) chapterTree.querySelectorAll(`.chap-cb[data-ch="${cb.dataset.ch}"][data-sec="${cb.dataset.sec}"][data-sub]:not(:disabled)`).forEach(child => { child.checked = true; child.indeterminate = false; });
    }
    chapterTree.querySelectorAll('.sec-cb').forEach(cb => syncParentCb(cb.dataset.ch, cb.dataset.sec));
    notify('book');
  }
  window.onSubjectChange = () => {
    bookLoadRevision++;
    lastChapterAnchor = null;
    const sc = cSubject.value;
    const bk = document.getElementById('cBook');
    if (sc) {
      const subject = _tbCache.subjectByCode[sc];
      const books = subject ? _tbCache.booksBySubject[subject.id] || [] : [];
      bk.innerHTML = '<option value="">請選擇冊次</option>' + books.map(book => `<option value="${escapeTreeText(book.code)}">${escapeTreeText(book.name)}</option>`).join('');
      bk.disabled = false;
    } else {
      bk.disabled = true;
      bk.innerHTML = '<option value="">請先選科目</option>';
    }
    document.getElementById('chapterTree').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.88rem">請選擇冊次</div>';
    document.getElementById('scopeAvailable').textContent = '︱可選題數 0 題';
    bookQuestions = [];
    notify('book');
  };

  window.loadChapters = async () => {
    const sc = cSubject.value, bc = document.getElementById('cBook').value;
    const revision = ++bookLoadRevision;
    bookQuestions = [];
    notify('book');
    if (!sc || !bc) { document.getElementById('chapterTree').innerHTML = '<div class="scope-empty">請先選擇冊次</div>'; return; }
    const tree = document.getElementById('chapterTree');
    tree.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:.88rem">載入中…</div>';
    document.getElementById('scopeAvailable').textContent = '︱可選題數 0 題';

    const isCurrentBook = () => revision === bookLoadRevision && cSubject.value === sc && document.getElementById('cBook').value === bc;
    let qs = [];
    try {
      qs = await DataService.getQuestions({ subjectCode:sc, bookCode:bc });
    } catch(e) {
      if (isCurrentBook()) tree.innerHTML = `<div class="scope-empty">載入失敗：${escapeTreeText(e.message)}</div>`;
      return;
    }
    if (!isCurrentBook()) return;
    if (!qs.length) { tree.innerHTML = '<div class="scope-empty">此冊次尚無題目</div>'; return; }
    // 統計每章每節的題目數量
    const countMap = {};
    qs.forEach(q => {
      const ch = q.chapterNum; if (!ch) return;
      if (!countMap[ch]) countMap[ch] = { count: 0, sections: {}, subsections: {} };
      countMap[ch].count++;
      if (q.sectionNum) {
        countMap[ch].sections[q.sectionNum] = (countMap[ch].sections[q.sectionNum]||0) + 1;
        if (q.subsectionNum) {
          const key = `${q.sectionNum}-${q.subsectionNum}`;
          countMap[ch].subsections[key] = (countMap[ch].subsections[key]||0) + 1;
        }
      }
    });
    chapterData = countMap;


    // 從課本管理讀取章節定義（名稱）
    const subj = _tbCache?.subjectByCode?.[sc];
    const bookObj = subj ? (_tbCache?.booksBySubject?.[subj.id]||[]).find(b=>b.code===bc) : null;
    let tbChapters = [];
    if (subj && bookObj) {
      try {
        tbChapters = await DataService.getChapterDefs(subj.id, bookObj.id);
      } catch (e) {
        if (isCurrentBook()) tree.innerHTML = '<div class="scope-empty">載入章節失敗：' + escapeTreeText(e.message) + '</div>';
        return;
      }
      if (!isCurrentBook()) return;
    }
    const l1 = bookObj?.l1 || '章';
    const l2 = bookObj?.l2 || '節';

    // 合併課本定義與題目統計
    const allChNums = new Set([
      ...tbChapters.map(c => String(c.chapterNum)),
      ...Object.keys(countMap)
    ]);
    if (!allChNums.size) {
      tree.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.88rem">此科目/冊次無題目</div>';
      return;
    }

    // 建立章節名稱對照
    const chTitles = {};
    const secTitles = {};
    const subsecTitles = {};  // ch -> sec -> [{num, title}]
    const l3 = bookObj?.l3 || '';
    chapterCatalog = { labels: [l1, l2, l3], chapters: tbChapters };
    tbChapters.forEach(c => {
      chTitles[String(c.chapterNum)] = c.title || '';
      (c.sections||[]).forEach(s => {
        if (!secTitles[String(c.chapterNum)]) secTitles[String(c.chapterNum)] = {};
        secTitles[String(c.chapterNum)][String(s.sectionNum)] = s.title || '';
        if (l3 && (s.subsections||[]).length) {
          if (!subsecTitles[String(c.chapterNum)]) subsecTitles[String(c.chapterNum)] = {};
          subsecTitles[String(c.chapterNum)][String(s.sectionNum)] = s.subsections;
        }
      });
    });

    tree.innerHTML = [...allChNums].sort((a,b)=>parseInt(a)-parseInt(b)).map(ch => {
      const info = countMap[ch] || { count: 0, sections: {}, subsections: {} };
      const allSecs = new Set([
        ...Object.keys((secTitles[ch]||{})),
        ...Object.keys(info.sections)
      ]);
      const hasChildren = l2 && allSecs.size > 0;
      const secHTML = l2 ? [...allSecs].sort((a,b)=>parseInt(a)-parseInt(b)).map(sec => {
        const cnt = info.sections[sec] || 0;
        const subs = subsecTitles[ch]?.[sec] || [];
        const hasSubChildren = l3 && subs.length > 0;
        const subsHTML = hasSubChildren ? subs.map(ss => `
          <div class="chapter-item subsection">
            <span style="width:16px;flex-shrink:0;display:inline-block"></span>
            <input type="checkbox" class="chap-cb" data-ch="${ch}" data-sec="${sec}" data-sub="${ss.num}">
            <span>${escapeTreeText(ss.title || (l3+ss.num))}</span>
            <span class="ch-count">${info.subsections[`${sec}-${ss.num}`] || 0} 題</span>
          </div>`).join('') : '';
        return `<div class="chapter-item section">
          ${hasSubChildren ? `<button class="expand-btn" onclick="toggleChildren(this)" aria-label="展開章節" aria-expanded="false">▶</button>` : '<span style="width:16px;flex-shrink:0"></span>'}
          <input type="checkbox" class="chap-cb sec-cb" data-ch="${ch}" data-sec="${sec}" onchange="onSecCbChange(this)">
          <span>${escapeTreeText(secTitles[ch]?.[sec] || (l2+parseInt(sec)))}</span>
          <span class="ch-count">${cnt} 題</span>
        </div>${hasSubChildren ? `<div class="chapter-children">${subsHTML}</div>` : ''}`;
      }).join('') : '';
      return `<div class="chapter-item">
          ${hasChildren ? `<button class="expand-btn" onclick="toggleChildren(this)" aria-label="展開章節" aria-expanded="false">▶</button>` : '<span style="width:16px;flex-shrink:0"></span>'}
          <input type="checkbox" class="chap-cb chapter-cb" data-ch="${ch}" onchange="onChapterCbChange(this)">
          <span>${escapeTreeText(chTitles[ch] || (l1+parseInt(ch)))}</span>
          <span class="ch-count">${info.count} 題</span>
        </div>${hasChildren ? `<div class="chapter-children">${secHTML}</div>` : secHTML}`;
    }).join('');
    bookQuestions = qs;
    lastChapterAnchor = null;
    tree.querySelectorAll('.chap-cb').forEach((cb, index) => {
      const info = chapterData[cb.dataset.ch];
      const count = cb.dataset.sub ? info?.subsections[`${cb.dataset.sec}-${cb.dataset.sub}`] || 0
        : cb.dataset.sec ? info?.sections[cb.dataset.sec] || 0 : info?.count || 0;
      cb.disabled = count === 0;
      cb.closest('.chapter-item').classList.toggle('is-disabled', cb.disabled);
      if (cb.disabled) cb.closest('.chapter-item').title = '尚無題目';
      cb.id = 'scopeChapter' + index;
      const text = cb.nextElementSibling;
      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.textContent = text.textContent;
      text.replaceWith(label);
    });
    notify('loaded');
  };

  window.toggleChildren = (btn) => {
    const parent = btn.closest('.chapter-item');
    const children = parent.nextElementSibling;
    if (!children || !children.classList.contains('chapter-children')) return;
    const open = children.classList.toggle('open');
    btn.textContent = open ? '▼' : '▶';
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '收合章節' : '展開章節');
  };

  // 向上同步：子項全勾→上層勾；子項未全勾→上層取消
  function syncParentCb(ch, sec) {
    // 同步第二層（sec-cb）：若該章所有 sec-cb 全勾則章勾，否則取消
    // 同步第三層→第二層：若該節所有 sub 全勾則節勾，否則取消
    if (sec !== undefined) {
      const subs = [...document.querySelectorAll(`.chap-cb[data-ch="${ch}"][data-sec="${sec}"][data-sub]:not(:disabled)`)];
      if (subs.length) {
        const secCb = document.querySelector(`.chap-cb.sec-cb[data-ch="${ch}"][data-sec="${sec}"]`);
        if (secCb) {
          secCb.checked = subs.every(s => s.checked);
          secCb.indeterminate = !secCb.checked && subs.some(s => s.checked);
        }
      }
    }
    // 同步章：若所有非 chapter-cb 的 chap-cb 全勾則章勾
    const allChildren = [...document.querySelectorAll(`.chap-cb[data-ch="${ch}"]:not(.chapter-cb):not(:disabled)`)];
    if (allChildren.length) {
      const chapCb = document.querySelector(`.chap-cb.chapter-cb[data-ch="${ch}"]`);
      if (chapCb) {
        chapCb.checked = allChildren.every(s => s.checked);
        chapCb.indeterminate = !chapCb.checked && allChildren.some(s => s.checked);
      }
    }
  }

  window.onSecCbChange = (cb) => {
    if (cb.disabled) return;
    const ch = cb.dataset.ch, sec = cb.dataset.sec, checked = cb.checked;
    cb.indeterminate = false;
    // 下行：同步所有子節
    document.querySelectorAll(`.chap-cb[data-ch="${ch}"][data-sec="${sec}"][data-sub]:not(:disabled)`).forEach(s => { s.checked = checked; s.indeterminate = false; });
    // 上行：同步章
    syncParentCb(ch, undefined);
    notify();
  };

  window.onChapterCbChange = (cb) => {
    if (cb.disabled) return;
    const ch = cb.dataset.ch;
    const checked = cb.checked;
    cb.indeterminate = false;
    document.querySelectorAll(`.chap-cb[data-ch="${ch}"]:not(.chapter-cb):not(:disabled)`).forEach(s => { s.checked = checked; s.indeterminate = false; });
    notify();
  };

  // 第三層直接點選 → 觸發向上同步
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.classList.contains('chap-cb') || t.disabled) return;
    if (t.classList.contains('chapter-cb') || t.classList.contains('sec-cb')) return;
    // 第三層：向上同步節和章
    syncParentCb(t.dataset.ch, t.dataset.sec);
    notify();
  });

  window.clearAllChapters = () => {
    document.querySelectorAll('.chap-cb').forEach(c => { c.checked = false; c.indeterminate = false; });
    lastChapterAnchor = null;
    notify();
  };


  renderScopeCatalog();
  return { getQuestions: selectedQuestions, getSelectedChapters, getChapterCatalog: () => chapterCatalog, clear: window.clearAllChapters };
}
