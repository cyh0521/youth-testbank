import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const blankSource = readFileSync(new URL('../js/blank-selection.js', import.meta.url), 'utf8');
const blankUrl = 'data:text/javascript;base64,' + Buffer.from(blankSource).toString('base64');
const source = readFileSync(new URL('../js/section-selection.js', import.meta.url), 'utf8').replace("'./blank-selection.js'", JSON.stringify(blankUrl));
const {selectedSections,selectSectionQuestions,questionInSection,requiresSectionCoverage} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const sections = [1,2,3].map(n => ({code:`1-${n}`,label:`第1章 第${n}節`}));
const q = (id, sec, type = 'T1', extra = {}) => ({id,chapterNum:1,sectionNum:sec,type,difficulty:'△',...extra});

test('目錄原順序、最後兩層名稱、不重複節名且只包含已選範圍', () => {
  const catalog = {labels:['章','節','小節'],chapters:[{chapterNum:1,sections:[{sectionNum:2,title:'第2節 乙'},{sectionNum:1,title:'第1節 甲'}]},{chapterNum:2,sections:[{sectionNum:1}]}]};
  assert.deepEqual(selectedSections(catalog,['1'],[]).map(s => s.label),['第1章 第2節 乙','第1章 第1節 甲']);
  assert.equal(selectedSections(catalog,['1-2'],[]).length,1);
});
test('3:2:1 分配且每節至少一題，題型數與唯一性固定', () => {
  const pool = sections.flatMap((_,i) => Array.from({length:20},(_,j) => q(`${i}-${j}`,i+1)));
  const picked = selectSectionQuestions({pool,sections,counts:{T1:12},weights:{'1-1':3,'1-2':2,'1-3':1},random:()=>.4});
  assert.deepEqual(sections.map(s => picked.filter(q => questionInSection(q,s.code)).length),[6,4,2]);
  assert.equal(new Set(picked.map(q => q.id)).size,12);
});
test('稀有題型的章節優先覆蓋，避免一般題搶走其名額', () => {
  const pool=[q('a',1,'T1'),q('b',1,'T2'),q('c',2,'T1')];
  const picked=selectSectionQuestions({pool,sections:sections.slice(0,2),counts:{T1:1,T2:1},random:()=>0});
  assert.deepEqual(picked.map(q => q.id).sort(),['b','c']);
});
test('整题填空格數與各節覆蓋同時成立，失敗時不能省略章節', () => {
  const pool=[q('a',1,'T4',{answerCount:2}),q('b',2,'T4',{answerCount:3}),q('c',2,'T4',{answerCount:1})];
  const picked=selectSectionQuestions({pool,sections:sections.slice(0,2),counts:{T4:5}});
  assert.equal(picked.reduce((sum,q)=>sum+q.answerCount,0),5);
  assert.equal(picked.length,2);
  assert.throws(()=>selectSectionQuestions({pool,sections:sections.slice(0,2),counts:{T4:4}}),/無法讓每節至少/);
});
test('題數少於節數可略過涵蓋限制；不少於節數時仍要求每節有指定題型', () => {
  const pool=[q('a',1),q('b',2)];
  assert.equal(selectSectionQuestions({pool,sections:sections.slice(0,2),counts:{T1:1}}).length,1);
  assert.throws(()=>selectSectionQuestions({pool,sections,counts:{T1:3}}),/第3節.*沒有/);
});

test('配合題共5題但某節沒有配合題，出2題少於3節時成功且難易比重仍生效', () => {
  const pool=[q('a',1,'T5',{difficulty:'◎'}),q('b',1,'T5',{difficulty:'◎'}),q('c',1,'T5'),q('d',2,'T5'),q('e',2,'T5')];
  const picked=selectSectionQuestions({pool,sections,counts:{T5:2},hardRatio:1,weights:{'1-1':3,'1-2':1,'1-3':2},random:()=>.4});
  assert.equal(picked.length,2);
  assert.equal(new Set(picked.map(q=>q.id)).size,2);
  assert(picked.every(q=>q.type==='T5' && q.difficulty==='◎' && q.sectionNum===1));
  assert.throws(()=>selectSectionQuestions({pool,sections,counts:{T5:3}}),/第3節.*沒有/);
  assert.throws(()=>selectSectionQuestions({pool:pool.slice(0,1),sections,counts:{T5:2}}),/沒有|不足/);
});

