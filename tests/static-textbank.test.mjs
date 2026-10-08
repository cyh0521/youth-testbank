import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const load = async name => {
  const source = readFileSync(new URL(`../js/${name}`, import.meta.url), 'utf8')
    .replaceAll('import.meta.url', '"https://example.test/js/static-textbank.js"');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

const { buildTextbankFiles, createTextbankZip } = await load('textbank-export.js');
const { StaticTextbank } = await load('static-textbank.js');
const { resolveTextbankSource } = await load('textbank-source.js');

const samples = [
  { id:'q1', subjectCode:'A', bookCode:'01', qnum:'00001', type:'T1', chapterNum:1, text:'題目一', answer:'O' },
  { id:'q2', subjectCode:'A', bookCode:'01', qnum:'00002', type:'T2', chapterNum:2, text:'題目二', answer:'A' },
  { id:'q3', subjectCode:'A', bookCode:'02', qnum:'00003', type:'T1', chapterNum:1, text:'題目三', answer:'X' }
];

test('匯出保留題目 ID、按冊分檔並可按條件讀取', async () => {
  const { files, manifest } = await buildTextbankFiles(samples, '2026-10-08T00:00:00.000Z');
  assert.equal(manifest.count, 3);
  assert.equal(manifest.books.length, 2);
  assert.equal(Object.keys(manifest.byId).length, 3);
  const contents = new Map(files);
  const fetcher = async url => {
    const path = url.pathname.slice(1);
    return contents.has(path)
      ? { ok:true, json:async () => JSON.parse(contents.get(path)) }
      : { ok:false, status:404 };
  };
  const bank = new StaticTextbank(fetcher);
  assert.deepEqual((await bank.questions({ subjectCode:'A', bookCode:'01', type:'T1' })).map(q => q.id), ['q1']);
  assert.deepEqual((await bank.questions({ chapters:['2'] })).map(q => q.id), ['q2']);
  assert.deepEqual((await bank.byIds(['q3','missing','q1'])).found.map(q => q.id), ['q3','q1']);
  assert.deepEqual((await bank.byIds(['q3','missing','q1'])).missing, ['missing']);
  assert.equal(await bank.count({ subjectCode:'A', bookCode:'01' }), 2);
  assert.equal((await bank.stats()).total, 3);
  await assert.rejects(() => bank.questions({ sourceFile:'private.docx' }), /需使用 Firestore/);
  const zip = Buffer.from(await createTextbankZip(files).arrayBuffer());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(zip.length - 22 + 10), files.length);
});

test('匯出拒絕重複或缺少題目 ID', async () => {
  await assert.rejects(() => buildTextbankFiles([]), /沒有題目/);
  await assert.rejects(() => buildTextbankFiles([...samples, samples[0]]), /ID 重複/);
  await assert.rejects(() => buildTextbankFiles([{ subjectCode:'A', bookCode:'01' }]), /缺少 ID/);
});

test('公開題庫只包含出題所需欄位', async () => {
  const { files } = await buildTextbankFiles([{ ...samples[0], _srcFile:'private.docx', createdBy:'user-1' }]);
  const shard = JSON.parse(files.find(([path]) => path.includes('/books/'))[1])[0];
  assert.equal(shard.id, 'q1');
  assert.equal(shard._srcFile, undefined);
  assert.equal(shard.createdBy, undefined);
});

