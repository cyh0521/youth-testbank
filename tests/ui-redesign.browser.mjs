import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const catalog=JSON.parse(await readFile('data/testbank/catalog-526e49109a0fa0f8.json','utf8'));
const fixture=`
window._testUser={uid:'fixture',role:window._testRole||'teacher',displayName:'測試',email:'test@example.test',avatar:''};
const catalog=${JSON.stringify(catalog)};
window.initTextbookCache=async()=>{
 const subjects=window._testFiltered?catalog.slice(0,1):catalog;
 window._tbCache={subjects,booksBySubject:Object.fromEntries(subjects.map(s=>[s.id,window._testFiltered?s.books.slice(0,2):s.books]))};
 return window._tbCache;
};
window.DataService={getExams(){throw Error('Homepage must not query exams');},logout(){window._testLoggedOut=true;}};
`;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 try{
  const body=path==='/js/auth-guard.js'?'export async function guardPage(){window.AppShell.confirmUser(window._testUser,window._activeNav);return window._testUser;}':path==='/js/core.js'?(await readFile('js/core.js','utf8'))+fixture:await readFile('.'+decodeURIComponent(path));
  const ext=path.split('.').at(-1);
  res.setHeader('Content-Type',{html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',png:'image/png',ttf:'font/ttf'}[ext]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 for(const role of ['teacher','manager','admin']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(role=>{window._testRole=role;localStorage.setItem('sidebarCollapsed','1');},role);
  await page.goto(base+'/dashboard.html');await page.locator('.gc-book').last().waitFor();
  assert.equal(await page.locator('.gc-book').count(),21);
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.gc-book img,.gc-welcome-art')].map(image=>image.decode())));
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.fonts.check('24px "Greeting Handwriting"','給辛苦的自己一杯咖啡，開始今天的命題吧！')));
  await page.locator('#toolbarAccount').waitFor();
  assert.ok((await page.locator('.site-header').boundingBox()).height<=61);
  await page.evaluate(role=>window.AppShell.mount(role,'compose'),role);
  const group=page.locator('.site-nav-group').first();
  assert.equal(await group.locator('summary span').count(),0);
  await group.locator('summary').hover();
  assert.ok(await group.locator('.site-nav-menu').isVisible());
  assert.equal(await group.locator('a.active').evaluate(link=>getComputedStyle(link).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.locator('.site-brand').hover();
  assert.ok(await group.locator('.site-nav-menu').isHidden());
  await page.evaluate(role=>window.AppShell.mount(role,'dashboard'),role);
  assert.equal(await page.locator('.sidebar').count(),0);
  assert.equal(await page.locator('.site-nav a[href="questions.html"]').count(),role==='teacher'?0:1);
  assert.equal(await page.locator('.site-nav a[href="settings.html?view=accounts"]').count(),role==='teacher'?0:1);
  assert.equal(await page.locator('.recent-section').count(),0);
  assert.equal(await page.locator('.main').getAttribute('inert'),null);
  assert.equal(await page.locator('#welcomeText').textContent(),role==='teacher'?'歡迎回來，測試 老師':'歡迎回來，測試');
  await page.locator('#toolbarAccount').click();assert.ok(await page.locator('#accountMenu').isVisible());
  await page.keyboard.press('Escape');assert.ok(await page.locator('#accountMenu').isHidden());
  await page.locator('.gc-book').first().click();assert.equal(await page.locator('#gc-mode-title').textContent(),'國際情勢');
  await page.keyboard.press('Escape');assert.ok(await page.locator('.gc-overlay').isHidden());
  for(const width of [1440,1024,820,650,480,360,320]){
   await page.setViewportSize({width,height:950});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
   assert.ok(await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.gc-grid')).gap)>=12));
   await page.locator('.gc-book').first().click();assert.ok(await page.locator('[data-mode="題本列印"]').isVisible());await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);await page.close();console.log('PASS homepage role, assets, menu, spacing: '+role);
 }
 const filtered=await browser.newPage();await filtered.addInitScript(()=>window._testFiltered=true);await filtered.goto(base+'/dashboard.html');await filtered.locator('.gc-book').last().waitFor();assert.equal(await filtered.locator('.gc-book').count(),2);assert.equal(await filtered.locator('.gc-heading>span').textContent(),'2 冊');await filtered.close();
 for(const [mode,pageName] of [['電腦選題','compose'],['手動選題','manual'],['編碼選題','coded'],['題本列印','booklet']]){
  const page=await browser.newPage();await page.route(`**/${pageName}.html?*`,route=>route.fulfill({contentType:'text/html',body:'<p>Destination</p>'}));
  await page.goto(base+'/dashboard.html');await page.locator('.gc-book').last().waitFor();await page.locator('.gc-book[data-book-code="B1-02"]').click();
  await page.locator(`[data-mode="${mode}"]`).click();await page.waitForURL(`**/${pageName}.html?*`);
  const url=new URL(page.url());assert.equal(url.searchParams.get('subject'),'B1');assert.equal(url.searchParams.get('book'),'B1-02');await page.close();
 }
 console.log('PASS personalized catalog and four book-specific destination URLs');
}finally{await browser.close();server.close();}
