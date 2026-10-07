import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const page = readFileSync(new URL('../compose.html', import.meta.url), 'utf8');
const blankUrl = 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../js/blank-selection.js', import.meta.url), 'utf8')).toString('base64');
const selectionSource = readFileSync(new URL('../js/section-selection.js', import.meta.url), 'utf8').replace("'./blank-selection.js'", JSON.stringify(blankUrl));
const {selectedSections, selectSectionQuestions, questionInSection, requiresSectionCoverage} = await import('data:text/javascript;base64,' + Buffer.from(selectionSource).toString('base64'));

test('每次按自動選題都重新選取；返回上一步後讀取最新章節比重與難易比例', async () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value:'', hidden:false, disabled:false, checked:true, style:{}, attributes:{}, textContent:'', innerHTML:'',
      classList:{add() {}, remove() {}, toggle() {}},
      setAttribute(name,value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      focus() {}, scrollIntoView() {},
    });
    return nodes.get(id);
  };
  node('cSubject').value = 'A';
  node('cBook').value = 'B';
  node('cnt-T1').value = '30';
  node('score-T1').value = String(100 / 30);
  node('cDifficulty').value = '30';
  const catalog = {labels:['章','節'],chapters:[{chapterNum:1,sections:[1,2,3].map(sectionNum=>({sectionNum,title:`章節${sectionNum}`}))}]};
  const pool = [1,2,3].flatMap(sectionNum=>Array.from({length:60},(_,index)=>({id:`${sectionNum}-${index}`,chapterNum:1,sectionNum,type:'T1',difficulty:index%2?'◎':'△'})));
  const selections = [];
  const previews = [];
  let randomSeed = 1234;
  const random = () => { randomSeed = (Math.imul(randomSeed,1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const context = {
    window:{}, document:{getElementById:node,querySelector:()=>({checked:true})},
    cSubject:node('cSubject'), TYPE_CONFIGS:[{code:'T1',label:'是非題',icon:'check'}],
    generatedQuestions:[], generatedScopeChapters:[], defaultScoreSignature:JSON.stringify([[['T1',30]],true]),
    sectionWeights:{'1-1':3,'1-2':2,'1-3':1},
    scopeSelector:{getQuestions:()=>pool,getSelectedChapters:()=>['1'],getChapterCatalog:()=>catalog},
    selectedSections,
    selectSectionQuestions:options=>{
      selections.push({weights:{...options.weights},hardRatio:options.hardRatio,locked:options.locked});
      return selectSectionQuestions({...options,random});
    },
    UI:{escapeHtml:value=>String(value),toast:message=>assert.fail(message)},
    validateTypeCounts:()=>true, confirmAction:async()=>assert.fail('配分為100分，不應出現確認視窗'),
    autoAllocateScores() {}, updateScoreRows() {}, shuffleQuestions:questions=>[...questions],
    renderPreview:groups=>previews.push(groups.flatMap(group=>group.items)),
  };
  const code = [
    page.slice(page.indexOf('function setComposeStep('),page.indexOf('// ── 初始化')),
    page.slice(page.indexOf('function difficultyHardRatio('),page.indexOf('function updateDifficultyRatio(')),
    page.slice(page.indexOf('function currentSections('),page.indexOf('const sectionWeightModal =')),
    page.slice(page.indexOf('function chooseWeightedQuestions('),page.indexOf('function renderExamSettings(')),
    page.slice(page.indexOf('window.doGenerate ='),page.indexOf('const collapsedResultTypes =')),
  ].join('\n');
  runInNewContext(code,context);
  assert(page.includes('onclick="doGenerate()" id="generateBtn"'));
  const distribution = () => [1,2,3].map(section=>context.generatedQuestions.filter(question=>questionInSection(question,`1-${section}`)).length);
  const hardCount = () => context.generatedQuestions.filter(question=>question.difficulty==='◎').length;

  // Initial click reads both current controls and enters the result page.
  await context.window.doGenerate();
  assert.deepEqual(distribution(),[15,10,5]);
  assert.equal(hardCount(),9);
  assert.equal(node('composePanel3').hidden,false);
  assert.equal(selections.length,1);
  const firstResult = context.generatedQuestions;

  // The actual Back handler preserves controls; another click reselects all questions.
  context.window.goComposeStep(2);
  assert.equal(node('composePanel2').hidden,false);
  assert.equal(node('cDifficulty').value,'30');
  assert.deepEqual(context.sectionWeights,{'1-1':3,'1-2':2,'1-3':1});
  Object.assign(context.sectionWeights,{'1-1':1,'1-2':2,'1-3':3});
  node('cDifficulty').value = '70';
  await context.window.doGenerate();
  assert.deepEqual(distribution(),[5,10,15]);
  assert.equal(hardCount(),21);
  assert.notEqual(context.generatedQuestions,firstResult);
  assert.equal(selections.length,2);
  assert.deepEqual(selections[1].weights,{'1-1':1,'1-2':2,'1-3':3});
  assert.equal(selections[1].hardRatio,.7);
  assert.equal(selections[1].locked.length,0);

  // Repeating with unchanged controls still invokes selection, rather than reusing results.
  const secondResult = context.generatedQuestions;
  context.window.goComposeStep(2);
  await context.window.doGenerate();
  assert.equal(selections.length,3);
  assert.equal(selections[2].hardRatio,.7);
  assert.deepEqual(selections[2].weights,{'1-1':1,'1-2':2,'1-3':3});
  assert.equal(selections[2].locked.length,0);
  assert.deepEqual(distribution(),[5,10,15]);
  assert.equal(hardCount(),21);
  assert.notEqual(context.generatedQuestions,secondResult);
  assert.notDeepEqual(Array.from(context.generatedQuestions,q=>q.id).sort(),Array.from(secondResult,q=>q.id).sort());
  assert.equal(previews.length,3);
  assert.equal(node('composePanel3').hidden,false);
  assert.equal(node('generateBtn').disabled,false);
  assert.equal(node('generateBtnLabel').textContent,'下一步：自動選題');
});

test('實際自動選題按鈕：3節有5道配合題，出2題可成功；改出3題仍受涵蓋限制', async () => {
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:'',classList:{add(){},remove(){}},scrollIntoView(){}});
    return nodes.get(id);
  };
  node('cSubject').value='A1'; node('cBook').value='01';
  node('cnt-T5').value='2'; node('score-T5').value='50';
  const sections=[1,2,3].map(n=>({code:`1-${n}`,label:`第1章 第${n}節`}));
  const pool=Array.from({length:5},(_,i)=>({id:String(i),chapterNum:1,sectionNum:i<3?1:2,type:'T5',difficulty:'◎'}));
  const messages=[],steps=[];
  const context={window:{},document:{getElementById:node},cSubject:node('cSubject'),TYPE_CONFIGS:[{code:'T5',label:'配合題'}],
    generatedQuestions:[],generatedScopeChapters:[],sectionWeights:{'1-1':3,'1-2':2,'1-3':1},currentSections:()=>sections,difficultyHardRatio:()=>1,
    scopeSelector:{getQuestions:()=>pool,getSelectedChapters:()=>['1']},selectSectionQuestions,
    validateTypeCounts:()=>true,confirmAction:async()=>assert.fail('配分100分不應詢問確認'),
    UI:{toast:message=>messages.push(message)},shuffleQuestions:q=>q,updateScoreRows(){},renderPreview(){},setComposeStep:step=>steps.push(step)};
  runInNewContext(page.slice(page.indexOf('function chooseWeightedQuestions('),page.indexOf('function renderExamSettings('))+
    page.slice(page.indexOf('window.doGenerate ='),page.indexOf('const collapsedResultTypes =')),context);
  await context.window.doGenerate();
  assert.equal(context.generatedQuestions.length,2); assert.deepEqual(steps,[3]); assert.equal(messages.length,0);
  node('cnt-T5').value='3';node('score-T5').value=String(100/3);
  await context.window.doGenerate();
  assert.match(messages.at(-1),/第3節.*沒有/);assert.deepEqual(steps,[3]);
  node('cnt-T5').value='2';node('score-T5').value='50';
  await context.window.doGenerate();
  assert.deepEqual(steps,[3,3]); assert.equal(context.generatedQuestions.length,2);assert.equal(node('generateBtn').disabled,false);
});

