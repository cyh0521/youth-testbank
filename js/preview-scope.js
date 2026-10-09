const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const part = value => {
  const text = String(value ?? '').trim();
  return text && Number.isFinite(Number(text)) ? String(Number(text)) : text;
};
export const normalizeScopeCode = code => String(code ?? '').split('-').map(part).join('-');
export function questionScopeCode(q) {
  const values = [q.chapterNum,q.sectionNum,q.subsectionNum];
  const parts = [];
  for (const value of values) {
    const text = part(value);
    if (!text || text === '0') break;
    parts.push(text);
  }
  return parts.join('-');
}
export function scopeContains(scope, questionCode) {
  return !!scope && (questionCode === scope || questionCode.startsWith(scope + '-'));
}

export function previewScopeNodes(exam, questions, catalog = {chapters:[],labels:['章','節','小節']}) {
  const actual = questions.map(questionScopeCode).filter(Boolean);
  const roots = (exam.scopeChapters?.length ? exam.scopeChapters : actual).map(normalizeScopeCode).filter(Boolean);
  const nodes = new Map();
  const add = (parts, title = '') => {
    const code = parts.map(part).join('-');
    if (!roots.some(root => scopeContains(root,code) || scopeContains(code,root))) return;
    const level = parts.length - 1;
    const kind = catalog.labels?.[level] || ['章','節','小節'][level];
    const numbered = /^(?:第\s*[0-9０-９一二三四五六七八九十百千零〇]+\s*(?:單元|章|節|課)|(?:單元|章|節|課)\s*[0-9０-９一二三四五六七八九十百千零〇]+)/;
    const name = String(title || '').trim();
    const numberedPrefix = name.match(numbered)?.[0] || '';
    const prefix = numberedPrefix.trim() || `第${parts.at(-1)}${kind}`;
    const scopeTitle = numberedPrefix ? name.slice(numberedPrefix.length).trim() : name;
    const label = prefix + (scopeTitle ? ' ' + scopeTitle : '');
    if (!nodes.has(code)) nodes.set(code,{code,label,prefix,title:scopeTitle,level,count:actual.filter(q => scopeContains(code,q)).length});
  };
  (catalog.chapters || []).forEach(ch => {
    const first = [part(ch.chapterNum)]; add(first,ch.title);
    (ch.sections || []).forEach(sec => {
      const second = [...first,part(sec.sectionNum)]; add(second,sec.title);
      (sec.subsections || []).forEach(sub => add([...second,part(sub.num)],sub.title));
    });
  });
  [...roots,...actual].forEach(code => {
    const parts = code.split('-');
    parts.forEach((_,i) => add(parts.slice(0,i+1)));
  });
  return [...nodes.values()];
}

export function applyScopeHighlight(paper, activeCode) {
  let count = 0;
  paper.querySelectorAll('[data-ep-scope]').forEach(question => {
    const match = scopeContains(activeCode,question.dataset.epScope);
    question.classList.toggle('ep-scope-highlight',match);
    if (match) count++;
  });
  return count;
}

