// 使用本機正式題庫與虛構示範帳號截圖，不連線登入或更動正式資料。
import {createRequire} from 'node:module';
import {readFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'images/user-guide');await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'data/testbank/manifest.json'),'utf8'));
const catalog=JSON.parse(await readFile(path.join(root,'data/testbank',manifest.catalog),'utf8'));
const entry=manifest.books.find(book=>book.subjectCode==='A1'&&book.bookCode==='A1-01');
const actualQuestions=JSON.parse(await readFile(path.join(root,'data/testbank',entry.path),'utf8'));
const chapterOne=actualQuestions.filter(q=>Number(q.chapterNum)===1);
const length=q=>String(q.text||'').length+JSON.stringify(q.options||[]).length;
const previewQuestions=['T1','T2'].flatMap(type=>chapterOne.filter(q=>q.type===type).sort((a,b)=>length(b)-length(a)).slice(0,3));
previewQuestions.push(...['T1','T2'].map(type=>actualQuestions.filter(q=>Number(q.chapterNum)===2&&q.type===type).sort((a,b)=>length(b)-length(a))[0]));
const fixture=`
const demoCatalog=${JSON.stringify(catalog)};
const demoUser={uid:'guide-demo',role:'teacher',displayName:'王怡文',nickname:'怡文',email:'teacher@example.com',school:'示範學校',avatar:'',homeFavoriteBooks:[],examPreferences:{},createdAt:'2026-10-01'};
const demoQuestions=${JSON.stringify(actualQuestions)};
const previewQuestionIds=${JSON.stringify(previewQuestions.map(q=>q.id))};
const demoExam={id:'guide-exam',title:'國際情勢・第一章練習卷',description:'示範試卷（使用說明；題目取自實際題庫）',subjectCode:'A1',bookCode:'A1-01',questionIds:previewQuestionIds,questionCount:previewQuestionIds.length,scores:{T1:10,T2:20},createdBy:demoUser.uid,createdAt:new Date('2026-10-19T09:30:00+08:00'),typeOrder:['T1','T2']};
window._guideUser=demoUser;
window.DataService={getCurrentUser:()=>demoUser,isAdmin:()=>false,isTeacher:()=>true,isPrimaryAdmin:()=>false,getVisibleCatalog:()=>null,getExamPreferences:()=>demoUser.examPreferences,refreshExamPreferences:async()=>demoUser.examPreferences,getSubjects:async()=>demoCatalog.map(({books,...s})=>s),getBooks:async id=>demoCatalog.find(s=>s.id===id)?.books||[],getChapterDefs:async(subjectId,bookId)=>demoCatalog.find(s=>s.id===subjectId)?.books.find(b=>b.id===bookId)?.chapters||[],getQuestionCount:async o=>!o.bookCode||o.bookCode==='A1-01'?demoQuestions.length:0,getQuestions:async(o={})=>!o.bookCode||o.bookCode==='A1-01'?demoQuestions:[],getQuestionsByIds:async ids=>demoQuestions.filter(q=>ids.includes(q.id)),getExams:async()=>[demoExam,{...demoExam,id:'guide-exam2',title:'國際情勢・課堂複習卷',createdAt:new Date('2026-10-15T14:00:00+08:00')}],updateProfile:async(uid,patch)=>Object.assign(demoUser,patch),saveExam:async()=>demoExam.id,getExamCountForUser:async()=>2,updateExamPreferences:async p=>Object.assign(demoUser.examPreferences,p),logout:async()=>{},changePassword:async()=>{},preserveExamAppearances:async()=>{},preserveExamHeaders:async()=>{}};
window._dsReady=Promise.resolve();
window.initTextbookCache=async()=>{
 const c={subjects:[],books:{},booksBySubject:{},subjectByCode:{},subjectById:{}};
 for(const s of demoCatalog){c.subjects.push(s);c.subjectByCode[s.code]=s;c.subjectById[s.id]=s;c.booksBySubject[s.id]=s.books;for(const b of s.books)c.books[b.code]={...b,subjectId:s.id};}
 window._tbCache=c;return c;
};
`;
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');let file=decodeURIComponent(url.pathname);
 try{
  let body;
  if(file==='/js/auth-guard.js')body='export async function guardPage(){window.AppShell.confirmUser(window._guideUser,window._activeNav);return window._guideUser;}';
  else{body=await readFile(path.join(root,file));if(file==='/js/core.js')body=body.toString()+fixture;if(file==='/index.html')body=body.toString().replace(/<script type="module">[\s\S]*?<\/script>/,'');}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:920},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',r=>r.abort());
