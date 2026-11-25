const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const extract = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
const plainModule = text => text.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '').replaceAll('import.meta.url', '"https://offline.test/js/exam-preview.js"');

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    let reference;
    for (const mode of ['exams', 'compose', 'manual', 'coded', 'booklet']) {
      const page = await browser.newPage({viewport:{width:1440, height:1000}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const source = read(`${mode}.html`);
      await page.setContent(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
        .replace(/<link\b[^>]*href="([^"?]+)(?:\?[^\"]*)?"[^>]*>/g, (_, file) => `<style>${read(file)}</style>`)
        .replace(' inert', ''));
      await page.addScriptTag({content: read('js/icons.js') + '\n' + read('js/core.js') + '\n' + `
        window.DataService={getExamPreferences:()=>({}),refreshExamPreferences:async()=>{},updateExamPreferences:async()=>{},
          loadTextbookCache:async()=>({subjectByCode:{A:{id:'s'}},booksBySubject:{s:[{id:'b',code:'B'}]}}),
          getChapterDefs:async()=>[{chapterNum:1,title:'第一章',sections:[{sectionNum:1,title:'第一節'}]}]};
        const DOWNLOAD_TYPES=[];
      ` + plainModule(read('js/preview-scope.js')) + '\n' + plainModule(read('js/exam-preview.js')) + `
        const questions=[{id:'q1',type:'T2',text:'預覽題目\\n(A)甲 (B)乙',answer:'A',chapterNum:1,sectionNum:1},
          {id:'q2',type:'T4',text:'填空題目',answer:'答案',answerCount:2,chapterNum:1,sectionNum:1}];
        const exam={title:'離線試卷',subjectCode:'A',bookCode:'B',header:{titleText:'預覽版型'},typeScores:{T2:4,T4:2},scoreUnits:{T4:'blank'},appearance:{font:'system',fontSize:16,lineHeight:1.3}};
        const openSaveModal=()=>{};
        const previewExam=()=>showExamPreview(exam,questions,{scopeDisplay:'grouped'});
        const previewSelected=previewExam;
      `});
      if (mode === 'exams') {
        await page.addScriptTag({content:extract(source, 'function showManagementPreview(', 'window.previewExam =') + '\nshowManagementPreview(exam,questions);'});
      } else if (mode === 'booklet') {
        await page.addScriptTag({content:extract(read('js/exam-scope.js'), 'export function renderScopePanel(', 'export function mountScopeSelector(').replaceAll('export ','') + `
          window.bookletRanges=[];window.bookletQuestions=questions;
          const scopeSelector={getSelectedChapters:()=>bookletRanges,getQuestions:()=>bookletQuestions,getChapterCatalog:()=>({chapters:[],labels:['章','節','小節']})};
          let bookletData={...exam,booklet:true},scopeRevision=1,previewRevision=-1;
          document.getElementById('examScope').innerHTML=renderScopePanel({nextAction:'goBookletStep(2)',nextLabel:'預覽題本'});
          document.getElementById('cSubject').innerHTML='<option>測試科目</option>';
          document.getElementById('cBook').innerHTML='<option>測試冊</option>';
        ` + extract(source, 'window.goBookletStep =', '</script>')});
        assert.equal(await page.locator('#bookletPanel1 .card').first().evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(246, 241, 231)');
        for (const width of [1440,768,390]) {
          await page.setViewportSize({width,height:1000});
          assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `${width}px booklet scope overflow`);
        }
        await page.evaluate(() => goBookletStep(2));
        assert(await page.locator('#bookletPanel1').isVisible(), 'missing range must stay on scope step');
        await page.evaluate(() => {bookletRanges=['1-1'];bookletQuestions=[];goBookletStep(2);});
        assert(await page.locator('#bookletPanel1').isVisible(), 'empty range must stay on scope step');
        await page.evaluate(() => {bookletQuestions=questions;});
        await page.setViewportSize({width:1440,height:1000});
        await page.evaluate(() => goBookletStep(2));
      } else {
        const name = mode[0].toUpperCase() + mode.slice(1);
        const end = mode === 'compose' ? 'const scoreOverrides =' : `window.go${name}Step =`;
        await page.addScriptTag({content:extract(source, `function render${name}ExamPreview()`, end) + `
          document.querySelectorAll('.${mode}-panel').forEach(el=>el.hidden=el.id!=='${mode}Panel${mode==='manual'||mode==='coded'?4:5}');
          render${name}ExamPreview();`});
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(errors, [], `${mode}: preview initialization`);
      const metrics = await page.evaluate(() => {
        const options = document.getElementById('epPreviewOptions');
        const header = document.querySelector('#epPaper>.ep-exam-header');
        const styles = getComputedStyle(options);
        return {border:styles.borderBottom, margin:styles.marginBottom, padding:styles.paddingBottom,
          headerLeft:header ? Math.round(header.getBoundingClientRect().x-options.getBoundingClientRect().x) : 0,
          paperBackground:getComputedStyle(document.getElementById('epPaper')).backgroundColor};
      });
      if (mode === 'exams') reference = metrics;
      else assert.deepEqual(metrics, reference, `${mode}: management preview style parity`);
      await page.locator('#epShowAnswers').check();
      assert.equal(await page.locator('#epPreviewOptions').count(), 1);
      assert.equal(await page.locator('#epPaper').count(), 1);
      if (mode !== 'booklet') {
        assert(await page.locator('.ep-scope-group-heading').count());
        assert.equal(await page.locator('.ep-scope-level-1').first().evaluate(el => getComputedStyle(el).paddingLeft), '28px');
      }
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({width, height:1000});
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${mode}: ${width}px overflow`);
        if (mode !== 'exams') {
          assert(!await page.locator('.compose-preview-tools button').evaluateAll(buttons => buttons.some(button => {
            const box = button.getBoundingClientRect();
            return box.width && box.right > innerWidth;
          })), `${mode}: ${width}px clipped preview actions`);
        }
        if (process.env.SAVE_SELECTION_PREVIEW_SCREENSHOTS && [1440,390].includes(width)) {
          const file = path.join(process.env.TEMP, `unified-preview-${mode}-${width}.png`);
          await page.screenshot({path:file, fullPage:true});
          console.log(file);
        }
      }
      assert.deepEqual(errors, [], `${mode}: browser errors`);
      if (mode === 'booklet') {
        await page.evaluate(() => {window.layoutPromise=choosePaperLayout('Word',false);});
        await page.locator('#epPaperSizeModal').waitFor({state:'visible'});
        assert.equal(await page.locator('#epPaperSizeClose').evaluate(el=>getComputedStyle(el).width),'30px');
        assert(await page.locator('input[name="epPaperSize"][value="A4"]').isChecked());
        await page.locator('#epPaperSizeCancel').click();
        assert.equal(await page.evaluate(()=>layoutPromise),null);
        await page.evaluate(()=>{goBookletStep(1);goBookletStep(2);});
        assert.equal(await page.locator('#epModal').count(),1);
        assert.equal(await page.locator('#bookletPreviewTools button').count(),3);
      }
      console.log(`PASS ${mode}: preview parity, answer toggle, scope and responsive layout`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exit(1);});