test('實際個別換題：總題數少於節數可跨節，不少於節數則保留各節至少一題', async () => {
  for(const total of [2,3]){
    const original={id:'old',type:'T5',chapterNum:1,sectionNum:1};
    const replacement={id:'new',type:'T5',chapterNum:1,sectionNum:2};
    const sections=[1,2,3].map(n=>({code:`1-${n}`}));
    const questions=[original,...Array.from({length:total-1},(_,i)=>({id:`fixed-${i}`,type:'T1',chapterNum:1,sectionNum:i+2}))];
    const messages=[];
    const context={window:{_allBookQs:[replacement]},document:{querySelectorAll:()=>[{dataset:{ch:'1'}}],getElementById:()=>({value:'01'})},
      cSubject:{value:'A1'},generatedQuestions:questions,TYPE_CONFIGS:[{code:'T1'},{code:'T5'}],filterComposePool:()=>[replacement],
      currentSections:()=>sections,questionInSection,requiresSectionCoverage,UI:{toast:message=>messages.push(message)},renderPreview(){}};
    runInNewContext(page.slice(page.indexOf('async function replaceResultQuestion('),page.indexOf('async function regenerateType(')),context);
    const button={disabled:false}; await context.replaceResultQuestion('old',button);
    assert.equal(questions[0].id,total===2?'new':'old');
    assert.match(messages.at(-1),total===2?/已更換題目/:/此節必須保留至少一題/);
    assert.equal(button.disabled,false);
  }
});