const base='http://127.0.0.1:'+server.address().port;
async function open(name){await page.goto(base+'/'+name);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);}
async function shot(name){await page.mouse.move(1350,900);await page.waitForTimeout(400);const heights={'03-modes':800,'04-scope':560,'08-booklet':560,'10-exams':430,'11-preview':660};await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled',clip:{x:0,y:0,width:1366,height:heights[name]||920}});console.log('Captured '+name);}
async function scope(name){await open(name+'.html?subject=A1&book=A1-01');await page.locator('.chapter-cb:not(:disabled)').first().waitFor();await page.locator('.chapter-cb:not(:disabled)').first().check();}
try{
 await open('index.html');await page.locator('#fbStatus').evaluate(el=>el.textContent='');await shot('01-login');
 await open('dashboard.html');await page.locator('.gc-book').last().waitFor();await page.evaluate(()=>Promise.all([...document.querySelectorAll('.gc-book img,.gc-welcome-art')].map(i=>i.decode())));await shot('02-home');
 await page.locator('.gc-book').first().click();await shot('03-modes');
 await scope('compose');await shot('04-scope');
 await page.evaluate(()=>window.goComposeStep(2));await page.locator('#cnt-T1').fill('4');await page.locator('#cnt-T2').fill('3');await page.evaluate(()=>window.autoAllocateScores());await shot('05-computer');
 await page.evaluate(()=>window.doGenerate());await page.waitForTimeout(250);await shot('16-generated');
 await page.evaluate(()=>window.goComposeStep(4));await page.waitForTimeout(250);await shot('17-exam-settings');
 await scope('compose');await page.locator('.chapter-cb:not(:disabled)').nth(1).check();await page.evaluate(()=>window.goComposeStep(2));await page.locator('#openSectionWeights').click();
 await page.locator('.section-weight-range').first().fill('3');await page.locator('.section-weight-range').nth(1).fill('1');await shot('19-section-weights');
 await scope('manual');await page.evaluate(()=>window.goManualStep(2));await page.waitForTimeout(250);for(let i=0;i<3;i++)await page.locator('#manualPanel2 button').filter({hasText:/^加入$/}).first().click();await shot('06-manual');
 await scope('coded');await page.evaluate(()=>window.goCodedStep(2));await page.waitForTimeout(250);await page.locator('#qnumInput').fill('00007');await shot('07-coded');
 await scope('booklet');await shot('08-booklet');
 await page.evaluate(()=>window.goBookletStep(2));await page.waitForTimeout(400);await shot('09-booklet-preview');
 await open('exams.html');await page.locator('#examList .recent-exam-actions').first().waitFor();await shot('10-exams');
 const preview=page.locator('#examList button').filter({hasText:'預覽'}).first();await preview.click();await page.waitForTimeout(400);await shot('11-preview');
 await page.locator('#epModal [data-scope-select]').first().click();await page.waitForTimeout(200);if(!await page.locator('#epModal .ep-scope-highlight').count())throw Error('Scope highlight missing');await shot('20-scope-highlight');await page.locator('#epModal [data-scope-select]').first().click();
 await page.evaluate(()=>{window._epDoExport();});await page.locator('#epPaperSizeModal:not(.hidden)').waitFor();await shot('12-download');await page.locator('#epPaperSizeCancel').click();
 await open('exams.html');await page.locator('#examList .recent-exam-actions').first().waitFor();await page.locator('#examList button').filter({hasText:'編輯'}).first().click();await page.waitForTimeout(300);await shot('18-edit');
 await open('settings.html');await page.locator('#spanel-profile').waitFor();await shot('13-profile');
 await page.locator('#stab-subjects').click();await shot('14-subjects');
 await page.locator('#stab-appearance').click();await shot('15-appearance');
 console.log('Page errors:',JSON.stringify(errors));
}finally{await browser.close();await new Promise(r=>server.close(r));}