test('題數恰好等於節數仍每節至少一題；換題使用相同的題數邊界', () => {
  const pool=sections.flatMap((_,i)=>[q(`${i}-a`,i+1),q(`${i}-b`,i+1)]);
  const picked=selectSectionQuestions({pool,sections,counts:{T1:3},random:()=>.4});
  assert(sections.every(s=>picked.some(q=>questionInSection(q,s.code))));
  assert.equal(requiresSectionCoverage(2,sections),false);
  assert.equal(requiresSectionCoverage(3,sections),true);
  assert.equal(requiresSectionCoverage(4,sections),true);
});

test('少題數時重選保留其他題型，缺題章節不阻擋且不得選出範圍或重複題', () => {
  const locked=q('fixed',1,'T1');
  const pool=[locked,q('a',1,'T5'),q('b',2,'T5'),q('outside',4,'T5')];
  const picked=selectSectionQuestions({pool,sections,counts:{T1:1,T5:1},locked:[locked],random:()=>.4});
  assert(picked.includes(locked));
  assert.equal(picked.length,2);
  assert.equal(picked.filter(q=>q.type==='T5').length,1);
  assert(!picked.some(q=>q.id==='outside'));
  assert.equal(new Set(picked.map(q=>q.id)).size,2);
});

test('填空以完整題數判斷例外，不以格數；可涵蓋每節時優先涵蓋', () => {
  const pool=[q('four',1,'T4',{answerCount:4}),q('two-a',1,'T4',{answerCount:2}),q('two-b',1,'T4',{answerCount:2})];
  const picked=selectSectionQuestions({pool,sections:sections.slice(0,2),counts:{T4:4},random:()=>.4});
  assert.deepEqual(picked.map(q=>q.id),['four']);
  assert.equal(picked.reduce((sum,q)=>sum+q.answerCount,0),4);
  const covered=selectSectionQuestions({pool:[...pool,q('other',2,'T4',{answerCount:2})],sections:sections.slice(0,2),counts:{T4:4}});
  assert.equal(covered.length,2);
  assert(sections.slice(0,2).every(s=>covered.some(q=>questionInSection(q,s.code))));
  const single=selectSectionQuestions({pool:[q('two',1,'T4',{answerCount:2}),q('three',1,'T4',{answerCount:3})],sections,counts:{T4:5}});
  assert.equal(single.length,2);
  assert.equal(single.reduce((sum,q)=>sum+q.answerCount,0),5);
});
test('重選可鎖定其他題型，保留每節覆蓋且不重複', () => {
  const a=q('a',1), b=q('b',2,'T2'), c=q('c',1,'T2');
  const picked=selectSectionQuestions({pool:[a,b,c],sections:sections.slice(0,2),counts:{T1:1,T2:1},locked:[a]});
  assert(picked.includes(a)); assert(picked.includes(b)); assert.equal(picked.length,2);
});
test('有足夠難易題時，0% 至 100% 每 10% 的比例都正確選題', () => {
  const pool=sections.flatMap((_,i)=>Array.from({length:20},(_,j)=>q(`${i}-${j}`,i+1,'T1',{difficulty:j%2?'◎':'△'})));
  for (let hard = 0; hard <= 10; hard++) {
    const picked=selectSectionQuestions({pool,sections,counts:{T1:10},hardRatio:hard / 10,random:()=>.4});
    assert.equal(picked.filter(q=>q.difficulty==='◎').length,hard,`較難題 ${hard * 10}%`);
    assert.equal(picked.length,10);
    assert(sections.every(section=>picked.some(q=>questionInSection(q,section.code))));
  }
});
test('同時套用 3:2:1 章節比重與難易度比例，保留題型數、覆蓋及唯一性', () => {
  const pool=sections.flatMap((_,i)=>Array.from({length:40},(_,j)=>q(`${i}-${j}`,i+1,'T1',{difficulty:j%2?'◎':'△'})));
  for (const hardRatio of [0,.1,.3,.7,.9,1]) for (const random of [()=>0,()=>.4,()=>.8]) {
    const picked=selectSectionQuestions({pool,sections,counts:{T1:30},weights:{'1-1':3,'1-2':2,'1-3':1},hardRatio,random});
    assert.deepEqual(sections.map(section=>picked.filter(q=>questionInSection(q,section.code)).length),[15,10,5]);
    assert.equal(picked.filter(q=>q.difficulty==='◎').length,30 * hardRatio);
    assert.equal(new Set(picked.map(q=>q.id)).size,30);
    assert(picked.every(q=>q.type==='T1'));
  }
});
test('題型重選保留其他題型，仍綜合章節比重與難易比例', () => {
  const pool=sections.flatMap((_,i)=>['T1','T2'].flatMap(type=>Array.from({length:40},(_,j)=>q(`${type}-${i}-${j}`,i+1,type,{difficulty:j%2?'◎':'△'}))));
  const settings={pool,sections,counts:{T1:12,T2:18},weights:{'1-1':3,'1-2':2,'1-3':1},hardRatio:.5};
  const initial=selectSectionQuestions({...settings,random:()=>.4});
  const locked=initial.filter(q=>q.type==='T1');
  const picked=selectSectionQuestions({...settings,locked,random:()=>.8});
  assert.deepEqual(picked.filter(q=>q.type==='T1').map(q=>q.id),locked.map(q=>q.id));
  assert.equal(picked.filter(q=>q.type==='T2').length,18);
  assert.deepEqual(sections.map(section=>picked.filter(q=>questionInSection(q,section.code)).length),[15,10,5]);
  assert.equal(picked.filter(q=>q.type==='T2'&&q.difficulty==='◎').length,9);
  assert.equal(new Set(picked.map(q=>q.id)).size,30);
});
test('混合題型及填空格數與窮舉可行結果一致', () => {
  const pool=[q('a',1),q('b',2),q('c',3),q('d',1,'T4',{answerCount:2}),q('e',2,'T4',{answerCount:3}),q('f',3,'T4',{answerCount:1}),q('g',1,'T4',{answerCount:1})];
  for (let regular=0; regular<=3; regular++) for (let blanks=0; blanks<=7; blanks++) {
    let possible=false;
    for (let mask=0; mask<(1<<pool.length); mask++) {
      const chosen=pool.filter((_,i)=>mask&(1<<i));
      if (chosen.filter(q=>q.type==='T1').length!==regular || chosen.filter(q=>q.type==='T4').reduce((n,q)=>n+q.answerCount,0)!==blanks) continue;
      if (chosen.length < sections.length || sections.every(section=>chosen.some(q=>questionInSection(q,section.code)))) { possible=true; break; }
    }
    let picked=null;
    try { picked=selectSectionQuestions({pool,sections,counts:{T1:regular,T4:blanks},random:()=>.3}); } catch {}
    assert.equal(!!picked,possible,`T1=${regular}, T4=${blanks}`);
    if (picked) {
      if (picked.length >= sections.length) assert(sections.every(section=>picked.some(q=>questionInSection(q,section.code))));
      assert.equal(picked.filter(q=>q.type==='T1').length,regular);
      assert.equal(picked.filter(q=>q.type==='T4').reduce((sum,q)=>sum+q.answerCount,0),blanks);
    }
  }
});
