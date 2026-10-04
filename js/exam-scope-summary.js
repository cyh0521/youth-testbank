const chapterCache = new Map();

function scopeLabel(parts, chapters, book) {
  const number = value => String(Number(value) || value);
  const sameNumber = (a, b) => Number(a) === Number(b);
  const levelLabel = (kind, value, title) => {
    const name = String(title || '').trim();
    if (!name) return `${kind} ${number(value)}`;
    const numberedTitle = /^(?:第\s*[0-9０-９一二三四五六七八九十百千零〇]+\s*(?:單元|單|章|節|課)|(?:單元|單|章|節|課)\s*[0-9０-９一二三四五六七八九十百千零〇]+)/;
    return numberedTitle.test(name) ? name : `${kind} ${number(value)}　${name}`;
  };
  const chapter = chapters.find(item => sameNumber(item.chapterNum, parts[0]));
  const labels = [levelLabel(book?.l1 || '章', parts[0], chapter?.title)];
  if (parts.length > 1) {
    const section = (chapter?.sections || []).find(item => sameNumber(item.sectionNum, parts[1]));
    labels.push(levelLabel(book?.l2 || '節', parts[1], section?.title));
    if (parts.length > 2) {
      const subsection = (section?.subsections || []).find(item => sameNumber(item.num, parts[2]));
      labels.push(levelLabel(book?.l3 || '小節', parts[2], subsection?.title));
    }
  }
  return labels.join('／');
}

export async function examScopeSummaryHtml(exam) {
  if (!Array.isArray(exam.scopeChapters) || !exam.scopeChapters.length) {
    return '<p class="edit-scope-empty">此試卷尚未記錄命題範圍。</p>';
  }

  const selected = [...new Set(exam.scopeChapters.map(String))];
  const compact = selected.filter(code => !selected.some(parent => parent !== code && code.startsWith(parent + '-')));
  let book = null;
  let chapters = [];
  try {
    const cache = await window.initTextbookCache();
    const subject = cache.subjectByCode?.[exam.subjectCode];
    book = (cache.booksBySubject?.[subject?.id] || []).find(item => item.code === exam.bookCode);
    if (subject && book) {
      const key = `${subject.id}/${book.id}`;
      if (!chapterCache.has(key)) chapterCache.set(key, DataService.getChapterDefs(subject.id, book.id));
      chapters = await chapterCache.get(key);
    }
  } catch (error) {
    // 章節名稱無法載入時仍顯示已記錄的章節編號。
  }
  return `<div class="edit-scope-title">命題範圍</div><ul class="edit-scope-list">${compact.map(code =>
    `<li>${UI.escapeHtml(scopeLabel(code.split('-'), chapters, book))}</li>`
  ).join('')}</ul>`;
}
