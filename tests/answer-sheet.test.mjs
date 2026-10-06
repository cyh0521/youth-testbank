import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../js/exam-preview.js',import.meta.url),'utf8');
const context={buildHeaderHtml:h=>`<div class="ep-exam-header">${h.school}｜${h.name}</div>`};
runInNewContext(source.slice(source.indexOf('const TYPE_ORDER'),source.indexOf('// ── 字型'))+
  source.slice(source.indexOf('function groupByType('),source.indexOf('// ═',source.indexOf('function groupByType(')))+
  source.slice(source.indexOf('function buildPaperHtml('),source.indexOf('function buildBookletHtml(')),context);

test('作答卷保留表頭及配分，只含題號答案格；填空格數及問答空間保留',()=>{
  const questions=[...Array.from({length:6},(_,i)=>({type:'T2',text:'選擇題正文'+i,options:['選项正文'],answer:'A',analysis:'解析正文',source:'P.99'})),
    {type:'T4',text:'填空正文',answerCount:3,answer:'甲、乙、丙'},{type:'T6',text:'問答正文',answer:'論述答案'}];
  const exam={header:{school:'測試高中',name:'姓名：'},typeScores:{T2:5,T4:10,T6:20},scoreUnits:{T4:'blank'}};
  const blank=context.buildPaperHtml(exam,questions,{answerSheet:true,answers:false,source:true,analysis:true},false);
  assert.match(blank,/測試高中｜姓名：/);
  assert.match(blank,/共 3 格；每格 10 分，共 30 分/);
  assert.equal((blank.match(/ep-response-grid/g)||[]).length,3);
  assert.equal((blank.match(/ep-response-empty/g)||[]).length,4);
  for(const label of ['1-1','1-2','1-3'])assert(blank.includes(`>${label}</p>`));
  assert.match(blank,/data-row-lines="4"/);
  for(const value of ['正文','P.99','解析','論述答案','【解答】'])assert(!blank.includes(value));
  const filled=context.buildPaperHtml(exam,questions,{answerSheet:true,answers:true},false);
  assert.match(filled,/<span class="ep-answer-value">A<\/span>/);
  for(const answer of ['甲','乙','丙'])assert(filled.includes(`<span class="ep-answer-value">${answer}</span>`));
  assert.match(filled,/論述答案/);assert(!filled.includes('正文'));
  assert.match(context.renderAnswerGrid([{answer:'<答案>'}],'T6',true),/&lt;答案&gt;/);
});

