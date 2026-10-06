import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-preview.js', import.meta.url), 'utf8');
const variantSource = readFileSync(new URL('../js/download-variants.js', import.meta.url), 'utf8');
const {downloadFilename} = await import('data:text/javascript;base64,' + Buffer.from(variantSource).toString('base64'));

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
  const exam = {booklet:true, title:'題本'};
  const display = {answers:false,analysis:true,source:false,difficulty:true};
  let downloaded = false;
  let measured = false;
  let replacement;
  const node = () => ({ style:{}, dataset:{}, children:[], appendChild(child) {this.children.push(child);}, querySelector:() => null });
  const prefix = {textContent:'（Ｏ）1.'};
  const content = {firstChild:null};
  const table = {querySelector: selector => selector === '.ep-answer-prefix' ? prefix : content};
  const externalAnalysis = {classList:{contains:name => name === 'ep-q-analysis'}, querySelector:()=>({textContent:'【解析】'})};
  const question = {children:[externalAnalysis], querySelector: selector => selector === '.ep-answer-table' ? table : null, replaceWith: value => { replacement = value; }};
  const paper = {firstElementChild:{}, querySelectorAll:() => [question]};
  const context = {
    Math, console, downloadFilename, window:{_epExamData:exam}, previewDisplay:()=>display, setTimeout() {},
    examAppearance:() => ({font:'serif', fontSize:16, lineHeight:1.6}),
    loadWordMargins:() => ({}), PAPER_SIZES:{A4:{}}, fontStackById:() => 'serif', buildPaperHtml:(data,questions,options) => {assert.equal(options,display); return '';},
    loadDocxLibrary:async () => ({}), createDocxBlob:async () => ({}),
    URL:{createObjectURL:() => 'blob:test', revokeObjectURL() {}},
    UI:{toast: message => { throw new Error(message); }},
    document:{
      body:{appendChild() {}},
      createTextNode:text => ({textContent:text}),
      createElement:tag => tag === 'div' ? paper : tag === 'canvas' ? {
        getContext:() => ({measureText:text => { if (text === prefix.textContent) measured = true; return {width:text === '【解析】' ? 64 : 60}; }})
      } : tag === 'a' ? {click:() => { downloaded = true; }, remove() {}} : node()
    }
  };
  runInNewContext(source.slice(source.indexOf('export async function exportToWord(')).replace('export async function', 'async function'), context);
  await context.exportToWord(exam, [], 'A4');
  assert(measured);
  assert(downloaded);
  assert.equal(replacement.style.margin, '0 0 8px 64px');
  assert(replacement.children.includes(externalAnalysis));
  assert.equal(replacement.dataset.analysisIndent,'64');
});

test('Word 資訊列同字級，解析首行對齊括號、續行對齊標籤後文字並留 6px 間距', async () => {
  const exporter = readFileSync(new URL('../js/docx-export.js', import.meta.url), 'utf8');
  const context = {};
  runInNewContext(exporter.replace('export async function','async function'), context);
  const text = value => ({nodeType:3,textContent:value});
  const element = (name, children) => ({nodeType:1,tagName:'SPAN',classList:{contains:value=>value===name},childNodes:children});
  const metadata = {classList:{contains:name=>name==='ep-word-meta'},childNodes:[text('編碼：00042')]};
  const analysis = element('ep-q-analysis',[element('ep-analysis-label',[text('【解析】')]),element('ep-analysis-text',[text('長篇解析文字')])]);
  const question = {classList:{contains:name=>name==='ep-word-question'},style:{marginLeft:'70px',marginBottom:'18px'},dataset:{analysisIndent:'64'},childNodes:[text('（　）1.題目'),analysis]};
  const content = {querySelectorAll:()=>[],querySelector:selector=>selector==='.ep-question-columns'?{children:[metadata,question]}:null};
  const docx = {TextRun:class {constructor(options){this.options=options;}},Paragraph:class {constructor(options){this.options=options;}},Document:class {constructor(options){this.options=options;}},LineRuleType:{EXACT:'exact'},AlignmentType:{LEFT:'left'},TabStopType:{LEFT:'left'},Packer:{toBlob:async doc=>doc}};
  const result = await context.createDocxBlob({docx,content,title:'測試',appearance:{font:'system',fontSize:16,lineHeight:1.3},margins:{top:10,right:10,bottom:10,left:10},paperSize:{width:210,height:297},columns:1});
  const [meta,body,explanation] = result.options.sections[0].children.map(p=>p.options);
  assert.equal(meta.children[0].options.size,body.children[0].options.size);
  assert.equal(meta.children[0].options.size,24);
  assert.equal(body.indent.left,body.indent.hanging);
  assert.equal(explanation.indent.left,960);
  assert.equal(explanation.indent.hanging,960);
  assert.equal(explanation.children[0].options.text,'【解析】');
  assert.equal(explanation.spacing.before,meta.spacing.after);
  assert.equal(explanation.spacing.before,90);
  assert.equal(body.spacing.after,0);
  assert.equal(explanation.spacing.after,270);
  assert.equal(explanation.children[0].options.size,22);
  assert.equal(explanation.spacing.line,281);
  assert.equal(meta.keepNext,undefined);
  assert.equal(body.keepNext,undefined);
  assert.equal(explanation.keepNext,undefined);
});

test('Word 保留出處顏色及難易度標籤字級與底色', async () => {
  const exporter = readFileSync(new URL('../js/docx-export.js', import.meta.url), 'utf8');
  const context = {};
  runInNewContext(exporter.slice(0, exporter.indexOf('export async function createDocxBlob(')), context);
  const docx = {TextRun:class {constructor(options){this.options=options;}}};
  const element = names => ({nodeType:1,tagName:'SPAN',classList:{contains:name=>names.includes(name)},childNodes:[{nodeType:3,textContent:'測試'}]});
  const source = await context.runsFromNodes([element(['ep-q-source'])],docx,{size:24});
  assert.equal(source[0].options.color,'27734C');
  const difficulty = await context.runsFromNodes([element(['ep-q-difficulty','is-hard'])],docx,{size:24});
  assert.equal(difficulty[0].options.size,18);
  assert.equal(difficulty[0].options.color,'A34D17');
  assert.equal(difficulty[0].options.shading.fill,'FFF0E5');
});
