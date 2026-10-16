const encode = value => new TextEncoder().encode(value);
const PUBLIC_QUESTION_FIELDS = [
  'id', 'subjectCode', 'bookCode', 'qnum', 'type', 'difficulty',
  'chapterNum', 'sectionNum', 'subsectionNum', 'catalogCode',
  'text', 'options', 'tail', 'answer', 'analysis', 'answerCount',
  'source', 'sourceCode'
];

function publicQuestion(question) {
  return Object.fromEntries(PUBLIC_QUESTION_FIELDS
    .filter(field => Object.hasOwn(question, field))
    .map(field => [field, question[field]]));
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildTextbankFiles(questions, exportedAt = new Date().toISOString(), catalog = null) {
  if (!Array.isArray(questions)) throw new Error('題庫資料格式不正確');
  if (!questions.length) throw new Error('Firestore 題庫沒有題目，已停止匯出');
  const groups = new Map();
  const ids = new Set();
  const stats = { total: 0, byType: {}, bySubject: {}, byDifficulty: {} };
  for (const question of questions) {
    if (!question?.id || ids.has(question.id)) throw new Error('題目缺少 ID 或 ID 重複');
    ids.add(question.id);
    const subjectCode = String(question.subjectCode || '');
    const bookCode = String(question.bookCode || '');
    const key = JSON.stringify([subjectCode, bookCode]);
    if (!groups.has(key)) groups.set(key, { subjectCode, bookCode, questions: [] });
    groups.get(key).questions.push(publicQuestion(question));
    stats.total++;
    stats.byType[question.type || ''] = (stats.byType[question.type || ''] || 0) + 1;
    stats.bySubject[subjectCode] = (stats.bySubject[subjectCode] || 0) + 1;
    stats.byDifficulty[question.difficulty || ''] = (stats.byDifficulty[question.difficulty || ''] || 0) + 1;
  }
  const files = [];
  const manifest = { schema: 1, exportedAt, count: questions.length, books: [], byId: {}, stats };
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    group.questions.sort((a, b) => String(a.qnum || '').localeCompare(String(b.qnum || '')) || a.id.localeCompare(b.id));
    const content = JSON.stringify(group.questions);
    const path = `books/${(await digest(key)).slice(0, 16)}-${(await digest(content)).slice(0, 16)}.json`;
    manifest.books.push({ subjectCode: group.subjectCode, bookCode: group.bookCode, count: group.questions.length, path });
    group.questions.forEach(question => { manifest.byId[question.id] = path; });
    files.push([`data/testbank/${path}`, content]);
  }
  if (catalog !== null) {
    if (!Array.isArray(catalog)) throw new Error('目錄資料格式不正確');
    const content = JSON.stringify(catalog);
    manifest.catalog = `catalog-${(await digest(content)).slice(0, 16)}.json`;
    files.push([`data/testbank/${manifest.catalog}`, content]);
  }
  files.push(['data/testbank/manifest.json', JSON.stringify(manifest)]);
  return { files, manifest };
}

// 只更新目錄與索引，保留已發布題庫分檔的路徑及題目統計。
export async function buildTextbankMetadataFiles(manifest, catalog) {
  const available = new Set(catalog.flatMap(subject => subject.books.map(book => JSON.stringify([subject.code,book.code]))));
  if (manifest.books.some(book => !available.has(JSON.stringify([book.subjectCode,book.bookCode])))) {
    throw new Error('已發布題庫的科目或冊別代碼已變更，請先勾選相關冊別匯出靜態題庫，再下載目錄與索引');
  }
  const content = JSON.stringify(catalog);
  const path = `catalog-${(await digest(content)).slice(0,16)}.json`;
  const updated = {...manifest,catalog:path,exportedAt:new Date().toISOString()};
  return {files:[[`data/testbank/${path}`,content],['data/testbank/manifest.json',JSON.stringify(updated)]],manifest:updated};
}

