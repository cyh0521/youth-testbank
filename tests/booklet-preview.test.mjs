import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-preview.js', import.meta.url), 'utf8');
const context = {window:{},document:{addEventListener(){}}};
runInNewContext(readFileSync(new URL('../js/core.js',import.meta.url),'utf8') + '\nwindow.testUI=UI;',context);
context.UI=context.window.testUI;
runInNewContext(
  source.slice(source.indexOf('const TYPE_ORDER'), source.indexOf('// ── 字型')) +
  source.slice(source.indexOf('function groupByType('), source.indexOf('// ═', source.indexOf('function groupByType('))) +
  source.slice(source.indexOf('function buildBookletHtml('), source.indexOf('// ═', source.indexOf('function renderQPreview('))),
  context
);
const question = (text, sectionNum, extra = {}) => ({ text, sectionNum, chapterNum:'01', type:'T2', qnum:12, difficulty:'△', ...extra });
const catalog = {
  labels:['單元', '章', '節'],
  chapters:[{ chapterNum:1, title:'全民國防概論', sections:[
    { sectionNum:1, title:'穩固國家的基石', subsections:[{ num:1, title:'國家安全的定義' }, { num:2, title:'第2節　國家安全的範圍' }] },
    { sectionNum:2, title:'第二章' },
    { sectionNum:10, title:'第十章' }
  ] }]
};

test('章節以數值排序，每節列完所有題型後才換節，各題型題號重新起算', () => {
  const html = context.buildBookletHtml({chapterCatalog:catalog}, [
    question('第二節題目', 1, {subsectionNum:2}),
    question('第十章題目', 10),
    question('第一節選擇', '01', {subsectionNum:'01'}),
    question('第二章題目', 2),
    question('第一節是非', 1, {subsectionNum:1, type:'T1'})
  ], {difficulty:true});
  const expected = ['第一節是非', '第一節選擇', '第二節題目', '第二章題目', '第十章題目'];
  expected.forEach((text, i) => {
    assert(html.includes(`1.</td><td>${text}`));
    if (i) assert(html.indexOf(expected[i - 1]) < html.indexOf(text));
  });
  assert(html.includes('單元1　全民國防概論'));
  assert(html.includes('第1章　穩固國家的基石'));
  assert(html.includes('第1節　國家安全的定義'));
  assert(!html.includes('第2節　第2節'));
  assert(html.includes('簡易題'));
  assert(html.includes('編碼：00012'));
});

test('缺少章節定義時仍顯示層級，標題內容會跳脫 HTML', () => {
  const html = context.buildBookletHtml({}, [question('題目', 2)], {});
  assert(html.includes('第1章'));
  assert(html.includes('第2節'));
  const escaped = context.buildBookletHtml({chapterCatalog:{labels:['章'], chapters:[{chapterNum:1, title:'<測試>'}]}}, [question('題目', '')], {});
  assert(escaped.includes('&lt;測試&gt;'));
});

test('未設定的下層不顯示第0節或第0小節，零值與空值歸入相同章節', () => {
  const html = context.buildBookletHtml({chapterCatalog:{labels:['章','節','小節'], chapters:[{chapterNum:1, title:'妙用資源樂消費'}]}}, [
    question('零值題目', 0, {subsectionNum:0}),
    question('補零題目', '00', {subsectionNum:'000'}),
    question('空值題目', '', {subsectionNum:null}),
    question('未填題目', undefined)
  ], {});
  assert(html.includes('第1章　妙用資源樂消費'));
  assert(!html.includes('第0節'));
  assert(!html.includes('第0小節'));
  assert.equal((html.match(/ep-booklet-chapter-line/g) || []).length, 1);
  assert.equal((html.match(/ep-booklet-chapter-end/g) || []).length, 1);
  assert(html.includes('選擇題（4 題）'));
});

test('各節各題型以編碼的數值順序排列，未編碼排最後', () => {
  const questions = [
    question('編碼十', 1, {qnum:10}),
    question('未編碼', 1, {qnum:''}),
    question('編碼二', 1, {qnum:'00002'}),
    question('編碼一', 1, {qnum:1})
  ];
  const html = context.buildBookletHtml({}, questions, {});
  ['編碼一', '編碼二', '編碼十', '未編碼'].forEach((text, index) => {
    assert(html.includes(`${index + 1}.</td><td>${text}`));
  });
  assert.equal(questions[0].text, '編碼十');
  assert(html.includes('margin:0 0 6px;break-after:avoid'));
  assert.equal((html.match(/ep-booklet-chapter-end/g) || []).length, 1);
  assert(html.includes('border-bottom:1px solid #000'));
});

test('資訊以標籤及分隔線呈現，並保留內容跳脫', () => {
  const html = context.buildBookletHtml({}, [question('題目', 1, {sourceCode:'A1', source:'<12>'})], {source:true});
  assert(html.includes('課本'));
  assert(html.includes('&lt;12&gt;'));
  assert(html.includes('編碼：00012︱出處：課本︱頁數：&lt;12&gt;'));
  const page = context.buildBookletHtml({}, [question('題目', 1, {qnum:252, sourceCode:'A1', source:'25'})], {source:true, difficulty:true});
  assert(page.includes('編碼：00252︱難易度：簡易題︱出處：課本︱頁數：P.25'));
});

test('資訊列與題目同字級；是非及單選解析在表格下方並以標籤寬度縮排', () => {
  assert.match(source, /#epBody \.ep-q-analysis\{[^}]*font-size:1em/);
  for (const type of ['T1','T2']) {
    const html = context.buildBookletHtml({}, [question('題目', 1, {type, analysis:'長篇解析內容'})], {analysis:true});
    assert(html.includes('margin-bottom:6px;font-size:1em'));
    assert(html.indexOf('</table>') < html.indexOf('class="ep-q-analysis"'));
    assert(html.includes('display:flex;margin:6px 0 0'));
    assert(html.includes('flex:none;white-space:nowrap'));
    assert(html.includes('min-width:0;overflow-wrap:anywhere'));
  }
  const multiple = context.renderQPreview(question('複選題', 1, {type:'T3', analysis:'複選解析'}),1,'T3',{analysis:true});
  assert(multiple.indexOf('class="ep-q-analysis"') < multiple.indexOf('</table>'));
});
