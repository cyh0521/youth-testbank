import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepareQuestionMove} from '../js/move-imported-questions.js';
const book={l2:'',l3:'',chapters:[{chapterNum:1},{chapterNum:2}]};
const question={id:'q1',qnum:'00123',subjectCode:'G1',bookCode:'G1-01',chapterNum:1,sectionNum:0,subsectionNum:0,text:'[[圖片:images/00123-1.png|320|圖]]',answer:'○'};
test('搬移只產生科目冊別與目錄編碼更新，不修改題號、內容或圖片',()=>{
  const before=JSON.stringify(question);
  assert.deepEqual(prepareQuestionMove([question],{subjectCode:'D1',bookCode:'D1-02'},book),[
    {id:'q1',subjectCode:'D1',bookCode:'D1-02',catalogCode:'D1-D1-02-01'}
  ]);
  assert.equal(JSON.stringify(question),before);
});
test('所有題目先驗證，章節不相符或多餘層級必須停止',()=>{
  const target={subjectCode:'G1',bookCode:'G1-03'};
  assert.throws(()=>prepareQuestionMove([question,{...question,id:'q2',qnum:'00124',chapterNum:9}],target,book),/00124/);
  assert.throws(()=>prepareQuestionMove([{...question,sectionNum:1}],target,book),/尚未移動/);
  const three={l2:'章',l3:'節',chapters:[{chapterNum:1,sections:[{sectionNum:2,subsections:[{num:3}]}]}]};
  assert.equal(prepareQuestionMove([{...question,sectionNum:2,subsectionNum:3}],{subjectCode:'B1',bookCode:'B1-01'},three)[0].catalogCode,'B1-B1-01-010203');
});
test('重新查詢只移動指定科目冊別與檔名，其他同名檔案不受影響',async()=>{
  const text=readFileSync(new URL('../js/firebase.js',import.meta.url),'utf8');
  const method=text.slice(text.indexOf('  async moveImportedFile('),text.indexOf('  async deleteImportedFiles(')).trim().replace(/,$/,'');
  const rows=[{...question,_srcFile:'test.docx'},{...question,id:'other',bookCode:'G1-02',_srcFile:'test.docx'}];
  const written=[],deltas=[];
  const service={isAdmin:()=>true,getQuestionsFromFirestore:async()=>rows,getCatalogForExport:async()=>[{code:'D1',books:[{...book,code:'D1-02'}]}],_applyStatsDelta:async delta=>deltas.push(delta)};
  runInNewContext('DataService.moveImportedFile=({'+method+'}).moveImportedFile',{DataService:service,prepareQuestionMove,db:{},serverTimestamp:()=>0,doc:(_,c,id)=>id,writeBatch:()=>({update:(id,data)=>written.push({id,...data}),commit:async()=>{}})});
  const callbacks=[];
  const count=await service.moveImportedFile({subjectCode:'G1',bookCode:'G1-01',name:'test.docx'},{subjectCode:'D1',bookCode:'D1-02'},updates=>callbacks.push(...updates));
  assert.equal(count,1);
  assert.equal(written[0].id,'q1');
  assert.equal(written[0].qnum,undefined);
  assert.equal(written[0].text,undefined);
  assert.equal(callbacks.length,1);
  assert.equal(deltas[0].total,0);
  assert.equal(deltas[0].bySubject.G1,-1);
  assert.equal(deltas[0].bySubject.D1,1);
});