// ZIP STORE; the export has no dependency on a third-party service.
export async function buildSubjectTextbankFiles(subjectCode, questions, catalog, existingQuestions, existingCatalog) {
  if (!subjectCode || questions.some(q => q.subjectCode !== subjectCode) || catalog.some(s => s.code !== subjectCode)) throw new Error('匯出科目與資料不一致');
  return buildTextbankFiles([
    ...existingQuestions.filter(q => q.subjectCode !== subjectCode), ...questions
  ], new Date().toISOString(), [
    ...existingCatalog.filter(s => s.code !== subjectCode), ...catalog
  ]);
}

export function resolveBookExportScopes(scopes, existingCatalog) {
  return scopes.map(scope => {
    const previousSubject = scope.subjectId ? existingCatalog.find(s => s.id === scope.subjectId) : null;
    const previousBook = scope.bookId ? previousSubject?.books.find(b => b.id === scope.bookId) : null;
    const sourceCodes = [{subjectCode:scope.subjectCode,bookCode:scope.bookCode}];
    if (previousBook && (previousSubject.code !== scope.subjectCode || previousBook.code !== scope.bookCode)) sourceCodes.push({subjectCode:previousSubject.code,bookCode:previousBook.code});
    return {...scope,sourceCodes};
  });
}

export function normalizeBookExportQuestions(scope, questions) {
  return questions.map(question => {
    const catalogCode = question.catalogCode;
    const prefix = `${question.subjectCode}-${question.bookCode}-`;
    return {...question,subjectCode:scope.subjectCode,bookCode:scope.bookCode,
      ...(typeof catalogCode === 'string' && catalogCode.startsWith(prefix) ? {catalogCode:`${scope.subjectCode}-${scope.bookCode}-${catalogCode.slice(prefix.length)}`} : {})};
  });
}

export async function buildBookTextbankFiles(scopes, questions, catalog, existingQuestions, existingCatalog) {
  const selected = new Set(scopes.map(s => JSON.stringify([s.subjectCode,s.bookCode])));
  const replaced = new Set(scopes.flatMap(s => s.sourceCodes || [s]).map(s => JSON.stringify([s.subjectCode,s.bookCode])));
  const key = q => JSON.stringify([q.subjectCode,q.bookCode]);
  if (!selected.size || questions.some(q => !selected.has(key(q)))) throw new Error('匯出冊別與資料不一致');
  const subjects = new Map(existingCatalog.map(s => [s.code,{...s,books:s.books.filter(b => !replaced.has(JSON.stringify([s.code,b.code])))}]).filter(([,s]) => s.books.length || !scopes.some(scope => scope.subjectId === s.id && scope.subjectCode !== s.code)));
  for (const subject of catalog) {
    if (subject.books.some(b => !selected.has(JSON.stringify([subject.code,b.code])))) throw new Error('匯出冊別與目錄不一致');
    const previous = subjects.get(subject.code);
    subjects.set(subject.code,{...subject,books:[...(previous?.books || []).filter(b => !subject.books.some(newBook => newBook.code === b.code)),...subject.books]});
  }
  const merged = [...subjects.values()].sort((a,b)=>(a.order||0)-(b.order||0));
  merged.forEach(s=>s.books.sort((a,b)=>(a.order||0)-(b.order||0)));
  const result = await buildTextbankFiles([...existingQuestions.filter(q=>!replaced.has(key(q))),...questions],new Date().toISOString(),merged);
  const selectedPaths = new Set(result.manifest.books
    .filter(book => selected.has(key(book)))
    .map(book => `data/testbank/${book.path}`));
  result.files = result.files.filter(([path]) => !path.startsWith('data/testbank/books/') || selectedPaths.has(path));
  return result;
}

export function createTextbankZip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const [path, content] of files) {
    const name = encode(path);
    const data = encode(content);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    local.push(header, data);
    const directory = new Uint8Array(46 + name.length);
    const item = new DataView(directory.buffer);
    item.setUint32(0, 0x02014b50, true);
    item.setUint16(4, 20, true);
    item.setUint16(6, 20, true);
    item.setUint32(16, crc, true);
    item.setUint32(20, data.length, true);
    item.setUint32(24, data.length, true);
    item.setUint16(28, name.length, true);
    item.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    offset += header.length + data.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, central.reduce((size, entry) => size + entry.length, 0), true);
  view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}
