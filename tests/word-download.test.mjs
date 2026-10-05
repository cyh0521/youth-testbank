import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-preview.js', import.meta.url), 'utf8');

test('Word 題目與解析分成不同段落', async () => {
  const exporter = readFileSync(new URL('../js/docx-export.js', import.meta.url), 'utf8');
  const context = {};
  runInNewContext(exporter.slice(0, exporter.indexOf('export async function createDocxBlob(')), context);
  const text = value => ({nodeType:3, textContent:value});
  const analysis = {nodeType:1, tagName:'DIV', classList:{contains: name => name === 'ep-q-analysis'}, childNodes:[text('【解析】說明')]};
  const docx = {TextRun:class {constructor(options) {this.options = options;}}};
  const runs = await context.runsFromNodes([text('題目正文'), analysis], docx, {});
  const parts = context.splitQuestionParagraphs(runs);
  assert.equal(parts.length, 2);
  assert.equal(parts[0][0].options.text, '題目正文');
  assert.equal(parts[1][0].options.text, '【解析】說明');
  assert.equal(parts[1][0].options.color, '245FA5');
  for (const name of ['ep-answer-value', 'ep-answer-label']) {
    const answer = {nodeType:1, tagName:'SPAN', classList:{contains: value => value === name}, childNodes:[text('答案')]};
    const answerRuns = await context.runsFromNodes([answer], docx, {});
    assert.equal(answerRuns[0].options.color, 'B4232C');
  }
});

test('Word 匯出完成題號寬度計算並觸發下載', async () => {
  let downloaded = false;
  let measured = false;
  let replacement;
  const node = () => ({ style:{}, appendChild() {}, querySelector:() => null });
  const prefix = {textContent:'（Ｏ）1.'};
  const content = {firstChild:null};
  const table = {querySelector: selector => selector === '.ep-answer-prefix' ? prefix : content};
  const question = {querySelector: selector => selector === '.ep-answer-table' ? table : null, replaceWith: value => { replacement = value; }};
  const paper = {firstElementChild:{}, querySelectorAll:() => [question]};
  const context = {
    Math, console, setTimeout() {},
    examAppearance:() => ({font:'serif', fontSize:16, lineHeight:1.6}),
    loadWordMargins:() => ({}), PAPER_SIZES:{A4:{}}, fontStackById:() => 'serif', buildPaperHtml:() => '',
    loadDocxLibrary:async () => ({}), createDocxBlob:async () => ({}),
    URL:{createObjectURL:() => 'blob:test', revokeObjectURL() {}},
    UI:{toast: message => { throw new Error(message); }},
    document:{
      body:{appendChild() {}},
      createTextNode:text => ({textContent:text}),
      createElement:tag => tag === 'div' ? paper : tag === 'canvas' ? {
        getContext:() => ({measureText:text => { measured = text === prefix.textContent; return {width:60}; }})
      } : tag === 'a' ? {click:() => { downloaded = true; }, remove() {}} : node()
    }
  };
  runInNewContext(source.slice(source.indexOf('export async function exportToWord(')).replace('export async function', 'async function'), context);
  await context.exportToWord({booklet:true, title:'題本'}, [], 'A4');
  assert(measured);
  assert(downloaded);
  assert.equal(replacement.style.margin, '0 0 8px 64px');
});
