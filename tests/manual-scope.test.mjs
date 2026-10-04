import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const poolSource = readFileSync(new URL('../js/compose-selection.js', import.meta.url), 'utf8');
const { filterComposePool } = await import(`data:text/javascript;base64,${Buffer.from(poolSource).toString('base64')}`);
const source = readFileSync(new URL('../manual.html', import.meta.url), 'utf8');
const scope = source.slice(source.indexOf('function getManualScopeQuestions()'), source.indexOf('window.applyFilters ='));
const navigation = source.slice(source.indexOf('window.goManualStep ='), source.indexOf("document.getElementById('manualStep1').setAttribute"));
function setup(questions, ranges) {
  const elements = new Map();
  const notices = [];
  const context = {
    scopeSelector: { getQuestions: () => filterComposePool(questions.map(q => ({...q,subjectCode:'A',bookCode:'B'})), {subjectCode:'A',bookCode:'B',chapters:ranges.map(r=>r.sub ? `${r.ch}-${r.sec}-${r.sub}` : r.sec ? `${r.ch}-${r.sec}` : r.ch)}) },
    allQs: questions, selectedOrder: [], selectedIds: new Set(), selQuestions: {}, filtered: [],
    document: {
      querySelector: () => ranges.length ? {} : null,
      querySelectorAll: selector => selector === '.chap-cb:checked' ? ranges.map(dataset => ({dataset})) : [],
      getElementById: id => {
        if (!elements.has(id)) elements.set(id, {hidden: id !== 'manualPanel1', value: '', style: {}, classList: {toggle() {}}, setAttribute() {}, removeAttribute() {}});
        return elements.get(id);
      }
    },
    UI: {toast: text => notices.push(text)},
    applyFilters() { context.filtered = context.getManualScopeQuestions(); },
    renderSelected() {}, renderExamSettings() {}, renderManualExamPreview() {}, scrollTo() {}
  };
  context.window = context;
  runInNewContext(scope + navigation.slice(0, navigation.indexOf('const scopeSelector =')), context);
  return {context, elements, notices};
}
test('empty chapter cannot advance, including a book with questions in other chapters', () => {
  for (const questions of [[], [{id:'a',chapterNum:1}]]) {
    const {context, elements, notices} = setup(questions, [{ch:'2'}]);
    context.goManualStep(2);
    assert.match(notices[0], /尚無題目/);
    assert.equal(elements.size, 0, 'navigation must stop before changing panels');
  }
});
test('scope checks section and subsection boundaries', () => {
  const {context} = setup([{id:'a',chapterNum:1,sectionNum:2,subsectionNum:3}], [{ch:'1',sec:'2',sub:'4'}]);
  assert.equal(context.getManualScopeQuestions().length, 0);
});
test('populated chapter advances despite previous search filters', () => {
  const {context, elements, notices} = setup([{id:'a',chapterNum:1}], [{ch:'1'}]);
  context.document.getElementById('fKeyword').value='previous search';
  context.goManualStep(2);
  assert.equal(notices.length, 0);
  assert.equal(elements.get('manualPanel1').hidden, true);
  assert.equal(elements.get('manualPanel2').hidden, false);
});
