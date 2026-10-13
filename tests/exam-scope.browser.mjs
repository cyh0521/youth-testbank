import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
// Run with node tests/exam-scope.browser.mjs; optionally set PLAYWRIGHT_MODULE_PATH
// to a bundled playwright package directory and PLAYWRIGHT_CHANNEL to a browser channel.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const fixture = `
window._tbCache={subjects:[{id:'s',code:'A',name:'測試科目'}],subjectByCode:{A:{id:'s'}},booksBySubject:{s:[{id:'empty',code:'E',name:'空冊次'},{id:'full',code:'B',name:'有題目冊次'},{id:'slow',code:'S',name:'慢速冊次'}]}};
window.initTextbookCache=async()=>{};
window.tbSubjectOptions=()=>'<option value="">請選擇科目</option><option value="A">測試科目</option>';
window.QUESTION_TYPES={T1:'是非題',T2:'選擇題',T3:'複選題',T4:'填空題',T5:'配合題',T6:'問答題'};
window.UI={toast:message=>(window.messages??=[]).push(message),escapeHtml:x=>String(x??''),questionHtml:x=>String(x??''),typeBadge:()=>'',diffBadge:()=>'',matchingQuestionHtml:x=>x};
window.DataService={getQuestionCount:async({bookCode})=>bookCode==='E'?0:1,getQuestions:async({bookCode})=>{if(bookCode==='S')await new Promise(r=>setTimeout(r,200));return bookCode==='E'?[]:(bookCode?[bookCode]:['B','S']).map(code=>({id:code+'-q1',qnum:'00042',subjectCode:'A',bookCode:code,chapterNum:'01',sectionNum:'01',subsectionNum:'01',type:'T1',text:'測試題目',answer:'O'}))},getChapterDefs:async()=>[{chapterNum:1,title:'有題目章',sections:[{sectionNum:1,title:'有題目節',subsections:[{num:1,title:'有題目小節'},{num:2,title:'空小節'}]},{sectionNum:2,title:'空節'}]},{chapterNum:2,title:'空章'}]};
window._tbCache.booksBySubject.s.forEach(b=>Object.assign(b,{l1:'章',l2:'節',l3:'小節'}));
window.DataService.getExamPreferences=()=>({});
window.UI.choiceQuestionHtml=q=>q.text;
window.UI.questionText=value=>String(value??'');
window.UI.questionSummary=value=>String(value??'');
document.addEventListener('DOMContentLoaded',()=>document.querySelector('.main')?.removeAttribute('inert'));
`;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 try {
  let body=path==='/js/core.js'?fixture:path==='/js/auth-guard.js'?'export async function guardPage(){return {uid:"test"};}': ['/js/shell.js','/js/icons.js'].includes(path)?'':await readFile('.'+decodeURIComponent(path));
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);
 }catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
try {
 for(const name of ['compose','manual','coded','booklet']) {
  const page=await browser.newPage({viewport:{width:1500,height:950}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html`);
  {
    await page.locator('#cSubject').selectOption('A');
    await page.locator('#cBook option[value="B"]:not(:disabled)').waitFor({state:'attached'});
    assert.equal(await page.locator('#scopeOverview').isVisible(),true);
    assert.equal(await page.locator('#subjectTree').count(),0);
    await page.locator('#cBook').selectOption('B');
    assert.equal(await page.locator('#scopeTotal').innerText(),'1 題');
  }
  await page.getByText('有題目章',{exact:true}).waitFor();
  assert.equal(await page.locator('#cBook option[value="E"]').isDisabled(),true);
  assert.equal(await page.locator('.chapter-cb[data-ch="01"]').count(),0);
  assert.equal(await page.getByText('有題目章',{exact:true}).evaluate(el=>getComputedStyle(el).cursor),'pointer');
  assert.equal(await page.getByText('空章',{exact:true}).evaluate(el=>getComputedStyle(el).cursor),'not-allowed');
  assert.equal(await page.locator('.chapter-cb[data-ch="2"]').isDisabled(),true);
  await page.locator('.chapter-item').filter({has:page.locator('.chapter-cb[data-ch="2"]')}).click();
  assert.equal(await page.locator('.chapter-cb[data-ch="2"]').isChecked(),false);
  const row=page.locator('.chapter-item').filter({has:page.locator('.chapter-cb[data-ch="1"]')}).first();
  // Click row padding rather than checkbox or label.
  await row.click({position:{x:3,y:10}});
  assert.equal(await page.locator('.chapter-cb[data-ch="1"]').isChecked(),true);
  assert.equal(await page.locator('#scopeAvailable').innerText(),'︱可選題數 1 題');
  assert.equal(await page.locator('.chap-cb:disabled:checked').count(),0);
  // Expand without toggling selection, then verify partial/parent states.
  await row.locator('.expand-btn').click();
  assert.equal(await page.locator('.chapter-cb[data-ch="1"]').isChecked(),true);
  const section=page.locator('.chapter-item').filter({has:page.locator('.sec-cb[data-ch="1"][data-sec="1"]')}).first();
  await section.locator('.expand-btn').click();
  assert.equal(await page.locator('.chap-cb[data-sub="2"]').isDisabled(),true);
  await page.getByText('有題目小節',{exact:true}).click();
  assert.equal(await page.locator('.chapter-cb[data-ch="1"]').isChecked(),false);
  await page.getByText('有題目小節',{exact:true}).click();
  assert.equal(await page.locator('.chapter-cb[data-ch="1"]').isChecked(),true);
  await page.getByRole('button',{name:'取消選取',exact:true}).click();
  assert.equal(await page.locator('.chap-cb:checked').count(),0);
  await row.click({position:{x:3,y:10},modifiers:['Shift']});
  assert.equal(await page.locator('.chapter-cb[data-ch="1"]').isChecked(),true);
  if(name==='booklet') {
    assert.deepEqual(errors,[]);
    console.log('PASS browser: booklet empty book, disabled chapter, row selection, child propagation');
    await page.close();
    continue;
  }
  await page.locator('#examScope .btn-primary').click();
  assert.equal(await page.locator('#'+name+'Panel2').isVisible(),true);
  if(name!=='compose') {
   if(name==='coded'){await page.locator('#qnumInput').fill('42');await page.locator('#addBtn').click();}
   else await page.locator('#bankList').getByRole('button',{name:'加入',exact:true}).click();
   assert.match(await page.locator('#selCountLabel').innerText(),/1 題/);
   const statsRow = page.locator('.selected-result-info');
   assert.equal(await statsRow.locator('#'+name+'FullBtn').count(),1);
   assert.ok(await page.locator('#selList .'+name+'-compact-question').isVisible());
   await page.locator('#'+name+'FullBtn').click();
   assert.ok(await page.locator('#selList .'+name+'-full-question').isVisible());
   assert.equal(await page.locator('#'+name+'FullBtn').getAttribute('aria-pressed'),'true');
   await page.locator('#'+name+'ListBtn').click();
   assert.ok(await page.locator('#selList .'+name+'-compact-question').isVisible());
   await page.locator('#selList .result-q[data-id]').click();
   assert.ok(await page.locator('#selList .'+name+'-full-question').isVisible());
   assert.match(await statsRow.locator('#selectedStats').innerText(),/共 1 題/);
   if (name === 'manual') {
    assert.equal(await page.locator('.card-header #manualFilterMenu').count(),0);
    const bankTitle = await page.locator('#bankList .result-section-title').first().boundingBox();
    const selectedTitle = await page.locator('#selList .result-section-title').first().boundingBox();
    assert.ok(Math.abs(bankTitle.y-selectedTitle.y)<1,'first type rows should align');
    assert.ok(Math.abs(bankTitle.height-selectedTitle.height)<1,'type rows should have equal heights');
    const card = await page.locator('.card:has(#bankList)').boundingBox();
    const tools = await page.locator('.manual-bank-tools').boundingBox();
    const bank = await page.locator('#bankList').boundingBox();
    assert.ok(tools.x+tools.width<=card.x+card.width+1,'filter tools should stay inside the left card');
    assert.ok(bank.x+bank.width<=card.x+card.width+1,'question list should stay inside the left card');
   }
  }
  await page.evaluate(name=>window['go'+name[0].toUpperCase()+name.slice(1)+'Step'](1),name);
  await page.locator('#cBook').selectOption('S');
  await page.locator('#cBook').selectOption('B');
  await page.getByText('有題目章',{exact:true}).waitFor();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#cBook').inputValue(),'B','outdated request must not replace selected book');
  await page.locator('.chapter-cb[data-ch="1"]').check();
  assert.equal(await page.locator('#scopeAvailable').innerText(),'︱可選題數 1 題');
  assert.deepEqual(errors,[]);
  console.log('PASS browser: '+name+' empty book, disabled chapter, row selection, child propagation, next step, stale request');
  await page.close();
 }
 for(const name of ['compose','manual','coded','booklet']) {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html?subject=A&book=S`);
  await page.getByText('有題目章',{exact:true}).waitFor();
  assert.equal(await page.locator('#cSubject').inputValue(),'A');
  assert.equal(await page.locator('#cBook').inputValue(),'S');
  assert.deepEqual(errors,[]);
  await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html?subject=A&book=E`);
  await page.waitForFunction(()=>window.messages?.some(message=>message.includes('尚無')));
  assert.equal(await page.locator('.chap-cb:checked').count(),0);
  assert.deepEqual(errors,[]);await page.close();
  console.log('PASS browser: '+name+' homepage book preset and empty book');
 }
}finally{await browser.close();server.close();}
