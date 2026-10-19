import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'})[path.extname(name)]||'application/octet-stream');res.end(await readFile(path.join(root,name)));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}/user-guide.html`);
 assert.equal(await page.locator('.chapter').count(),12);
 assert.equal(await page.locator('figure img').count(),20);
 await page.evaluate(async()=>{const images=[...document.querySelectorAll('figure img')];images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode()));});
 assert.equal(await page.locator('figure img').evaluateAll(images=>images.every(image=>image.naturalWidth>=2732)),true,'Screenshots must retain double-resolution originals');
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].every(a=>a.hash==='#'||document.getElementById(a.hash.slice(1)))),true);
 assert.equal(await page.locator('.guide-header').innerText().then(s=>s.includes('題庫管理')),false);
 await page.locator('#login [data-zoom]').first().click();assert.equal(await page.locator('#imageZoom').evaluate(d=>d.open),true);
 assert.ok(await page.locator('#zoomImage').getAttribute('alt'));await page.keyboard.press('Escape');assert.equal(await page.locator('#imageZoom').evaluate(d=>d.open),false);
 assert.equal(await page.locator('#login [data-zoom]').first().evaluate(a=>document.activeElement===a),true);
 const folded=await page.locator('details:not([open])').count();await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('details:not([open])').count(),0);await page.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('details:not([open])').count(),folded);
 for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);}
 if(process.env.GUIDE_QA_DIR){await page.setViewportSize({width:1440,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/user-guide.html`);await page.screenshot({path:path.join(process.env.GUIDE_QA_DIR,'user-guide-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(process.env.GUIDE_QA_DIR,'user-guide-mobile.png')});}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log('PASS: 12 chapters, 20 high-resolution images, all anchors/assets, zoom/Escape/focus, print expansion, and responsive widths 320–1440.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
