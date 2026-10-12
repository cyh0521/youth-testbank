import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-preview.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('export const HEADER_BLANK_DEFAULTS'), source.indexOf('// 舊版字型'));
const render = source.slice(source.indexOf('export function buildHeaderHtml('), source.indexOf('function buildPaperHtml('));
const context = {};
runInNewContext((helpers + render).replaceAll('export ', ''), context);

test('表頭固定兩列，自由文字保留空格並安全輸出，第二列固定學生欄位', () => {
  const html = context.buildHeaderHtml({ titleText:'自訂  考試 <標題>', classLength:2, nameLength:3, seatLength:1,
    layout:{ class:{ row:1 }, school:{ row:2 } }, school:'不應重複輸出' });
  assert.equal((html.match(/class="ep-header-row/g) || []).length, 2);
  assert.match(html, /自訂  考試 &lt;標題&gt;/);
  assert.match(html, /班級：　　/);
  assert.match(html, /姓名：　　　/);
  assert.match(html, /座號：　/);
  assert.doesNotMatch(html, /不應重複輸出/);
});

test('舊表頭文字合併至第一列，清空新文字後不再復原舊欄位', () => {
  const legacy = { school:'幼獅高中', yearSemesterText:'115學年度', subjectText:'國文', examType:'段考', range:'第1章' };
  assert.equal(context.headerTitleText(legacy), '幼獅高中　115學年度　國文　段考　範圍：第1章');
  const html = context.buildHeaderHtml({ ...legacy, titleText:'' });
  assert.doesNotMatch(html, /幼獅高中|115學年度|國文|段考|第1章/);
  assert.match(html, /班級：/);
});
