import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

function setup(mode) {
  const source=readFileSync(new URL(`../${mode}.html`,import.meta.url),'utf8');
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)) {
      const classes=new Set(['hidden']);
      nodes.set(id,{value:'',textContent:'',classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)}});
    }
    return nodes.get(id);
  };
  const question={id:'a',type:'T1',subjectCode:'A',bookCode:'B',chapterNum:1};
  const saved=[];
  let fail=false;
  node('cBook').value='B';node('score-T1').value='2';node('sc-T1').value='2';
  const context={window:{},document:{getElementById:node},generatedQuestions:[question],generatedScopeChapters:['1'],
    selectedOrder:['a'],selQuestions:{a:question},cSubject:{value:'A'},TYPE_CONFIGS:[{code:'T1',defaultScore:2}],
    settingsTypeOrder:['T1'],draftPreviewData:null,sectionWeights:{},currentSections:()=>[],
    scopeSelector:{getSelectedChapters:()=>['1'],getChapterCatalog:()=>({})},examScopeSnapshot:()=>({}),
    newExamHeader:()=>({}),loadAppearance:()=>({}),selectedScoreUnits:()=>1,
    UI:{toast(){}},DataService:{saveExam:async exam=>{if(fail)throw Error('測試儲存失敗');saved.push(exam);}},
  };
  const saveStart=source.indexOf('window.doSaveExam =');
  const saveEnd=mode==='compose'?source.indexOf('\nupdateScoreRows();',saveStart):source.indexOf(`window.clear${mode[0].toUpperCase()+mode.slice(1)}Scores =`,saveStart);
  runInNewContext(source.slice(source.indexOf('let saveModalValues ='),saveEnd),context);
  return {source,context,node,saved,failSaving:value=>{fail=value;}};
}

for(const mode of ['compose','manual','coded']) {
  test(`${mode} 關閉儲存視窗丟棄未儲存內容，重開時欄位及錯誤提示重設`,async()=>{
    const {source,context,node}=setup(mode);
    assert.equal((source.match(/onclick="closeSaveModal\(\)"/g)||[]).length,2,'關閉與取消都使用相同還原流程');
    await context.window.openSaveModal();
    node('examTitle').value='未儲存名稱';node('examDesc').value='未儲存說明';
    node('saveErr').textContent='舊錯誤';node('saveErr').classList.remove('hidden');
    context.window.closeSaveModal();
    assert(node('saveModal').classList.contains('hidden'));
    assert.equal(node('examTitle').value,'');assert.equal(node('examDesc').value,'');
    await context.window.openSaveModal();
    assert(!node('saveModal').classList.contains('hidden'));
    assert.equal(node('examTitle').value,'');assert.equal(node('examDesc').value,'');
    assert.equal(node('saveErr').textContent,'');assert(node('saveErr').classList.contains('hidden'));
  });

  test(`${mode} 成功儲存內容保留，失敗可重試，取消後回到上次開啟時的內容`,async()=>{
    const {context,node,saved,failSaving}=setup(mode);
    await context.window.openSaveModal();
    node('examTitle').value='已儲存名稱';node('examDesc').value='已儲存說明';
    await context.window.doSaveExam();
    assert.equal(saved[0].title,'已儲存名稱');assert.equal(saved[0].description,'已儲存說明');
    assert(node('saveModal').classList.contains('hidden'));
    await context.window.openSaveModal();
    node('examTitle').value='失敗的新名稱';node('examDesc').value='失敗的新說明';
    failSaving(true);await context.window.doSaveExam();
    assert.equal(saved.length,1);
    assert(!node('saveModal').classList.contains('hidden'));
    assert.equal(node('examTitle').value,'失敗的新名稱');assert.equal(node('examDesc').value,'失敗的新說明');
    assert(!node('saveErr').classList.contains('hidden'));
    failSaving(false);await context.window.doSaveExam();
    assert.equal(saved[1].title,'失敗的新名稱');
    await context.window.openSaveModal();
    node('examTitle').value='取消的名稱';node('examDesc').value='取消的說明';
    context.window.closeSaveModal();await context.window.openSaveModal();
    assert.equal(node('examTitle').value,'失敗的新名稱');assert.equal(node('examDesc').value,'失敗的新說明');
    assert.equal(saved.length,2);
  });
}