export function mountPreviewScope(container, exam, questions, onSelection, options = {}) {
  let toggleHost = options.toggleHost || null;
  let reopenButton = null;
  let catalog = {chapters:[],labels:['章','節','小節']};
  let active = '';
  let collapsed = false;
  let nodes = [];
  function sync() {
    container.querySelectorAll('[data-scope-select]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.scopeSelect === active)));
    const node = nodes.find(node => node.code === active);
    container.querySelector('[data-scope-status]').textContent = node ? `已標示 ${node.count} 題` : '點選章節，標示對應試題';
    onSelection(active);
  }
  function syncCollapse() {
    container.classList.toggle('is-collapsed',collapsed);
    const layout = container.closest('.compose-preview-layout') || container.closest('.ep-scope-layout');
    layout?.classList.toggle('is-scope-collapsed',collapsed);
    container.querySelector('.ep-scope-card').hidden = collapsed;
    reopenButton.hidden = !collapsed;
    container.querySelector('#epScopeContents').hidden = collapsed;
    [reopenButton,...container.querySelectorAll('[data-scope-toggle]')].forEach(button => {
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',(collapsed ? '展開' : '收合') + '命題範圍');
    });
  }
  function toggleCollapsed() {
    collapsed = !collapsed;
    syncCollapse();
    (collapsed ? reopenButton : container.querySelector('.ep-scope-toggle')).focus();
  }
  function render(note = '') {
    reopenButton?.remove();
    nodes = previewScopeNodes(exam,questions,catalog);
    const branch = parent => nodes.filter(node => node.code.split('-').slice(0,-1).join('-') === parent).map(node => {
      const children = branch(node.code);
      const button = `<button type="button" class="ep-scope-select" data-scope-select="${escape(node.code)}" aria-pressed="${node.code === active}" title="${escape(node.label)}"><span class="ep-scope-label"><span class="ep-scope-prefix">${escape(node.prefix)}</span><span class="ep-scope-name">${escape(node.title)}</span></span><small>${node.count} 題</small></button>`;
      return children ? `<details class="ep-scope-branch" open><summary>${button}</summary><div class="ep-scope-children">${children}</div></details>` : `<div class="ep-scope-leaf">${button}</div>`;
    }).join('');
    container.innerHTML = `<button type="button" class="ep-scope-reopen" data-scope-reopen aria-controls="epScopeContents" aria-expanded="${!collapsed}" aria-label="展開命題範圍" ${collapsed ? '' : 'hidden'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16M8 5v14"/></svg><span>命題範圍</span></button><section class="card ep-scope-card${collapsed ? ' is-collapsed' : ''}"><div class="card-header ep-scope-heading"><h2>命題範圍</h2><button type="button" class="ep-scope-toggle" data-scope-toggle aria-controls="epScopeContents" aria-expanded="${!collapsed}" aria-label="${collapsed ? '展開' : '收合'}命題範圍"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button></div><div class="ep-scope-content" id="epScopeContents" ${collapsed ? 'hidden' : ''}><div class="ep-scope-actions"><span data-scope-status role="status" aria-live="polite"></span></div>${note ? `<p class="ep-scope-note">${escape(note)}</p>` : ''}<div class="ep-scope-tree">${branch('') || '<p class="ep-scope-note">試題尚無章節資訊</p>'}</div></div></section>`;
    reopenButton = container.querySelector('.ep-scope-reopen');
    reopenButton.onclick = event => { event.stopPropagation(); toggleCollapsed(); };
    if (toggleHost) {
      toggleHost.prepend(reopenButton);
      reopenButton.classList.add('is-header-toggle');
      reopenButton.title = '展開命題範圍';
    }
    syncCollapse();
    sync();
  }
  container.addEventListener('click',event => {
    const toggle = event.target.closest('[data-scope-toggle]');
    if (toggle) {
      toggleCollapsed();
      return;
    }
    const button = event.target.closest('[data-scope-select]');
    if (!button || !container.contains(button)) return;
    event.preventDefault();
    const code = button.dataset.scopeSelect || '';
    active = code === active ? '' : code;
    sync();
  });
  render();
  return {
    get activeCode() { return active; },
    attachToggleHost(host) {
      toggleHost = host;
      host.prepend(reopenButton);
      reopenButton.classList.add('is-header-toggle');
      reopenButton.title = '展開命題範圍';
      syncCollapse();
    },
    destroy() {
      reopenButton?.remove();
      const layout = container.closest('.compose-preview-layout') || container.closest('.ep-scope-layout');
      layout?.classList.remove('is-scope-collapsed');
    },
    setCatalog(next) { catalog = next; render(); },
    showCatalogError() { render('章節名稱載入失敗，目前依編號顯示。'); },
  };
}

const catalogs = new Map();
export async function loadPreviewScopeCatalog(exam) {
  const cache = await window.initTextbookCache();
  const subject = cache.subjectByCode?.[exam.subjectCode];
  const book = (cache.booksBySubject?.[subject?.id] || []).find(book => book.code === exam.bookCode);
  if (!subject || !book) return {chapters:[],labels:['章','節','小節']};
  const key = `${subject.id}/${book.id}`;
  if (!catalogs.has(key)) {
    catalogs.set(key,DataService.getChapterDefs(subject.id,book.id).catch(error => { catalogs.delete(key); throw error; }));
  }
  return {chapters:await catalogs.get(key),labels:[book.l1 || '章',book.l2 || '節',book.l3 || '小節']};
}
