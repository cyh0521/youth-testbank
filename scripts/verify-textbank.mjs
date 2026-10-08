import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] || 'data/textbank');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (manifest.schema !== 1 || !Array.isArray(manifest.books) || !manifest.byId) {
  throw new Error('manifest.json 格式不正確');
}
const seen = new Set();
let count = 0;
const stats = { total: 0, byType: {}, bySubject: {}, byDifficulty: {} };
for (const book of manifest.books) {
  if (!/^books\/[a-f0-9]{16}-[a-f0-9]{16}\.json$/.test(book.path)) throw new Error(`檔案路徑不正確：${book.path}`);
  const raw = await readFile(resolve(root, book.path), 'utf8');
  const bookKey = JSON.stringify([book.subjectCode, book.bookCode]);
  const expectedName = `${createHash('sha256').update(bookKey).digest('hex').slice(0, 16)}-${createHash('sha256').update(raw).digest('hex').slice(0, 16)}.json`;
  if (book.path !== `books/${expectedName}`) throw new Error(`檔案內容雜湊不符：${book.path}`);
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions) || questions.length !== book.count) throw new Error(`題數不符：${book.path}`);
  for (const question of questions) {
    if (!question.id || seen.has(question.id)) throw new Error(`題目 ID 缺漏或重複：${question.id}`);
    if (question.subjectCode !== book.subjectCode || question.bookCode !== book.bookCode) throw new Error(`科目／冊別不符：${question.id}`);
    if (manifest.byId[question.id] !== book.path) throw new Error(`索引不符：${question.id}`);
    seen.add(question.id);
    count++;
    stats.total++;
    stats.byType[question.type || ''] = (stats.byType[question.type || ''] || 0) + 1;
    stats.bySubject[question.subjectCode] = (stats.bySubject[question.subjectCode] || 0) + 1;
    stats.byDifficulty[question.difficulty || ''] = (stats.byDifficulty[question.difficulty || ''] || 0) + 1;
  }
}
if (count !== manifest.count || seen.size !== Object.keys(manifest.byId).length || count !== manifest.stats?.total) {
  throw new Error('總題數與索引不符');
}
for (const key of ['total', 'byType', 'bySubject', 'byDifficulty']) {
  const normalize = value => value && typeof value === 'object'
    ? JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : JSON.stringify(value);
  if (normalize(stats[key]) !== normalize(manifest.stats[key])) {
    throw new Error(`統計資料不符：${key}`);
  }
}
const published = new Set(manifest.books.map(book => book.path.split('/')[1]));
const extra = (await readdir(resolve(root, 'books'))).filter(name => name.endsWith('.json') && !published.has(name));
console.log(`靜態題庫驗證通過：${count} 題、${manifest.books.length} 冊。`);
if (extra.length) console.warn(`另有 ${extra.length} 個舊版題目檔未被索引引用，可在確認新版發布後清理。`);
