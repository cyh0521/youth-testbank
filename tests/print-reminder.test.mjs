import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-preview.js', import.meta.url), 'utf8');

test('列印確認與取消：先更新設定，不開啟紙張／欄數選擇，確認才列印', async () => {
  const fn = source.slice(source.indexOf('export async function printWithPaperChoice('), source.indexOf('export function loadWordMargins(')).replace('export ', '');
  for (const accepted of [true, false]) {
    const calls = [];
    const exam = {title:'測試'};
    const questions = [];
    const context = {
      DataService:{refreshExamPreferences:async()=>calls.push('refresh')},
      confirmPrintSettings:async()=>{calls.push('reminder'); return accepted;},
      printExam:(...args)=>{assert.deepEqual(args,[exam,questions]); calls.push('print');},
      UI:{toast:()=>assert.fail('Unexpected error')},
    };
    runInNewContext(fn, context);
    await context.printWithPaperChoice(exam, questions);
    assert.deepEqual(calls, accepted ? ['refresh','reminder','print'] : ['refresh','reminder']);
  }
});

test('列印不固定紙張大小，使用最新帳號邊距且無雙欄；Word 仍使用指定紙張', () => {
  const fn = source.slice(source.indexOf('export function printExam('), source.indexOf('function renderPaper(')).replace('export ', '');
  let html;
  const frame = {style:{},setAttribute(){},contentDocument:{open(){},write:value=>{html=value;},close(){}},contentWindow:{addEventListener(){}}};
  const context = {
    ensurePreviewModal(){},buildPaperHtml:()=>'',examAppearance:()=>({font:'system',fontSize:16,lineHeight:1.3}),
    fontStackById:()=> 'system-ui',loadWordMargins:()=>({top:12,right:15,bottom:18,left:20}),setTimeout(){},
    document:{body:{appendChild(){}},createElement:tag=>tag==='iframe'?frame:{firstElementChild:{style:{},outerHTML:'<div id="epPaper"></div>'}}},
  };
  runInNewContext(fn, context);
  context.printExam({title:'測試'}, []);
  assert(html.includes('@page { margin: 12mm 15mm 18mm 20mm; }'));
  assert(!html.match(/@page\s*\{[^}]*\bsize\s*:/));
  assert(!html.includes('column-count: 2'));
  const word = source.slice(source.indexOf('export async function exportToWord('));
  assert(word.includes('PAPER_SIZES[paperKey]'));
});
