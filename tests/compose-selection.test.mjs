import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load browser modules without requiring a package.json module setting.
const load = async path => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url))).toString('base64')}`);
const { filterComposePool, pickComposeQuestions } = await load('../js/compose-selection.js');
const { selectFillQuestions, blankCount } = await load('../js/blank-selection.js');
const question = (id, extra = {}) => ({ id, subjectCode:'A', bookCode:'B', chapterNum:'01', sectionNum:'02', subsectionNum:'03', type:'T2', difficulty:'△', ...extra });
const questions = [question('a'), question('b', {subsectionNum:4}), question('c', {chapterNum:2}), question('other-book', {bookCode:'C'}), question('other-subject', {subjectCode:'C'}), question('other-type', {type:'T1'})];
const scope = {subjectCode:'A', bookCode:'B', type:'T2'};
assert.deepEqual(filterComposePool(questions, {...scope, chapters:['1-2-3']}).map(q=>q.id), ['a']);
assert.deepEqual(filterComposePool(questions, {...scope, chapters:['1-2']}).map(q=>q.id), ['a','b']);
assert.deepEqual(filterComposePool(questions, {...scope, chapters:['1','2']}).map(q=>q.id), ['a','b','c']);
assert.deepEqual(filterComposePool(questions, scope), []);

const pool = Array.from({length:20}, (_,i)=>question(String(i), {difficulty:i<10?'◎':'△'}));
const before = JSON.stringify(pool);
for (const ratio of [.3,.5,.7]) {
  const picked = pickComposeQuestions(pool, {weights:{'◎':ratio,'△':1-ratio}}, 10);
  assert.equal(picked.length,10);
  assert.equal(new Set(picked.map(q=>q.id)).size,10);
  assert.equal(picked.filter(q=>q.difficulty==='◎').length,Math.round(10*ratio));
}
const sparse = [question('hard', {difficulty:'◎'}), question('easy'), question('normal', {difficulty:''})];
assert.equal(pickComposeQuestions(sparse, {weights:{'◎':.7,'△':.3}}, 3).length,3);
assert.equal(pickComposeQuestions(sparse, {weights:null}, 10).length,3);
assert.equal(JSON.stringify(pool),before);
const fills = [question('fill1', {type:'T4', answerCount:1, text:'甲（　）'}), question('fill2', {type:'T4', answerCount:2, text:'乙（　）（　）'})];
const fillPool = filterComposePool(fills, {...scope, type:'T4', chapters:['1']});
const pickedFills = selectFillQuestions(fillPool,3,.5);
assert.ok(pickedFills);
assert.equal(pickedFills.reduce((sum,q)=>sum+blankCount(q),0),3);

const page = await readFile(new URL('../compose.html',import.meta.url),'utf8');
const scopeModule = await readFile(new URL('../js/exam-scope.js',import.meta.url),'utf8');
assert.ok(scopeModule.includes('await DataService.getQuestionCount(opts)'));
assert.ok(scopeModule.includes('await DataService.getQuestions({ subjectCode:sc, bookCode:bc })'));
assert.ok(!page.includes('DataService.randomWithDifficulty'));
assert.ok(!page.includes('subjectsWithQuestions'));
assert.ok(!page.includes('booksWithQuestions'));
assert.ok(scopeModule.includes('revision === bookLoadRevision'));
console.log('PASS: cached scope filtering, weighted selection, fallback, fill counts, and query boundaries');
