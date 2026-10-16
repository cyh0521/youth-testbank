const fs = require('fs');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const html = fs.readFileSync('import.html','utf8');
  const source = html.slice(html.indexOf('let exportBusy ='),html.indexOf('window.exportStaticTextbank ='));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="exportTextbankBtn"></button><div id="textbankExportModal" class="hidden"><input type="checkbox" id="exportAllBooks"><div id="exportBookList"></div><div id="exportBookStatus"></div><button id="downloadTextbankBtn"></button></div>');
    await page.evaluate(() => {
      window.UI = {escapeHtml:s=>String(s)};
      window._tbCache = {subjects:[{id:'s',code:'OLD',name:'舊快取'}]};
      window.calls = 0;
      window.DataService = {getExportBookOptions:async()=>{
        window.calls++;
        return [{id:'s',code:'NEW',name:'最新科目',books:[{id:'b',code:String(window.calls),name:'最新冊別'}]}];
      }};
    });
    await page.addScriptTag({content:source});
    await page.evaluate(()=>openTextbankExport());
    assert.match(await page.locator('#exportBookList').innerText(),/NEW 最新科目/);
    assert(!await page.locator('#exportBookList').innerText().then(s=>s.includes('舊快取')));
    assert(await page.locator('#downloadTextbankBtn').isDisabled());
    await page.locator('#exportBookList input').check();
    assert(await page.locator('#downloadTextbankBtn').isEnabled());
    await page.evaluate(()=>closeTextbankExport());
    await page.evaluate(()=>openTextbankExport());
    assert.match(await page.locator('#exportBookList').innerText(),/2 最新冊別/);
    assert.equal(await page.evaluate(()=>calls),2);
    console.log('Export dialog refreshes live catalog on every opening and ignores stale static cache');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