test('預設 fetch 以全域物件呼叫，避免瀏覽器 Illegal invocation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function () {
    assert.equal(this, globalThis);
    return Promise.resolve({ ok:true, json:async () => ({ schema:1, books:[], byId:{}, stats:{ total:0 } }) });
  };
  try {
    assert.equal(await new StaticTextbank().count({}), 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('全站設定只接受兩種題庫來源，缺少設定時維持預設', () => {
  assert.equal(resolveTextbankSource({ mode:'firestore' }), 'firestore');
  assert.equal(resolveTextbankSource({ mode:'static' }), 'static');
  assert.equal(resolveTextbankSource({ mode:'invalid' }), 'static');
  assert.equal(resolveTextbankSource(null, 'firestore'), 'firestore');
});

test('驗證匯出資料，並拒絕內容遭修改的題目檔', async () => {
  const root = mkdtempSync(join(tmpdir(), 'textbank-test-'));
  try {
    const { files, manifest } = await buildTextbankFiles(samples, undefined, catalogSample);
    for (const [path, content] of files) {
      const target = join(root, path.replace('data/testbank/', ''));
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, content);
    }
    const script = fileURLToPath(new URL('../scripts/verify-textbank.mjs', import.meta.url));
    const verify = () => spawnSync(process.execPath, [script, root], { encoding:'utf8' });
    assert.equal(verify().status, 0);
    const catalogPath = join(root, manifest.catalog);
    const originalCatalog = readFileSync(catalogPath, 'utf8');
    writeFileSync(catalogPath, originalCatalog.replace('科目', '新科目'));
    assert.match(verify().stderr, /目錄內容雜湊不符/);
    writeFileSync(catalogPath, originalCatalog);
    const shard = files.find(([path]) => path.includes('/books/'));
    const target = join(root, shard[0].replace('data/testbank/', ''));
    writeFileSync(target, shard[1].replace('題目一', '題目甲'));
    assert.match(verify().stderr, /雜湊不符/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const catalogSample = [{ id:'s1', code:'A', name:'科目', books:[
  { id:'b1', code:'01', name:'第一冊', l1:'章', chapters:[
    { id:'c1', chapterNum:1, title:'第一章', sections:[{ sectionNum:1, title:'第一節', subsections:[{num:1,title:'小節'}] }] }
  ] },
  { id:'b2', code:'02', name:'空冊', chapters:[] }
] }];

test('目錄與題庫共同匯出，保留空冊、原 ID 與章節層級，並共用載入快取', async () => {
  const { files, manifest } = await buildTextbankFiles(samples, '2026-10-08', catalogSample);
  const contents = new Map(files);
  const requests = [];
  const bank = new StaticTextbank(async url => {
    requests.push(url.pathname);
    return { ok:true, json:async () => JSON.parse(contents.get(url.pathname.slice(1))) };
  });
  const [subjects, books, chapters] = await Promise.all([bank.subjects(), bank.books('s1'), bank.chapters('s1','b1')]);
  assert.equal(subjects[0].id, 's1');
  assert.equal(subjects[0].books, undefined);
  assert.equal(books.length, 2);
  assert.equal(books[0].chapters, undefined);
  assert.deepEqual(chapters, catalogSample[0].books[0].chapters);
  assert.deepEqual(await bank.chapters('s1','b2'), []);
  assert.equal(requests.length, 2);
  const changed = structuredClone(catalogSample);
  changed[0].name = '新名稱';
  assert.notEqual((await buildTextbankFiles(samples, '2026-10-08', changed)).manifest.catalog, manifest.catalog);
});

test('舊版缺少目錄時明確要求重新發布，載入失敗後可以重試', async () => {
  let attempts = 0;
  const bank = new StaticTextbank(async () => {
    attempts++;
    return { ok:true, json:async () => ({ schema:1, books:[], byId:{} }) };
  });
  await assert.rejects(() => bank.subjects(), /重新匯出/);
  await assert.rejects(() => bank.subjects(), /重新匯出/);
  assert.equal(attempts, 1);
});

 test('ZIP 內實際路徑全部使用 data/testbank，包含題目、目錄與索引', async () => {
  const { files } = await buildTextbankFiles(samples, undefined, catalogSample);
  const zip = Buffer.from(await createTextbankZip(files).arrayBuffer());
  const paths = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    paths.push(zip.toString('utf8', offset + 30, offset + 30 + nameLength));
    offset += 30 + nameLength + extraLength + size;
  }
  assert.deepEqual(paths, files.map(([path]) => path));
  assert.ok(paths.every(path => path.startsWith('data/testbank/')));
  assert.ok(paths.some(path => /^data\/testbank\/catalog-/.test(path)));
  assert.ok(paths.includes('data/testbank/manifest.json'));
 });
