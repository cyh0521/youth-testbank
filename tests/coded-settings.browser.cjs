const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// Exercise the real editor and navigation offline, without Firebase access.
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('coded.html');
const preview = read('js/exam-preview.js');
const slice = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<link\b[^>]*href="([^"?]+)(?:\?[^\"]*)?"[^>]*>/g, (_, file) => `<style>${read(file)}</style>`)
      .replace(' inert', ''));
    const helpers = slice(preview, 'const TYPE_ORDER', '// ── 字型') +
      slice(preview, 'export const HEADER_BLANK_DEFAULTS', '// 舊版字型') +
      slice(preview, 'function groupByType(', '// ═') +
      slice(preview, 'export function buildHeaderHtml(', '// ═') +
      slice(preview, 'export function mountInlineHeaderEditor(', '// ═');
    await page.addScriptTag({content: read('js/core.js') + '\n' +
      read('js/blank-selection.js').replaceAll('export ', '') + '\n' +
      read('js/score-allocation.js').replaceAll('export ', '') + '\n' +
      helpers.replaceAll('export ', '') + `
      const allQs=[
        {id:'a',qnum:'00001',type:'T2',text:'選擇第一題',answer:'A'},
        {id:'b',qnum:'00002',type:'T2',text:'選擇第二題',answer:'B'},
        {id:'c',qnum:'00003',type:'T4',text:'填空第一題',answerCount:2},
        {id:'d',qnum:'00004',type:'T4',text:'填空第二題',answerCount:3},
      ];
      let filtered=allQs,selectedOrder=allQs.map(q=>q.id),curPage=1;
      const selectedIds=new Set(selectedOrder);let selQuestions=Object.fromEntries(allQs.map(q=>[q.id,q]));
      let settingsTypeOrder=['T1','T2','T3','T4','T5','T6'];
      let draftPreviewData={header:{titleText:'測試考卷'},appearance:{font:'serif'}};
      const fontStackById=()=> 'serif';
      const getCodedScopeQuestions=()=>allQs;
      const applyFilters=()=>renderBank();
      window.previewCalls=0;window.notices=[];UI.toast=message=>notices.push(message);
      function renderCodedExamPreview(){previewCalls++;}
      document.body.insertAdjacentHTML('beforeend','<input class="chap-cb" type="checkbox" checked hidden>');
      ` + slice(source, 'function codedQuestionBody(', '// ── 拖曳') +
      slice(source, 'window.clearCodedScores =', 'function renderSettingsHeaderSample()') +
      slice(source, 'function renderSettingsHeaderSample()', 'function renderCodedExamPreview()') +
      slice(source, 'window.goCodedStep =', "document.getElementById('codedStep1').setAttribute") +
      '\ngoCodedStep(2);goCodedStep(3);'});
    assert.equal(await page.locator('.coded-panel').count(), 4);
    assert.equal(await page.locator('#codedProgressFill').evaluate(el => el.style.width), '75%');
    assert.match(await page.locator('#totalScoreVal').innerText(), /100 分/);
    assert.equal(await page.locator('#codedSummary input').count(), 2);
    await page.locator('#codedIntegerScores').uncheck();
    const scoreInput = page.locator('#sc-T4');
    await scoreInput.fill('12.5');
    assert.equal(await scoreInput.evaluate(el=>el.closest('tr').draggable),false);
    const box=await scoreInput.boundingBox();
    await page.mouse.move(box.x+box.width-4,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+3,box.y+box.height/2,{steps:8});
    await page.mouse.up();
    await scoreInput.press('7');
    assert.equal(await scoreInput.inputValue(),'7','mouse selection must replace the selected number without dragging the row');
    assert(await scoreInput.evaluate(el=>!el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}))));
    await page.locator('#sc-T4').fill('2.5');
    assert.equal(await page.locator('#codedSubtotal-T4').innerText(), '12.5 分');
    assert.match(await page.locator('#codedHeaderSample').innerText(), /選擇第一題/);
    await page.getByRole('button', {name:'清除配分', exact:true}).click();
    assert.equal(await page.locator('#totalScoreVal').innerText(), '總分：0 分');
    await page.evaluate(() => goCodedStep(4));
    assert.equal(await page.evaluate(() => previewCalls), 0);
    assert(await page.locator('#codedPanel3').isVisible());
    await page.getByRole('button', {name:'自動配分', exact:true}).click();
    assert.match(await page.locator('#totalScoreVal').innerText(), /100 分/);
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      const from = document.querySelector('#codedSummary [data-type="T4"]');
      const to = document.querySelector('#codedSummary [data-type="T2"]');
      from.querySelector('.exam-type-drag').dispatchEvent(new DragEvent('dragstart', {bubbles:true, dataTransfer:transfer}));
      to.dispatchEvent(new DragEvent('dragover', {bubbles:true, dataTransfer:transfer}));
      to.dispatchEvent(new DragEvent('drop', {bubbles:true, dataTransfer:transfer}));
    });
    assert.equal(await page.locator('#codedSummary tbody tr').first().getAttribute('data-type'), 'T4');
    assert.match(await page.locator('#codedHeaderSample').innerText(), /填空第一題/);
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({width, height:1000});
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px page overflow`);
      if (process.env.SAVE_CODED_SETTINGS_SCREENSHOTS && [1440,390].includes(width)) {
        const file = path.join(process.env.TEMP, `coded-combined-${width}.png`);
        await page.screenshot({path:file, fullPage:true});
        console.log(file);
      }
    }
    await page.evaluate(() => goCodedStep(4));
    assert.equal(await page.evaluate(() => previewCalls), 1);
    assert.equal(await page.locator('#codedProgressFill').evaluate(el => el.style.width), '100%');
    await page.evaluate(() => {goCodedStep(3);goCodedStep(2);goCodedStep(3);});
    assert.equal(await page.locator('#codedSummary tbody tr').first().getAttribute('data-type'), 'T4');
    await page.evaluate(() => {goCodedStep(2);clearCodedSelection();});
    await page.locator('#qnumInput').fill('1');
    assert(await page.locator('#addBtn').isEnabled());
    await page.locator('#addBtn').click();
    assert.equal(await page.locator('#selList .result-q').count(),1);
    await page.locator('#qnumInput').fill('00001');
    assert(await page.locator('#addBtn').isDisabled());
    await page.locator('#batchInput').fill('00002,00002,99999,bad');
    await page.evaluate(() => addBatch());
    assert.equal(await page.locator('#selList .result-q').count(),2);
    assert.match(await page.locator('#batchHint').innerText(), /新增 1 題；重複 1 題；範圍內未找到 1 題；格式無效 1 筆/);
    await page.locator('#codedFullBtn').click();
    const row=page.locator('#selList .result-q').first();
    await row.click();
    assert(await row.locator('.coded-compact-question').isVisible());
    await row.getByRole('button',{name:'移除',exact:true}).click();
    await page.locator('#qnumInput').fill('00001');
    await page.locator('#addBtn').click();
    assert.equal(await page.locator('#selList .result-q.is-expanded').count(),0);
    await page.locator('#qnumInput').fill('00001');
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height:1000});
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px coded input overflow`);
      assert.equal(await page.locator('#selList').evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(246, 241, 231)');
      assert.equal(await page.locator('#lookupResult .q-ans').evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(220, 233, 223)');
      if (process.env.SAVE_CODED_SETTINGS_SCREENSHOTS) {
        const file = path.join(process.env.TEMP, `coded-selection-${width}.png`);
        await page.screenshot({path:file, fullPage:true});
        console.log(file);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS coded lookup, batch/duplicate/missing codes, display reset, four-step flow, scores, sorting, sample and responsive layout');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
