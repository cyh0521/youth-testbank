import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const load=name=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../js/'+name,import.meta.url),'utf8')).toString('base64'));
const {allocateTypeScores,AUTO_SCORE_WEIGHTS}=await load('score-allocation.js');
const {blankCount}=await load('blank-selection.js');
const total=(types,scores)=>types.reduce((sum,type)=>sum+type.cnt*scores[type.code],0);
const codes=['T1','T2','T3','T4','T5','T6'];
function validScores(scores,step){
  assert(Object.values(scores).every(score=>score>=step&&Number.isInteger(score/step)));
}

test('六種題型題數相同時貼近參考權重，總分 100；輸入題數不被修改',()=>{
  const types=codes.map(code=>({code,cnt:5}));
  const before=JSON.stringify(types);
  const scores=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,1);
  assert.deepEqual(scores,{T1:2,T2:2,T3:2,T4:2,T5:6,T6:6});
  assert.equal(total(types,scores),100);
  assert.equal(JSON.stringify(types),before);
});

test('優先湊成 100 分，可以偏離參考高低關係',()=>{
  const types=[{code:'T1',cnt:13},{code:'T5',cnt:7}];
  const integer=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,1);
  assert.deepEqual(integer,{T1:5,T5:5});assert.equal(total(types,integer),100);
  const fractional=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,.5);
  assert.equal(total(types,fractional),100);
  validScores(integer,1);validScores(fractional,.5);
});

test('同權重題型可以配不同分數，使問答／配合及是非／選擇均能湊足 100',()=>{
  for(const pair of [['T5','T6'],['T1','T2']]){
    const types=[{code:pair[0],cnt:8},{code:pair[1],cnt:7}];
    const scores=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,1);
    assert.equal(total(types,scores),100);
    assert.notEqual(scores[pair[0]],scores[pair[1]]);
  }
});

test('無法剛好達 100 時取最高可達總分；允許半分可更接近目標',()=>{
  const types=[{code:'T1',cnt:13},{code:'T5',cnt:13}];
  const integer=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,1);
  const fractional=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,.5);
  assert.equal(total(types,integer),91);
  assert.equal(total(types,fractional),97.5);
  validScores(integer,1);validScores(fractional,.5);
});

test('無題型、只有部分題型、題數接近及超過最低配分限制',()=>{
  assert.deepEqual(allocateTypeScores([]),{});
  const lower=allocateTypeScores([{code:'T2',cnt:10},{code:'T4',cnt:15}],AUTO_SCORE_WEIGHTS,100,1);
  assert.deepEqual(lower,{T2:4,T4:4});
  const higher=allocateTypeScores([{code:'T5',cnt:5},{code:'T6',cnt:5}],AUTO_SCORE_WEIGHTS,100,1);
  assert.deepEqual(higher,{T5:10,T6:10});
  const long=allocateTypeScores([{code:'T1',cnt:70},{code:'T5',cnt:20}],AUTO_SCORE_WEIGHTS,100,1);
  assert.deepEqual(long,{T1:1,T5:1});
  assert.deepEqual(allocateTypeScores([{code:'T1',cnt:101},{code:'T5',cnt:1}],AUTO_SCORE_WEIGHTS,100,1),{T1:1,T5:1});
});

test('不同題數下各題型可獨立配分，找到不超過目標的最高總分',()=>{
  for(const step of [1,.5])for(const lowCount of [1,4,13,29,61])for(const highCount of [1,3,7,17]){
    const types=[{code:'T1',cnt:lowCount},{code:'T6',cnt:highCount}];
    const scores=allocateTypeScores(types,AUTO_SCORE_WEIGHTS,100,step);validScores(scores,step);
    const minimum=(lowCount+highCount)*step;
    if(minimum>100){assert.equal(total(types,scores),minimum);continue;}
    // Independent check: test each total from 100 down for an integer solution of L*a + H*b.
    let expected;
    for(let target=100/step;target>=lowCount+highCount&&!expected;target--){
      for(let base=1;base*lowCount<target;base++){
        const heavy=(target-base*lowCount)/highCount;
        if(Number.isInteger(heavy)&&heavy>=1){expected=target*step;break;}
      }
    }
    assert.equal(total(types,scores),expected);
    assert(Number.isInteger(scores.T1/step)&&Number.isInteger(scores.T6/step));
  }
});

for(const mode of ['manual','coded'])test(`${mode} 填空按格、配合按題，自動配分及儲存符合新規則`,async()=>{
  const source=readFileSync(new URL(`../${mode}.html`,import.meta.url),'utf8');
  const nodes=new Map();const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',checked:true,textContent:'',classList:{add(){},remove(){}}});
    return nodes.get(id);
  };
  for(const code of ['T1','T4'])node('sc-'+code).value='2';
  for(const code of ['T5','T6'])node('sc-'+code).value='6';
  node('examTitle').value='參考權重配分測試';node('examDesc').value='';
  const selQuestions={a:{id:'a',type:'T1'},b:{id:'b',type:'T4',answerCount:3},c:{id:'c',type:'T4',answerCount:2},d:{id:'d',type:'T5',answerCount:4},e:{id:'e',type:'T6'}};
  let saved,preview;
  const context={window:{},document:{getElementById:node},blankCount,AUTO_SCORE_WEIGHTS,allocateTypeScores,
    selQuestions,selectedOrder:Object.keys(selQuestions),settingsTypeOrder:codes,draftPreviewData:null,
    TYPE_SCORES:{T1:2,T4:2,T5:6,T6:6},newExamHeader:()=>({}),loadAppearance:()=>({}),renderSelected(){},
    scopeSelector:{getSelectedChapters:()=>['1']},showExamPreview:exam=>{preview=exam;},
    DataService:{saveExam:async exam=>{saved=exam;}},UI:{toast:message=>assert.equal(message,'試卷已儲存！')},
  };
  const name=mode[0].toUpperCase()+mode.slice(1);
  runInNewContext([
    source.slice(source.indexOf('function selectedScoreUnits('),source.indexOf('const TYPE_SCORES =')),
    source.slice(source.indexOf('function calcTotal('),source.indexOf('window.calcTotal =')),
    source.slice(source.indexOf('window.previewSelected ='),source.indexOf('window.openSaveModal =')),
    source.slice(source.indexOf('window.doSaveExam ='),source.indexOf(`window.clear${name}Scores =`)),
    source.slice(source.indexOf(`window.auto${name}Scores =`),source.indexOf(`window.adjust${name}Score =`)),
  ].join('\n'),context);
  context.calcTotal();assert.equal(node('totalScoreVal').textContent,'總計：24 分');
  context.window.previewSelected();assert.equal(preview.scoreUnits.T4,'blank');assert.equal(preview.scoreUnits.T5,undefined);
  await context.window.doSaveExam();assert.equal(saved.totalScore,24);assert.equal(saved.questionCount,5);
  assert.equal(saved.scoreUnits.T4,'blank');assert.equal(saved.scoreUnits.T5,undefined);
  context.window[`auto${name}Scores`]();validScores(context.TYPE_SCORES,1);
  assert.equal(context.TYPE_SCORES.T1+context.TYPE_SCORES.T4*5+context.TYPE_SCORES.T5+context.TYPE_SCORES.T6,100);
});
