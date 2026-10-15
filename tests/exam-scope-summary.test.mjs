import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../js/exam-scope-summary.js', import.meta.url), 'utf8');
const { examScopeSummaryHtml } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('已儲存的命題範圍直接顯示為巢狀樹，不重新查詢目錄', async () => {
  globalThis.UI = { escapeHtml:value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;') };
  const exam = { scopeSnapshot:{ version:1, nodes:[
    { code:'1', label:'單元一' },
    { code:'1-2', label:'第二章' },
    { code:'1-2-3', label:'第三節' },
    { code:'2', label:'單元二' }
  ] } };
  const html = await examScopeSummaryHtml(exam, { allLevels:true });
  assert.match(html, /單元一<\/span><ul class="edit-scope-tree"><li><span class="edit-scope-tree-label">第二章<\/span><ul class="edit-scope-tree"><li><span class="edit-scope-tree-label">第三節/);
  assert.match(html, /<\/ul><\/li><li><span class="edit-scope-tree-label">單元二/);
});

test('舊試卷不再嘗試回溯命題範圍', async () => {
  assert.match(await examScopeSummaryHtml({ scopeChapters:['1'] }, { allLevels:true }), /建立時尚未儲存/);
});
test('舊快照中的未選分支不再因上層勾選而出現，保留選取節點及祖先',async()=>{
  const html=await examScopeSummaryHtml({scopeChapters:['1','1-1','1-1-1'],scopeSnapshot:{version:1,nodes:[
    {code:'1',label:'單元一'},{code:'1-1',label:'已選章'},{code:'1-1-1',label:'已選節'},
    {code:'1-2',label:'未選空章'},{code:'1-2-1',label:'未選空節'}
  ]}},{allLevels:true});
  assert.match(html,/已選節/);
  assert.doesNotMatch(html,/未選空/);
});
