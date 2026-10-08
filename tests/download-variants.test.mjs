import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
const source = readFileSync(new URL('../js/download-variants.js', import.meta.url),'utf8');
const {buildDownloadVariants,downloadFilename} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('五種試卷內容及空選取驗證，題目卷排首位且不含答案解析', () => {
  const questions=[{id:'q1',type:'T2'}];
  const versions=buildDownloadVariants(questions,['answers','analysis','student','studentAnswers','questions']);
  assert.equal(versions[0].label,'題目卷');
  assert.deepEqual(versions.map(v=>[v.answers,v.analysis,!!v.answerSheet]),[[false,false,false],[true,false,false],[true,true,false],[false,false,true],[true,false,true]]);
  assert.throws(()=>buildDownloadVariants(questions,[]),/至少選擇/);
});

test('A／B 題目相同，題型與章節不混排，隨機結果相同時仍保證改變題序', () => {
  const questions=[{id:'q1',type:'T2',chapterNum:1},{id:'q2',type:'T2',chapterNum:1},{id:'q3',type:'T1',chapterNum:1},{id:'q4',type:'T2',chapterNum:2}];
  const [a,b]=buildDownloadVariants(questions,['student'],true,true,()=>.999);
  assert.deepEqual(a.questions,questions);
  assert.notDeepEqual(b.questions.map(q=>q.id),a.questions.map(q=>q.id));
  assert.deepEqual(b.questions.map(q=>q.id).sort(),questions.map(q=>q.id).sort());
  assert.deepEqual(b.questions.map(q=>[q.type,q.chapterNum]),questions.map(q=>[q.type,q.chapterNum]));
  assert.deepEqual(questions.map(q=>q.id),['q1','q2','q3','q4']);
  assert.throws(()=>buildDownloadVariants([questions[0]],['student'],true),/無法產生/);
});

test('多種類型的 B 卷共用同一份題序，解答可按相同順序輸出', () => {
  const versions=buildDownloadVariants([{id:1,type:'T2'},{id:2,type:'T2'}],['answers','studentAnswers'],true,false,()=>0);
  assert.equal(versions.length,4);
  assert.deepEqual(versions[1].questions,versions[3].questions);
  assert.equal(versions[3].answerSheet,true);
});

test('試卷檔名只保留試卷類型，題本仍使用原檔名', () => {
  assert.equal(downloadFilename('第一次段考','作答卷（B卷）'),'作答卷（B卷）.docx');
  assert.equal(downloadFilename('測試.docx','題目卷附答案'),'題目卷附答案.docx');
  assert.equal(downloadFilename('冊別名稱題本'),'冊別名稱題本.docx');
});

test('附答案的兩種題目卷即使預覽關閉頁數，Word 仍包含各題課本頁碼', async () => {
  const file = readFileSync(new URL('../js/exam-preview.js', import.meta.url),'utf8');
  const render = file.slice(file.indexOf('function renderQPreview('), file.indexOf('export async function exportToWord('));
  const exporter = file.slice(file.indexOf('export async function exportToWord(')).replace('export ', '');
  const questions = [{type:'T2',text:'試題',options:['甲','乙'],answer:'A',analysis:'解析內容',source:'P.39'},{type:'T2',text:'未提供頁碼',source:''}];
  for (const variant of buildDownloadVariants(questions,['answers','analysis'])) {
    const paper = {firstElementChild:{},querySelectorAll:()=>[]};
    const context = {
      window:{},console,Math,UI:{questionHtml:text=>text,choiceQuestionHtml:q=>q.text,toast(){}},
      examAppearance:()=>({font:'system',fontSize:16,lineHeight:1.3}),loadWordMargins:()=>({}),PAPER_SIZES:{A4:{}},fontStackById:()=> 'sans-serif',
      loadDocxLibrary:async()=>({}),createDocxBlob:async()=>({}),
      document:{createElement:tag=>tag==='div'?paper:{getContext:()=>({})}},
      buildPaperHtml:(data,items,display,includeAnswers)=>{
        assert.equal(includeAnswers,false);
        return items.map((q,index)=>context.renderQPreview(q,index+1,q.type,display)).join('');
      },
    };
    runInNewContext(render + exporter,context);
    const handle={name:'測試.docx',createWritable:async()=>({write:async()=>{},close:async()=>{}})};
    assert.equal(await context.exportToWord({title:'測試'},questions,'A4',1,handle,{variant,display:{source:false}}),true);
    assert.match(paper.innerHTML,/<span class="ep-q-source">【P\.39】<\/span>/);
    assert.equal((paper.innerHTML.match(/ep-q-source/g)||[]).length,1);
    assert.equal(paper.innerHTML.includes('解析內容'),variant.analysis);
  }
});

test('下載無儲存位置視窗；題本單檔，其他模式自動下載所有選取類型及 A／B 卷', async () => {
  const file = readFileSync(new URL('../js/exam-preview.js', import.meta.url),'utf8');
  const fn = file.slice(file.indexOf('export async function downloadExam('),file.indexOf('function confirmPrintSettings(')).replace('export ', '');
  for (const booklet of [true,false]) {
    const exports=[];const messages=[];
    const exam={booklet,title:booklet?'冊別題本':'段考'};
    const questions=[{id:1,type:'T2'},{id:2,type:'T2'}];
    const context={window:{showSaveFilePicker:()=>assert.fail('不應開啟另存新檔')},buildDownloadVariants,UI:{toast:(message,level)=>{assert.notEqual(level,'danger');messages.push(message);}},
      choosePaperLayout:async(format,showTypes)=>{assert.equal(showTypes,!booklet);return {paperKey:'A4',columns:1,downloadTypes:['questions','answers','studentAnswers'],ab:true};},
      exportToWord:async(...args)=>{exports.push(args);return true;}};
    runInNewContext(fn,context);await context.downloadExam(exam,questions,'Word');
    if (booklet) {assert.equal(exports.length,1);assert.equal(exports[0].length,4);}
    else {
      assert.equal(exports.length,6);
      assert.deepEqual(exports.map(args=>args[5].variant.label),['題目卷（A卷）','題目卷（B卷）','題目卷附答案（A卷）','題目卷附答案（B卷）','作答卷附答案（A卷）','作答卷附答案（B卷）']);
      exports.forEach(args=>assert.equal(args[4],null));
      assert.match(messages[0],/6 個 Word/);
    }
  }
});
