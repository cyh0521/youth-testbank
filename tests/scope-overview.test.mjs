import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../js/exam-scope.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/,'').replace(/export /g,'');
const poolSource=readFileSync(new URL('../js/compose-selection.js',import.meta.url),'utf8');
const {filterComposePool}=await import('data:text/javascript;base64,'+Buffer.from(poolSource).toString('base64'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(search='?subject=A&book=1') {
  const elements=new Map();
  for(const id of ['cSubject','cBook','scopeOverview','scopeChart','scopeTotal','scopeSelectionTools','scopeAvailable','chapterTree']) elements.set(id,{value:'',innerHTML:'',textContent:'',options:[],setAttribute(){},addEventListener(){},querySelectorAll:()=>[]});
  const cache={subjects:[{id:'a',code:'A',name:'科目甲'},{id:'b',code:'B',name:'科目乙'}],subjectByCode:{A:{id:'a'},B:{id:'b'}},booksBySubject:{a:[{id:'empty',code:'0',name:'空冊'},{id:'one',code:'1',name:'冊一'},{id:'two',code:'2',name:'冊二'}],b:[{id:'other',code:'1',name:'同編碼冊'}]}};
  const questions=[{id:'a1',subjectCode:'A',bookCode:'1',chapterNum:1,type:'T1'},{id:'a2',subjectCode:'A',bookCode:'1',chapterNum:2,type:'T2'},{id:'a3',subjectCode:'A',bookCode:'2',chapterNum:1,type:'T6'},{id:'b1',subjectCode:'B',bookCode:'1',chapterNum:1,type:'T5'}];
  const queries=[],changes=[];
  const state={window:{location:{search:''}},location:{search},URLSearchParams,queueMicrotask,console,filterComposePool,QUESTION_TYPES:{T1:'是非題',T2:'選擇題',T6:'問答題'},selected:[],document:{getElementById:id=>elements.get(id)||null,querySelectorAll:selector=>selector==='.chap-cb:checked:not(:disabled)'?state.selected:[],addEventListener(){}}};
  runInNewContext(source+'\nwindow.mount=mountScopeSelector;window.render=renderScopePanel;',state);
  const dataService={getQuestions:async opts=>{queries.push(opts);return questions.filter(q=>q.subjectCode===opts.subjectCode);},getChapterDefs:async()=>[{chapterNum:1,title:'章一'},{chapterNum:2,title:'章二'}]};
  const selector=state.window.mount({cache,dataService,onChange:(qs,selected,reason)=>changes.push({qs,selected,reason})});
  return {state,elements,selector,queries,changes};
}
test('三種出題方式顯示科目冊別選單與題型分布，題本可保留樹狀選冊',()=>{
  const {state}=setup();
  const html=state.window.render({nextAction:'next()',nextLabel:'選題'});
  assert(html.includes('scopeOverview') && html.includes('scopeChart'));
  assert(!html.includes('subjectTree'));
  assert.equal((html.match(/id="cSubject"/g)||[]).length,1);
  assert(state.window.render({nextAction:'next()',nextLabel:'題本',subjectOverview:false}).includes('subjectTree'));
});
test('初始化略過空冊，切換冊別更新總數及章節；切换科目不混入同編碼冊別',async()=>{
  const {state,elements,selector,queries}=setup();
  await settle();
  assert.equal(elements.get('cBook').value,'1');
  assert.match(elements.get('cBook').innerHTML, /value="0" disabled/);
  assert.match(elements.get('scopeTotal').innerHTML,/^2 /);
  assert(elements.get('scopeChart').innerHTML.includes('選擇題'));
  state.selected=[{dataset:{ch:'1'}}];
  assert.equal(selector.getQuestions()[0].id,'a1');
  elements.get('cBook').value='2';
  await state.window.loadChapters();
  assert.match(elements.get('scopeTotal').innerHTML,/^1 /);
  assert.equal(selector.getQuestions()[0].id,'a3');
  elements.get('cSubject').value='B';
  await state.window.onSubjectChange();
  assert.equal(selector.getQuestions()[0].id,'b1');
  assert.equal(queries.length,2,'每個科目讀取一次，切換冊別沿用該科題目');
});

test('從頂欄進入不預設科目與冊別，也不先讀取題目',async()=>{
  const {elements,queries}=setup('');
  await settle();
  assert.equal(elements.get('cSubject').value,'');
  assert.equal(elements.get('cBook').disabled,true);
  assert.equal(queries.length,0);
  assert.match(elements.get('scopeTotal').innerHTML,/^0 /);
});
