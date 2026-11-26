const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://offline.test/**', route => route.fulfill(route.request().url().endsWith('confirm-exam-deletion.js')
      ? {contentType:'text/javascript',body:fs.readFileSync('js/confirm-exam-deletion.js','utf8')}
      : {contentType:'text/html',body:'<html><head></head><body></body></html>'}));
    await page.goto('https://offline.test/');
    await page.addScriptTag({content:fs.readFileSync('js/dialog-keyboard.js','utf8')});
    const fixture = `<div class="modal-overlay compose-inline-preview"><button class="modal-close" onclick="window.inlineClosed=true">Close</button></div>
      <div class="modal-overlay" id="first"><input id="name" value="original"><button>儲存</button><button class="modal-close" onclick="this.parentElement.hidden=true">Close</button></div>
      <div class="modal-overlay" id="second" style="position:relative;z-index:1200"><button class="modal-close" onclick="this.parentElement.hidden=true">Close</button></div>`;
    await page.evaluate(html=>document.body.innerHTML=html, fixture);
    await page.keyboard.press('Escape');
    assert(await page.locator('#second').isHidden());
    assert(await page.locator('#first').isVisible());
    await page.locator('#first .modal-close').evaluate(e=>e.disabled=true);
    await page.keyboard.press('Escape');
    assert(await page.locator('#first').isVisible());
    await page.locator('#first .modal-close').evaluate(e=>e.disabled=false);
    await page.locator('#name').fill('changed');
    await page.keyboard.press('Escape');
    await page.locator('#deleteExamDialogTitle').waitFor();
    await page.keyboard.press('Escape');
    assert(await page.locator('#first').isVisible(), 'Escape on confirmation cancels discard');
    await page.keyboard.press('Escape');
    await page.locator('[data-choice="confirm"]').click();
    assert(await page.locator('#first').isHidden());
    await page.keyboard.press('Escape');
    assert(!await page.evaluate(()=>window.inlineClosed), 'inline previews are not dialogs');
    console.log('PASS Escape: topmost only, disabled close, unsaved cancel/discard, inline preview exclusion');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
