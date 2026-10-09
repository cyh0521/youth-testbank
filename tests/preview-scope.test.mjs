import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../js/preview-scope.js',import.meta.url),'utf8');
const {previewScopeNodes,questionScopeCode,scopeContains,applyScopeHighlight}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const questions=[{chapterNum:'01',sectionNum:'02',subsectionNum:'01'},{chapterNum:1,sectionNum:2,subsectionNum:2},{chapterNum:1,sectionNum:3},{chapterNum:2,sectionNum:1}];
const catalog={labels:['章','節','小節'],chapters:[{chapterNum:1,title:'國家安全',sections:[{sectionNum:3,title:'第三節'},{sectionNum:2,title:'第2節 定義',subsections:[{num:1,title:'項目一'},{num:2,title:'項目二'}]}]},{chapterNum:2,sections:[{sectionNum:1,title:'未選'}]}]};
test('命題範圍與子層依目錄順序呈現，保留上層，題數按實際題目計算',()=>{
  const nodes=previewScopeNodes({scopeChapters:['1']},questions,catalog);
  assert.deepEqual(nodes.map(n=>n.code),['1','1-3','1-2','1-2-1','1-2-2']);
  assert.equal(nodes[0].count,3);assert.equal(nodes[2].count,2);
  assert.equal(nodes[2].label,'第2節 定義');
});
test('僅選一節時不列其他節；未抽中節仍顯示零題',()=>{
  const nodes=previewScopeNodes({scopeChapters:['01-02']},questions,catalog);
  assert.deepEqual(nodes.map(n=>n.code),['1','1-2','1-2-1','1-2-2']);
  assert.equal(previewScopeNodes({scopeChapters:['1-3']},questions.slice(0,2),catalog).find(n=>n.code==='1-3').count,0);
});
test('舊試卷與缺少目錄時由題目章節建立層級，零值不顯示',()=>{
  assert.deepEqual(previewScopeNodes({},questions).map(n=>n.code),['1','1-2','1-2-1','1-2-2','1-3','2','2-1']);
  assert.equal(questionScopeCode({chapterNum:'01',sectionNum:0,subsectionNum:0}),'1');
  assert.equal(questionScopeCode({chapterNum:0}),'');
});
test('章節標示包含下層且不混淆第1與第10章；清除不改变題目',()=>{
  const nodes=['1-2','1-2-1','1-3','10-2'].map(code=>({dataset:{epScope:code},classList:{toggle(name,value){this[name]=value;}}}));
  const paper={querySelectorAll:()=>nodes};
  assert.equal(applyScopeHighlight(paper,'1-2'),2);
  assert.equal(nodes[2].classList['ep-scope-highlight'],false);
  assert.equal(applyScopeHighlight(paper,'1'),3);
  assert.equal(applyScopeHighlight(paper,''),0);
  assert.equal(scopeContains('1','10-1'),false);
});
test('章節資料屬於預覽專用：列印及下載的題目沒有標示屬性',()=>{
  const file=readFileSync(new URL('../js/exam-preview.js',import.meta.url),'utf8');
  const render=file.slice(file.indexOf('function renderQPreview('),file.indexOf('export async function exportToWord('));
  const ctx={questionScopeCode,UI:{questionHtml:x=>x,choiceQuestionHtml:q=>q.text,matchingQuestionHtml:x=>x}};
  runInNewContext(render,ctx);
  for(const type of ['T1','T2','T3','T4','T5','T6']){
    const q={chapterNum:1,sectionNum:2,text:'測試',type};
    assert(ctx.renderQPreview(q,1,type,{scopeHighlightMetadata:true}).includes('data-ep-scope="1-2"'));
    assert(!ctx.renderQPreview(q,1,type,{answers:true}).includes('data-ep-scope'));
  }
});
