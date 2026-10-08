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

export async function buildTextbankFiles(questions, exportedAt = new Date().toISOString()) {
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
    files.push([`data/textbank/${path}`, content]);
  }
  files.push(['data/textbank/manifest.json', JSON.stringify(manifest)]);
  return { files, manifest };
}

// ZIP STORE; the export has no dependency on a third-party service.
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
