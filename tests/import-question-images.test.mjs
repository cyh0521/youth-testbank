import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareImportImages} from '../js/import-question-images.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('以正式題號重新命名各欄位圖片，同題重複引用共用檔名且不修改解析資料', () => {
  const sources = new Map([['images/import-a.png','png'],['images/import-b.jpg','jpg']]);
  const q = {text:'[[圖片:images/import-a.png|240|圖一]]', options:['[[圖片:images/import-b.jpg|320|圖二]]'], answer:'○', analysis:'[[圖片:images/import-a.png|120|詳解]]'};
  const result = prepareImportImages(q,'00123',sources);
  assert.equal(result.question.text,'[[圖片:images/00123-1.png|240|圖一]]');
  assert.equal(result.question.options[0],'[[圖片:images/00123-2.jpg|320|圖二]]');
  assert.equal(result.question.analysis,'[[圖片:images/00123-1.png|120|詳解]]');
  assert.deepEqual([...result.entries], [['images/00123-1.png','png'],['images/00123-2.jpg','jpg']]);
  assert.match(q.text,/import-a/);
  assert.match(q.options[0],/import-b/);
});

test('不同題引用相同圖片仍各用自己的編號，既有網站圖片不重新命名', () => {
  const sources = new Map([['images/import-a.png','png']]);
  const q = {text:'[[圖片:images/import-a.png|240|圖]] [[圖片:images/existing.png|240|舊圖]]'};
  assert.match(prepareImportImages(q,'00001',sources).question.text,/00001-1.png/);
  const second = prepareImportImages(q,'00002',sources);
  assert.match(second.question.text,/00002-1.png/);
  assert.match(second.question.text,/images\/existing.png/);
  assert.equal(second.entries.size,1);
});

test('部分批次失敗時，只將已寫入題目的正式檔名交給下載流程並更新統計', async () => {
  const source = readFileSync(new URL('../js/firebase.js',import.meta.url),'utf8');
  const method = source.slice(source.indexOf('  async addQuestions('),source.indexOf('  // ── 新增單題')).trim().replace(/,$/,'');
  const archive = new Map(), prepared = new Map(), writes = [], stats = [];
  let batches = 0;
  const service = {_nextSeqNums:async count => Array.from({length:count},(_,i) => String(i+1).padStart(5,'0')), _applyStatsDelta:async delta => stats.push(delta.total)};
  runInNewContext(`DataService.addQuestions=({${method}}).addQuestions`,{
    DataService:service, db:{}, collection(){}, doc(){return {};}, serverTimestamp(){return 0;},
    writeBatch(){const number=++batches, rows=[];return {set(ref,q){rows.push(q);},async commit(){if(number===2)throw Error('Quota exceeded');writes.push(...rows);}};}
  });
  const q = {text:'[[圖片:images/import-a.png|240|圖]]',type:'T1',subjectCode:'B1'};
  await assert.rejects(service.addQuestions(Array.from({length:401},()=>q),(count,chunk)=>{
    for(const item of chunk) for(const [path,blob] of prepared.get(item.qnum)) archive.set(path,blob);
  },(question,qnum)=>{
    const result=prepareImportImages(question,qnum,new Map([['images/import-a.png','png']]));
    prepared.set(qnum,result.entries);return result.question;
  }),/Quota exceeded/);
  assert.equal(writes.length,400);
  assert.equal(archive.size,400);
  assert.equal(archive.has('images/00401-1.png'),false);
  assert.match(writes[0].text,/00001-1.png/);
  assert.deepEqual(stats,[400]);
});
