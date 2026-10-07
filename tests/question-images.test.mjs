import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const core = readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
const context = {window:{}, document:{addEventListener(){}}};
runInNewContext(core + '\nwindow.testUI = UI;', context);
const UI = context.window.testUI;
globalThis.UI = UI;
const editorSource = readFileSync(new URL('../js/question-image-editor.js', import.meta.url), 'utf8');
const {editorHtml, editorText, imageArchive, QuestionImageEditor} = await import('data:text/javascript;base64,' + Buffer.from(editorSource).toString('base64'));

test('圖片只接受網站圖片資料夾的相對路徑，阻擋外部網址與路徑跳脫', () => {
  assert.equal(UI.imagePath('./images/book-1/image_2.JPG'), 'images/book-1/image_2.JPG');
  for (const path of ['https://example.com/x.png','//example.com/x.png','data:image/png;base64,abc','images/../x.png','/images/x.png','images/x.svg','images/x.png" onerror="alert(1)']) {
    assert.equal(UI.imagePath(path), '');
    assert.throws(() => UI.imageMarker(path));
  }
});

test('舊題目圖片路徑改讀 images，重新儲存與壓縮檔也使用新路徑', async () => {
  const oldPath = 'question-images/book-1/map.png';
  assert.equal(UI.imagePath('./' + oldPath), 'images/book-1/map.png');
  const oldMarker = `[[圖片:${oldPath}|240|圖一]]`;
  const html = editorHtml(oldMarker);
  assert.match(html, /src="images\/book-1\/map.png"/);
  assert(!html.includes('question-images/'));
  assert.match(UI.imageMarker(oldPath), /^\[\[圖片:images\//);
  assert.match(editorText({childNodes:[image(oldPath)]}), /^\[\[圖片:images\//);
  const zip = Buffer.from(await (await imageArchive([[oldPath, new Blob(['image'])]])).arrayBuffer());
  const nameLength = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30,30+nameLength).toString(), 'images/book-1/map.png');
  assert.equal(UI.imagePath('question-images/../x.png'), '');
  assert.equal(UI.imagePath('/question-images/x.png'), '');
});

test('側邊欄與首頁 Logo 都引用 images 中的現有檔案', () => {
  const shell = readFileSync(new URL('../js/shell.js', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(shell.includes('src="images/youth.png"'));
  assert.equal((home.match(/src="images\/youth.png"/g) || []).length, 2);
  assert(!shell.includes('src="img/'));
  assert(!home.includes('src="img/'));
  const logo = readFileSync(new URL('../images/youth.png', import.meta.url));
  assert.equal(logo.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
});

test('題目文字保留跳脫與換段，圖片在原文字位置顯示且限制寬度', () => {
  const token = UI.imageMarker('images/map.png', 240, '地圖 <甲> "乙"');
  const html = UI.questionHtml(`前文<測試>\n${token}\u2029後文`);
  assert(html.indexOf('前文&lt;測試&gt;<br>') < html.indexOf('<img'));
  assert(html.indexOf('<img') < html.indexOf('question-paragraph-break'));
  assert(html.endsWith('後文'));
  assert.match(html, /width="240"/);
  assert.match(html, /alt="地圖 &lt;甲&gt; &quot;乙&quot;"/);
  assert.match(html, /display:block;max-width:100%;height:auto/);
  assert.equal(UI.questionSummary(`前${token}後`), '前［地圖 <甲> "乙"］後');
  assert.equal(UI.questionHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert(!UI.questionHtml('[[圖片:https://evil/x.png|320|test]]').includes('<img'));
  const matching = UI.matchingQuestionHtml(UI.imageMarker('images/A.png') + UI.imageMarker('images/B.png'));
  assert.equal((matching.match(/<img/g)||[]).length,2);
});

test('僅在目前頁面使用本地預覽網址，保存內容保持相對路徑', () => {
  context.window.questionImagePreviews = new Map([['images/map.png','blob:local-test']]);
  const token = UI.imageMarker('images/map.png');
  assert.match(UI.questionHtml(token), /src="blob:local-test"/);
  assert(token.includes('images/map.png'));
  assert(!token.includes('blob:'));
  context.window.questionImagePreviews.clear();
});

const text = value => ({nodeType:3,nodeValue:value});
const br = () => ({nodeType:1,tagName:'BR',nodeName:'BR',childNodes:[]});
const image = (path, width=320, alt='圖片') => ({nodeType:1,tagName:'IMG',nodeName:'IMG',dataset:{questionImage:path},alt,getAttribute:()=>String(width)});
const block = children => ({nodeType:1,tagName:'DIV',childNodes:children,lastChild:children.at(-1),textContent:children.filter(n=>n.nodeType===3).map(n=>n.nodeValue).join(''),querySelector:()=>children.find(n=>n.tagName==='IMG')});

test('編輯後儲存保留圖片位置、大小、說明與換段，不遺失單獨圖片段落', () => {
  const editor = {childNodes:[block([text('前文'),image('images/a.png',270,'圖一'),br(),text('後文')]),block([image('images/b.jpg'),br()])]};
  const result = editorText(editor);
  assert.equal(result, `前文${UI.imageMarker('images/a.png',270,'圖一')}\n後文\u2029${UI.imageMarker('images/b.jpg',320,'圖片')}`);
  assert.match(editorHtml(result), /width="270"/);
  assert.equal((editorHtml(result).match(/<img/g)||[]).length,2);
  assert.equal(editorText({childNodes:[block([text('文字'),br(),br()]),block([text('下一段')])]}), '文字\n\u2029下一段');
  assert.equal(editorText({childNodes:[image('https://evil/a.png')]}), '');
});

test('壓縮檔包含部署所需的完整相對路徑、正確 CRC 與中央目錄', async () => {
  const data = new Blob(['123456789']);
  const blob = await imageArchive([['images/a.png', data],['images/b.jpg',new Blob(['second'])]]);
  const zip = Buffer.from(await blob.arrayBuffer());
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.readUInt32LE(14),0xcbf43926);
  assert.equal(zip.readUInt16LE(8),0);
  const nameLength = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30,30+nameLength).toString(),'images/a.png');
  assert.equal(zip.subarray(30+nameLength,30+nameLength+9).toString(),'123456789');
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end),0x06054b50);
  assert.equal(zip.readUInt16LE(end+10),2);
  const central = zip.readUInt32LE(end+16);
  assert.equal(zip.readUInt32LE(central),0x02014b50);
  assert.equal(zip.readUInt32LE(central+16),0xcbf43926);
  assert.equal(zip.readUInt32LE(central+42),0);
  assert.equal(central + zip.readUInt32LE(end+12),end);
  await assert.rejects(imageArchive([['../evil.png',data]]));
});

test('移除的圖片不加入壓縮檔；同圖重複使用僅下載一次', () => {
  const pending = new Map([['images/used.png',new Blob(['used'])],['images/removed.png',new Blob(['removed'])]]);
  const entries = QuestionImageEditor.prototype.entries.call({pending, editor:{querySelectorAll:()=>[image('images/used.png'),image('images/used.png')]}});
  assert.equal(entries.length,1);
  assert.equal(entries[0][0],'images/used.png');
});

test('Word 圖片保持原始比例並以顯示寬度輸出，未發布的圖片報錯避免遺漏', async () => {
  const exporter = readFileSync(new URL('../js/docx-export.js', import.meta.url),'utf8');
  const word = {fetch:async()=>({ok:true,headers:{get:()=> 'image/png'},blob:async()=>new Blob(['image'])}),createImageBitmap:async()=>({width:800,height:400,close(){}})};
  runInNewContext(exporter.slice(0,exporter.indexOf('export async function createDocxBlob(')),word);
  const docx = {ImageRun:class{constructor(options){this.options=options;}},TextRun:class{constructor(options){this.options=options;}}};
  const node = {...image('images/map.png',300),src:'https://example.test/images/map.png',naturalWidth:0,naturalHeight:0};
  const [run] = await word.nodeRuns(node,docx,{});
  assert.equal(run.options.transformation.width,300);
  assert.equal(run.options.transformation.height,150);
  const [narrow] = await word.nodeRuns(node,docx,{},200);
  assert.equal(narrow.options.transformation.width,200);
  assert.equal(narrow.options.transformation.height,100);
  word.fetch = async()=>({ok:false});
  await assert.rejects(word.nodeRuns(node,docx,{}), /圖片已上傳至 GitHub/);
});

test('Word 有圖片的段落使用最小行高，文字段落仍維持原本固定行高', async () => {
  const exporter = readFileSync(new URL('../js/docx-export.js', import.meta.url),'utf8');
  const word = {fetch:async()=>({ok:true,headers:{get:()=> 'image/png'},blob:async()=>new Blob(['image'])})};
  runInNewContext(exporter.replace('export async function','async function'),word);
  const entry=class{constructor(options){this.options=options;}};
  const docx={TextRun:entry,ImageRun:class extends entry{},Paragraph:entry,Document:entry,LineRuleType:{EXACT:'exact',AT_LEAST:'atLeast'},AlignmentType:{LEFT:'left'},TabStopType:{LEFT:'left'},Packer:{toBlob:async doc=>doc}};
  const picture={...image('images/a.png'),naturalWidth:600,naturalHeight:300,src:'https://example.test/a.png'};
  const plain={classList:{contains:name=>name==='ep-word-question'},style:{marginLeft:'50px'},dataset:{},childNodes:[{nodeType:3,textContent:'純文字'}]};
  const illustrated={...plain,childNodes:[{nodeType:3,textContent:'圖片上方文字'},picture,{nodeType:3,textContent:'圖片下方文字'}]};
  const content={querySelectorAll:()=>[],querySelector:selector=>selector==='.ep-question-columns'?{children:[plain,illustrated]}:null};
  const result=await word.createDocxBlob({docx,content,title:'測試',appearance:{font:'system',fontSize:16,lineHeight:1.3},margins:{top:10,right:10,bottom:10,left:10},paperSize:{width:210,height:297},columns:1});
  const [text,before,imageParagraph,after]=result.options.sections[0].children;
  assert.equal(result.options.sections[0].children.length,4);
  assert.equal(before.options.children[0].options.text,'圖片上方文字');
  assert.equal(after.options.children[0].options.text,'圖片下方文字');
  assert.equal(imageParagraph.options.children.length,1);
  assert(imageParagraph.options.children[0] instanceof docx.ImageRun);
  assert.equal(text.options.spacing.lineRule,'exact');
  assert.equal(imageParagraph.options.spacing.lineRule,'atLeast');
  assert.equal(text.options.spacing.line,imageParagraph.options.spacing.line);
});

test('各題型與題本預覽都透過共用圖片渲染，題目存檔不使用 Firebase Storage', () => {
  const preview = readFileSync(new URL('../js/exam-preview.js', import.meta.url),'utf8');
  const render = preview.slice(preview.indexOf('function renderQPreview('),preview.indexOf('// ═',preview.indexOf('function renderQPreview(')));
  const view = {UI}; runInNewContext(render,view);
  for (const type of ['T1','T2','T3','T4','T5','T6']) {
    const html = view.renderQPreview({text:UI.imageMarker('images/map.png'),answer:'A'},1,type,{});
    assert.match(html, /data-question-image="images\/map.png"/);
  }
  const page = readFileSync(new URL('../questions.html',import.meta.url),'utf8');
  const save = page.slice(page.indexOf('window.saveEdit ='),page.indexOf('window.closeQModal ='));
  assert(save.indexOf('await DataService.updateQuestion') < save.indexOf('downloadArchive(archive'));
  assert(!save.includes('uploadImage'));
});
