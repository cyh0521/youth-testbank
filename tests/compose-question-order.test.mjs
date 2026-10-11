import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const page = readFileSync(new URL('../compose.html', import.meta.url), 'utf8');
const code = page.slice(page.indexOf('function moveComposeQuestion('), page.indexOf('const composeDragArea ='));
function setup() {
  const questions = [
    {id:'a',type:'T1',answer:'A'}, {id:'b',type:'T1',answer:'B'}, {id:'c',type:'T1',answer:'C'},
    {id:'d',type:'T2',answer:'D'}, {id:'e',type:'T2',answer:'E'},
  ];
  let rendered;
  const context = {generatedQuestions:questions, TYPE_CONFIGS:[{code:'T1'},{code:'T2'}],renderPreview:groups=>{rendered=groups;}};
  runInNewContext(code,context);
  return {context,questions,rendered:()=>rendered};
}
test('拖曳到題目前後更新保存順序，其他題型與題目內容不變', () => {
  const {context,questions,rendered}=setup();
  const originals=[...questions];
  assert.equal(context.moveComposeQuestion('a','c',true),true);
  assert.deepEqual(questions.map(q=>q.id),['b','c','a','d','e']);
  assert.deepEqual(Array.from(rendered()[0].items,q=>q.id),['b','c','a']);
  assert.equal(context.moveComposeQuestion('a','b',false),true);
  assert.deepEqual(questions.map(q=>q.id),['a','b','c','d','e']);
  assert.equal(context.moveComposeQuestion('e','d',false),true);
  assert.deepEqual(questions.map(q=>q.id),['a','b','c','e','d']);
  assert(questions.every(q=>originals.includes(q)));
});
test('跨題型、相同題目及不存在的題目不更動排序', () => {
  const {context,questions,rendered}=setup();
  for(const [from,to] of [['a','d'],['a','a'],['missing','a'],['a','missing']]) {
    assert.equal(context.moveComposeQuestion(from,to,true),false);
  }
  assert.deepEqual(questions.map(q=>q.id),['a','b','c','d','e']);
  assert.equal(rendered(),undefined);
});
