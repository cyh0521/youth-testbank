import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../js/exam-preview.js',import.meta.url),'utf8');
const context={window:{},document:{addEventListener(){}}};
runInNewContext(readFileSync(new URL('../js/core.js',import.meta.url),'utf8')+'\nwindow.testUI=UI;',context);
context.UI=context.window.testUI;
const slice=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
runInNewContext((slice('const TYPE_ORDER','// ── 字型')+
  slice('export const HEADER_BLANK_DEFAULTS','// 舊版字型')+
  slice('function groupByType(','// ═')+
  slice('export function buildHeaderHtml(','// ═')).replaceAll('export ',''),context);

test('版型範例依題型排序顯示實際第一題，配分說明採完整題型總分',()=>{
  const data={header:{titleText:'版型測試'},typeOrder:['T2','T1'],typeScores:{T2:3,T1:2}};
  const questions=[{type:'T1',text:'另一題型'},{type:'T2',text:'實際第一題',answer:'A'}, {type:'T2',text:'同題型第二題',answer:'B'}];
  const html=context.buildHeaderSampleHtml(data,questions);
  assert.match(html,/實際第一題/);
  assert.doesNotMatch(html,/另一題型|同題型第二題|id="epPaper"/);
  assert.match(html,/一、選擇題（每題 3 分，共 6 分）/);
  assert.equal((html.match(/class="ep-q"/g)||[]).length,1);
});

test('填空範例保留整個題型的題數、格數與每格配分',()=>{
  const html=context.buildHeaderSampleHtml({header:{titleText:'測試'},typeScores:{T4:2},scoreUnits:{T4:'blank'}},[
    {type:'T4',text:'填空第一題',answerCount:2},{type:'T4',text:'填空第二題',answerCount:3},
  ]);
  assert.match(html,/2 題，共 5 格；每格 2 分，共 10 分/);
  assert.doesNotMatch(html,/填空第二題/);
});

test('尚無題目時僅呈現表頭，不產生虛構題目',()=>{
  const html=context.buildHeaderSampleHtml({header:{titleText:'只有表頭'}},[]);
  assert.match(html,/只有表頭/);
  assert.doesNotMatch(html,/class="ep-q"|class="ep-section-head"/);
});