test('是非與選擇每行10題，填空每行3格；題號與答案各有獨立格且補滿格線',()=>{
  const cells=html=>[...html.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(match=>match[1].replace(/<[^>]*>/g,''));
  for(const type of ['T1','T2']) {
    const html=context.renderAnswerGrid(Array.from({length:13},()=>({answer:'A'})),type,true);
    assert.equal((html.match(/<tr>/g)||[]).length,2);
    assert.equal((html.match(/<td/g)||[]).length,40);
    assert.equal((html.match(/<p /g)||[]).length,40);
    assert.equal((html.match(/border:1px solid/g)||[]).length,40);
    assert.equal((html.match(/ep-response-empty/g)||[]).length,7);
    assert.deepEqual(cells(html).slice(0,4),['1','A','2','A']);
    assert.match(html,/data-row-lines="1\.5"/);
  }
  const fill=context.renderAnswerGrid([{answer:'甲'},{answer:'乙'},{answerCount:2,answer:'（1）丙（2）丁'}],'T4',true);
  assert.equal((fill.match(/<td/g)||[]).length,12);
  assert.equal((fill.match(/<p /g)||[]).length,12);
  assert.deepEqual(cells(fill),['1','甲','2','乙','3-1','丙','3-2','丁','','','','']);
  assert.match(context.renderAnswerGrid([{}],'T5',false),/data-row-lines="1\.5"/);
  assert.match(context.renderAnswerGrid([{}],'T6',false),/data-row-lines="4"/);
});

test('各題型題號等寬；一般答案上下置中，是非／選擇左右置中，問答四行高且向上對齊',()=>{
  for(const type of ['T1','T2','T3','T4','T5','T6']) {
    const html=context.renderAnswerGrid([{answer:'甲'}],type,true);
    assert.match(html,/data-number-width="4"/);
    assert.match(html,/<col style="width:4%">/);
    const vertical=type==='T6'?'top':'middle';
    assert.match(html,/ep-response-number" style="[^"]*vertical-align:middle[^"]*text-align:center/);
    const alignment=['T1','T2'].includes(type)?'center':'left';
    assert(html.includes(`data-answer-align="${alignment}"`));
    assert.match(html,new RegExp(`ep-response-answer" style="[^\"]*vertical-align:${vertical}[^\"]*text-align:${alignment}`));
  }
});

test('Word 作答格輸出真正表格並保留格線、題號、答案及雙欄紙張設定',async()=>{
  const exporter=readFileSync(new URL('../js/docx-export.js',import.meta.url),'utf8');
  const word={};runInNewContext(exporter.replace('export async function','async function'),word);
  const text=value=>({nodeType:3,textContent:value});
  const cls=value=>({contains:name=>name===value});
  const number={classList:cls('ep-response-number'),children:[{childNodes:[text('1')]}]};
  const cell={classList:cls('ep-response-answer'),children:[{childNodes:[{nodeType:1,tagName:'SPAN',classList:cls('ep-answer-value'),childNodes:[text('A')]}]}]};
  const empty={classList:cls('ep-response-empty'),children:[{childNodes:[]}]};
  const table={classList:cls('ep-response-grid'),dataset:{columns:'10',numberWidth:'4',answerAlign:'center',rowLines:'1.5'},rows:[{cells:[number,cell,{...empty,classList:cls('ep-response-number')},empty]}]};
  const essay={...table,dataset:{columns:'1',numberWidth:'4',answerAlign:'left',verticalAlign:'top',rowLines:'4'},rows:[{cells:[number,cell]}]};
  const content={querySelectorAll:()=>[],querySelector:selector=>selector==='.ep-question-columns'?{children:[table,essay]}:null};
  const entry=class {constructor(options){this.options=options;}};
  const docx={TextRun:entry,Paragraph:entry,Table:entry,TableRow:entry,TableCell:entry,Document:entry,
    VerticalAlign:{CENTER:'center',TOP:'top'},AlignmentType:{CENTER:'center',LEFT:'left'},LineRuleType:{EXACT:'exact'},BorderStyle:{SINGLE:'single',NONE:'none'},WidthType:{PERCENTAGE:'pct'},HeightRule:{ATLEAST:'atLeast'},TableLayoutType:{FIXED:'fixed'},SectionType:{CONTINUOUS:'continuous'},Packer:{toBlob:async d=>d}};
  const document=await word.createDocxBlob({docx,content,title:'測試',appearance:{font:'system',fontSize:16,lineHeight:1.3},margins:{top:10,right:11,bottom:12,left:13},paperSize:{width:297,height:420},columns:2});
  const section=document.options.sections[0];
  assert.equal(section.properties.column.count,2);assert.equal(section.properties.page.size.width,16838);
  assert.equal(section.children[0].options.columnWidths.length,20);
  assert.deepEqual(Array.from(section.children[0].options.columnWidths.slice(0,2)),[298,447]);
  const row=section.children[0].options.rows[0].options;
  assert.equal(row.height.value,528);assert.equal(row.cantSplit,true);
  const result=row.children[0].options;
  assert.equal(result.width.size,4);assert.equal(result.borders.bottom.style,'single');
  assert.equal(result.children.length,1);
  assert.equal(result.children[0].options.children[0].options.text,'1');
  assert.equal(result.children[0].options.alignment,'center');
  assert.equal(result.verticalAlign,'center');
  const answer=row.children[1].options;
  assert.equal(answer.width.size,6);
  assert.equal(answer.children[0].options.children[0].options.text,'A');
  assert.equal(answer.children[0].options.children[0].options.color,'B4232C');
  assert.equal(answer.verticalAlign,'center');
  assert.equal(answer.children[0].options.alignment,'center');
  assert.equal(row.children[1].options.borders.bottom.style,'single');
  assert.equal(section.children[1].options.rows[0].options.height.value,1308);
  assert.equal(section.children[1].options.columnWidths[0],section.children[0].options.columnWidths[0]);
  assert.equal(section.children[1].options.rows[0].options.children[0].options.children[0].options.alignment,'center');
  assert.equal(section.children[1].options.rows[0].options.children[1].options.children[0].options.alignment,'left');
  assert.equal(section.children[1].options.rows[0].options.children[0].options.verticalAlign,'center');
  assert.equal(section.children[1].options.rows[0].options.children[1].options.verticalAlign,'top');
});
