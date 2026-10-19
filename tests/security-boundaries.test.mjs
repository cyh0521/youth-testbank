import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const countMethod = read('js/firebase.js').match(/async getExamCountForUser\(uid\) \{([\s\S]*?)\n  \},/)[1];
function countService(role, storedCount) {
 const calls=[];
 const DataService={_currentUser:{uid:'self'},isAdmin:()=>['admin','manager'].includes(role)};
 const getCount=runInNewContext('(async function(uid){'+countMethod+'})',{
  DataService,db:{},doc:(_db,collection,uid)=>({collection,uid}),
  getDoc:async ref=>{calls.push(ref);return {exists:()=>true,data:()=>({examCurrentCount:storedCount})};},
  collection:(_db,name)=>name,where:(...args)=>args,query:(...args)=>{calls.push(args);return args;},
  getCountFromServer:async()=>({data:()=>({count:7})})
 });
 return {getCount,calls};
}
test('administrators read only account statistics for another user',async()=>{
 for(const role of ['admin','manager']){const s=countService(role,3);assert.equal(await s.getCount('teacher'),3);assert.equal(s.calls.length,1);assert.equal(s.calls[0].collection,'users');assert.equal(s.calls[0].uid,'teacher');}
});
test('missing account statistics are unavailable, never an exam query',async()=>{
 const s=countService('admin',undefined);assert.equal(await s.getCount('teacher'),null);assert.equal(s.calls.length,1);assert.equal(s.calls[0].collection,'users');
});
test('teachers cannot query other account counts; own count remains owner filtered',async()=>{
 const s=countService('teacher');await assert.rejects(s.getCount('other'),/權限不足/);assert.equal(s.calls.length,0);assert.equal(await s.getCount('self'),7);assert.equal(s.calls[0][0],'exams');assert.deepEqual(Array.from(s.calls[0][1]),['createdBy','==','self']);
});
test('exam rules provide only owner filtered read access without admin list exception',()=>{
 const block=read('firestore.rules').split('match /exams/{eid} {')[1].split('// ── settings')[0];
 assert.match(block,/allow read:\s*if isTeacher\(\) && resource\.data\.createdBy == request\.auth\.uid;/);
 assert.doesNotMatch(block,/allow list|isAdmin\(\)/);
});
const source=read('js/auth-guard.js').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
async function guard(user,allowed){
 const events=[];const window={_dsReady:Promise.resolve(),_activeNav:'questions',AppShell:{clear:()=>events.push('clear'),confirmUser:()=>events.push('confirmed')},location:{replace:url=>events.push(url)},sessionStorage:{role:'admin'}};
 const DataService={getCurrentUser:()=>user,logout:async()=>events.push('logout')};
 const fn=runInNewContext(source+'\nguardPage',{window,DataService});
 return {result:await fn(allowed),events};
}
test('unauthenticated direct page access redirects to login',async()=>{const r=await guard(null,['admin','manager']);assert.equal(r.result,null);assert.ok(r.events.includes('index.html'));assert.ok(!r.events.includes('confirmed'));});
test('teacher cannot enter admin page even with forged cached navigation role',async()=>{const r=await guard({role:'teacher'},['admin','manager']);assert.equal(r.result,null);assert.ok(r.events.includes('dashboard.html'));assert.ok(!r.events.includes('confirmed'));});
test('unsupported account role is logged out',async()=>{const r=await guard({role:'student'});assert.equal(r.result,null);assert.ok(r.events.includes('logout'));});
test('both administrator roles pass management guard',async()=>{for(const role of ['admin','manager']){const user={role};const r=await guard(user,['admin','manager']);assert.equal(r.result,user);assert.ok(r.events.includes('confirmed'));}});
test('all management entry points declare restricted guard',()=>{for(const name of ['textbooks.html','questions.html','import.html','import-textbooks.html','js/reverse-import-page.js'])assert.match(read(name),/guardPage\(\['admin',\s*'manager'\]\)/,name);const settings=read('settings.html');assert.match(settings,/settingsView === 'accounts' && !isAdmin/);assert.match(settings,/settingsView === 'accounts' && isAdmin\) buildAccountsPanel/);});
