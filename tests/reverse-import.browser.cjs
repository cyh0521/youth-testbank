const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const deps='C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(deps+'/playwright');
const JSZip=require(deps+'/jszip');
const http=require('http');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'application/octet-stream');if(req.url==='/js/auth-guard.js')res.end('export async function guardPage(){document.querySelector(".main").inert=false;return {role:"admin"};}');else res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/reverse-import.html`);
 await page.evaluate(()=>{document.documentElement.classList.add('auth-ready');document.querySelector('.main').inert=false;});
 await page.addScriptTag({path:path.join(root,'vendor/jszip.min.js')});
 if(process.argv.includes('--assets-only')) {
  const sources=[['choice.docx',true],['other.docx',false]];
  for(const [name,choice] of sources) {
   const bytes=Array.from(fs.readFileSync(path.join(root,'assets/reverse-import',name)));
   const result=await page.evaluate(async({name,choice,bytes})=>{
    const m=await import('/js/reverse-import.js'),original=await m.readBooklet(new Uint8Array(bytes),name);
    if(choice) {
     const q=m.formatQuestion({_id:'image-options',題型:'T2',章數:'1',題目:'請依附圖選出正確答案。',結尾:'⟦圖0⟧','簡答/答案':'Ｃ'});
     const fixture={filename:'附圖選項.docx',questions:[q],images:original.images};
     const book={chapters:[{chapterNum:1}]};
     if(m.validateQuestions(fixture,book).length)throw Error('附圖提供全部選項時應允許選項欄留空');
     const output=await m.exportImportFile(fixture,true,'TEST');
     const again=await m.readBooklet(await output.blob.arrayBuffer());
     if(again.images.length!==1||!again.questions[0]['結尾'].includes('⟦圖0⟧')||again.questions[0]['選項1'])throw Error('附圖選項匯出後遺失圖片或產生多餘文字選項');
     if(!m.validateQuestions({...fixture,images:[]},book).length)throw Error('沒有附圖時仍應阻擋空白選項');
     if(!m.validateQuestions({...fixture,questions:[{...q,選項1:'只有一個文字選項'}]},book).length)throw Error('部分選項缺漏仍應阻擋');
     if(!m.validateQuestions({...fixture,questions:[{...q,結尾:'', '詳答/解析':'⟦圖0⟧'}]},book).length)throw Error('解析圖片不能替代題目選項');
     if(m.validateQuestions({...fixture,questions:[{...q,題型:'T3','簡答/答案':'ＡＣ'}]},book).length)throw Error('複選題應支援附圖選項');
    }
    const reminders=m.imageQuestionReminders(original),output=await m.exportImportFile(original,choice,'TEST');
    const again=await m.readBooklet(await output.blob.arrayBuffer(),output.name);
    return {name,count:original.questions.length,images:original.images.length,reminders:reminders.length,listedImages:reminders.reduce((sum,item)=>sum+item.count,0),exportedCount:again.questions.length,exportedImages:again.images.length,outputName:output.name};
   },{name,choice,bytes});
   assert(result.count>0);assert(result.images>0);assert(result.reminders>0);assert.equal(result.listedImages,result.images);
   assert.equal(result.exportedCount,result.count);assert.equal(result.exportedImages,result.images);
   assert.equal(result.outputName,`TEST-${name.replace(/\.docx$/,'')}${choice?'單選':'其他'}.docx`);
   console.log(JSON.stringify(result));
  }
  await page.locator('#files').setInputFiles(sources.map(([name])=>path.join(root,'assets/reverse-import',name)));
  await page.locator('#parse').click();await page.locator('.reverse-result-card').nth(1).waitFor();
  assert.equal(await page.locator('.reverse-result-card').count(),2);
  for(const [index] of sources.entries()){
   const card=page.locator('.reverse-result-card').nth(index);
   assert(await card.locator('.reverse-image-reminders').isVisible());
   assert(await card.locator('.reverse-image-link').count()>0);
   await card.locator('.reverse-image-link').first().click();
   assert(await card.locator('.reverse-question[open]').count()>0);
  }
  const previousBox=await page.locator('#continueImport').boundingBox();
  const newFileBox=await page.locator('#backHome').boundingBox();
  assert(previousBox&&newFileBox&&newFileBox.x>previousBox.x+previousBox.width);
  assert(Math.abs(newFileBox.y-previousBox.y)<2);
  assert.equal(await page.locator('#continueImport svg').count(),1);
  assert.equal(await page.locator('#backHome svg').count(),1);
  await page.locator('#continueImport').click();
  assert(await page.locator('#uploadPanel').isVisible());
  assert.equal(await page.locator('.file-row').count(),0);
  assert.equal(await page.locator('.reverse-result-card').count(),0);
  assert(await page.locator('#parse').isDisabled());
  console.log('Both asset examples parsed, exported, and showed clickable image-question reminders in the page');
  return;
 }
 if(process.argv.includes('--scope-only')) {
  const values=await page.evaluate(async()=>{
   const m=await import('/js/reverse-import.js');
   const q=m.formatQuestion({_id:'1',題型:'T1',章數:'7',節數:'２',小節:'0',題目:'測試', '簡答/答案':'○'});
   const out=await m.exportImportFile({filename:'題本.docx',questions:[q],images:[]},false,'TEST');
   const choice=await m.exportImportFile({filename:'題本.docx',questions:[m.formatQuestion({_id:'2',題型:'T2',章數:'7',題目:'測試選擇',選項1:'甲',選項2:'乙','簡答/答案':'Ａ'})],images:[]},true,'TEST');
   return {q,roundtrip:(await m.readBooklet(await out.blob.arrayBuffer())).questions[0],blank:m.formatScopeNumber(''),names:[choice.name,out.name]};
  });
  for(const q of [values.q,values.roundtrip]){assert.equal(q['章數'],'07');assert.equal(q['節數'],'02');assert.equal(q['小節'],'00');}
  assert.equal(values.blank,'');
  assert.deepEqual(values.names,['TEST-題本單選.docx','TEST-題本其他.docx']);
  const imageFixture=Buffer.from(await page.evaluate(async()=>{
    const z=new JSZip(),W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const cells=['題型','章數','簡答/答案','題目'].map(t=>`<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`).join('');
    z.file('word/document.xml',`<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:tbl><w:tr>${cells}</w:tr><w:tr><w:tc><w:p><w:r><w:t>T1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>○</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>有圖的題目</w:t><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`);
    z.file('word/_rels/document.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/image" Target="media/image1.png"/></Relationships>`);
    z.file('word/media/image1.png',Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0)));
    return Array.from(await z.generateAsync({type:'uint8array'}));
  }));
  await page.locator('#files').setInputFiles({name:'含圖測試.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:imageFixture});
  await page.locator('#parse').click();await page.locator('.reverse-image-reminders').waitFor({state:'visible'});
  assert.match(await page.locator('.reverse-image-reminders').innerText(),/含圖片題目提醒：1 題，共 1 張圖片/);
  assert.match(await page.locator('.reverse-image-link').innerText(),/編碼 1（是非題）：題目 1 張/);
  await page.locator('.reverse-image-link').click();assert(await page.locator('.reverse-question').isVisible());
  await page.locator('.reverse-question [contenteditable=true]').nth(1).fill('圖片已移除');
  assert(await page.locator('.reverse-image-reminders').isHidden());
  console.log('Image-question reminder lists file section, question number and field; selecting it opens the question and editing updates the reminder');
  if(!fs.existsSync('D:/source1.docx')){console.log('Both export filenames passed; external DOCX fixtures are unavailable');return;}
  await page.locator('#files').setInputFiles('D:/source1.docx');await page.locator('#parse').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('解析完成'));
  await page.locator('.reverse-question').first().locator('summary').click();
  const chapter=page.locator('.reverse-question').first().locator('.reverse-fields input').nth(1);
  assert.equal(await chapter.inputValue(),'07');await chapter.fill('7');await chapter.blur();assert.equal(await chapter.inputValue(),'07');
  console.log('Two-digit chapter, section and subsection values passed for parsing, catalog matching, editing and DOCX output; empty values preserved');
  return;
 }
 for(const name of ['source1','source2','其他題型','題型單選']) {
  const bytes=Array.from(fs.readFileSync('D:/'+name+'.docx'));
  const result=await page.evaluate(async({bytes,name})=>{
   const m=await import('/js/reverse-import.js'); const r=await m.readBooklet(new Uint8Array(bytes),name+'.docx');
   const manifest=await (await fetch('/data/testbank/manifest.json')).json();const catalog=await(await fetch('/data/testbank/'+manifest.catalog)).json();
   const candidates=m.catalogCandidates(r,catalog);
   const exports=[];
   for(const choice of [true,false])if(r.questions.some(q=>choice?['T2','T3'].includes(q['題型']):!['T2','T3'].includes(q['題型']))) {
    const output=await m.exportImportFile(r,choice,'TEST');const bytes=new Uint8Array(await output.blob.arrayBuffer());
    const reread=await m.readBooklet(bytes,output.name);
    const zip=await JSZip.loadAsync(bytes),doc=new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'),'application/xml');
    const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    if(choice) {
      const header=doc.getElementsByTagNameNS(W,'tr')[0].getElementsByTagNameNS(W,'tc')[15];
      if(header.textContent!=='結尾')throw Error('欄位名稱應為結尾');
    }
    for(const drawing of Array.from(doc.getElementsByTagNameNS(W,'drawing')).concat(Array.from(doc.getElementsByTagNameNS(W,'pict')))) {
      const run=drawing.parentNode,previous=run.previousElementSibling;
      if(!previous||!previous.getElementsByTagNameNS(W,'br').length)throw Error('圖片前必須使用同段內 Shift+Enter 斷行');
    }
    for(const run of doc.getElementsByTagNameNS(W,'r')) {
      const text=Array.from(run.getElementsByTagNameNS(W,'t')).map(n=>n.textContent).join('');
      const font=run.getElementsByTagNameNS(W,'rFonts')[0];
      if(!font)throw Error('文字或圖片 run 缺少字型');
      const expected=/^_{3,}$/.test(text)?'Times New Roman':'新細明體';
      if(font.getAttributeNS(W,'ascii')!==expected||font.getAttributeNS(W,'eastAsia')!==expected)throw Error('字型不符合規則：'+text);
    }
    const original=r.questions.filter(q=>choice?['T2','T3'].includes(q['題型']):!['T2','T3'].includes(q['題型']));
    const dimension=image=>{const d=new DOMParser().parseFromString(image.drawing,'application/xml');return Array.from(d.getElementsByTagName('*')).filter(n=>n.localName==='extent'||n.localName==='ext'&&n.hasAttribute('cx')).map(n=>[n.getAttribute('cx'),n.getAttribute('cy')]);};
    const originalImages=original.flatMap(q=>(choice?m.CHOICE_HEADERS:m.OTHER_HEADERS).flatMap(key=>Array.from((q[key]||'').matchAll(/⟦圖(\d+)⟧/g),match=>r.images[+match[1]])));
    if(JSON.stringify(originalImages.map(dimension))!==JSON.stringify(reread.images.map(dimension)))throw Error('輸出改變原圖尺寸');
    const normalize=v=>String(v||'').replace(/⟦圖\d+⟧/g,'⟦圖⟧').trim();
    for(let i=0;i<original.length;i++)for(const key of choice?m.CHOICE_HEADERS:m.OTHER_HEADERS)if(normalize(original[i][key])!==normalize(reread.questions[i][key]))throw Error(`輸出欄位不一致 ${name} ${i} ${key}`);
    exports.push({choice,count:reread.questions.length,images:reread.images.length,bytes:Array.from(bytes),questions:reread.questions});
   }
   return {count:r.questions.length,images:r.images.length,questions:r.questions,warnings:r.warnings,candidates:candidates.map(c=>c.book.code),exports};
  },{bytes,name});
  console.log(name,JSON.stringify({count:result.count,images:result.images,warnings:result.warnings,candidates:result.candidates,exports:result.exports.map(e=>({choice:e.choice,count:e.count,images:e.images}))}));
  assert(result.count>0);assert.equal(result.exports.reduce((n,e)=>n+e.count,0),result.count);
  assert.equal(result.exports.reduce((n,e)=>n+e.images,0),result.images);
  if(name==='source1'){assert.equal(result.count,35);assert.equal(result.questions.filter(q=>q['題型']==='T2').length,21);assert.equal(result.questions[14]['簡答/答案'],'Ｂ');assert.equal(result.questions[14]['選項4'],'少女後方的干欄式建築，應該是榖倉');assert.match(result.questions[14]['結尾'],/⟦圖/);}
  if(name==='source2'){assert.equal(result.questions[0]['章數'],'03');assert.equal(result.questions[0]['節數'],'01');assert(result.questions.some(q=>q['題型']==='T5'));}
  if(name==='題型單選'||name==='其他題型') {
   const source=await JSZip.loadAsync(fs.readFileSync('D:/'+name+'.docx'));
   const original=new Map(Object.keys(source.files).filter(p=>p.startsWith('word/media/')).map(p=>[p,null]));
   const hashes=[];for(const p of original.keys())hashes.push(require('crypto').createHash('sha256').update(await source.file(p).async('nodebuffer')).digest('hex'));
   for(const output of result.exports){const zip=await JSZip.loadAsync(Buffer.from(output.bytes));for(const p of Object.keys(zip.files).filter(p=>p.startsWith('word/media/')&&!zip.files[p].dir))assert(hashes.includes(require('crypto').createHash('sha256').update(await zip.file(p).async('nodebuffer')).digest('hex')));}
  }
 }
 await page.locator('#files').setInputFiles('D:/source1.docx');await page.locator('#parse').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('解析完成'));
 assert.equal(await page.locator('#results select').inputValue(),'G1-01');assert.equal(await page.locator('.reverse-question').count(),35);
 assert.equal(await page.locator('#results button:enabled').count(),2);
 await page.locator('.reverse-question').nth(14).locator('summary').click();assert.equal(await page.locator('.reverse-question').nth(14).locator('img').count(),1);
 await page.locator('#files').setInputFiles('D:/source2.docx');await page.locator('#parse').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('解析完成'));
 assert.equal(await page.locator('.reverse-question').count(),106);assert.equal(await page.locator('#results button:enabled').count(),0);
 await page.locator('#results select').selectOption('B1-01');assert.equal(await page.locator('#results button:enabled').count(),1);
 console.log('UI upload, automatic catalog selection, ambiguous book blocking and B1 three-level validation passed');
 const rules=await page.evaluate(async()=>{
  const m=await import('/js/reverse-import.js');
  return [m.formatQuestion({題型:'T2',題目:'Ａ１⟦圖0⟧',簡答:'/Ａb２', '簡答/答案':'Ａb２',結尾:'尾句', '詳答/解析':'解析⟦圖1⟧'}),m.formatQuestion({題型:'T4',題目:'Ａ１___','簡答/答案':'Ｂ２'})];
 });
 assert.equal(rules[0]['簡答/答案'],'Ａｂ２');assert.equal(rules[0]['題目'],'A1');assert.equal(rules[0]['結尾'],'尾句\n⟦圖0⟧\n⟦圖1⟧');assert.equal(rules[1]['簡答/答案'],'B2');
 const scope=await page.evaluate(async()=>{const m=await import('/js/reverse-import.js');return m.formatQuestion({題型:'T1',章數:'7',節數:'２',小節:'0'});});
 assert.equal(scope['章數'],'07');assert.equal(scope['節數'],'02');assert.equal(scope['小節'],'00');
 const breaks=await page.evaluate(async()=>{
  const m=await import('/js/reverse-import.js'),zip=new JSZip();
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  const cell=text=>'<w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>';
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>'+['題型','章數','簡答/答案','題目','詳答/解析'].map(cell).join('')+'</w:tr><w:tr>'+['T4','1','答案'].map(cell).join('')+'<w:tc><w:p><w:r><w:t>第一行___</w:t><w:br/><w:t>同一段第二行</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>下一段</w:t><w:br/><w:br/><w:t>兩次段內換行</w:t></w:r></w:p></w:tc>'+cell('解析')+'</w:tr></w:tbl></w:body></w:document>');
  const source=await m.readBooklet(await zip.generateAsync({type:'uint8array'}));
  const out=await m.exportImportFile(source,false,'TEST'),archive=await JSZip.loadAsync(await out.blob.arrayBuffer());
  const d=new DOMParser().parseFromString(await archive.file('word/document.xml').async('string'),'application/xml');
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',rows=d.getElementsByTagNameNS(W,'tr'),tc=rows[1].getElementsByTagNameNS(W,'tc')[9];
  const reread=await m.readBooklet(await out.blob.arrayBuffer());
  return {source:source.questions[0]['題目'],output:reread.questions[0]['題目'],paragraphs:tc.getElementsByTagNameNS(W,'p').length,soft:tc.getElementsByTagNameNS(W,'br').length};
 });
 assert.equal(breaks.source,'第一行___\n同一段第二行\u2029\u2029下一段\n\n兩次段內換行');assert.equal(breaks.output,breaks.source);assert.equal(breaks.paragraphs,3);assert.equal(breaks.soft,3);
 // 驗證預覽編輯器的實際按鍵，避免編輯時把兩種斷行混在一起。
 await page.locator('.reverse-question').first().locator('summary').click();
 const editor=page.locator('.reverse-question').first().locator('[contenteditable=true]').nth(1);
 await editor.click();await page.keyboard.press('Control+a');await page.keyboard.insertText('甲');await page.keyboard.press('Shift+Enter');await page.keyboard.insertText('乙');await page.keyboard.press('Enter');await page.keyboard.insertText('丙');
 const download=page.waitForEvent('download');await page.locator('#results button:enabled').first().click();const artifact=await download;
 const downloaded=Array.from(fs.readFileSync(await artifact.path()));
 const edited=await page.evaluate(async bytes=>(await (await import('/js/reverse-import.js')).readBooklet(new Uint8Array(bytes))).questions[0]['題目'],downloaded);
 assert.equal(edited,'甲\n乙\u2029丙');console.log('Enter paragraphs, Shift+Enter breaks, blank paragraphs and keyboard editing preserved');
 await page.locator('.fr-remove').click();assert.equal(await page.locator('.file-row').count(),0);assert(await page.locator('#parse').isDisabled());
 const dropped=fs.readFileSync('D:/source1.docx');
 await page.evaluate(bytes=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],'拖曳測試.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));document.getElementById('uploadZone').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},Array.from(dropped));
 assert.equal(await page.locator('.fr-name').textContent(),'拖曳測試.docx');assert.equal(await page.locator('.file-row').count(),1);assert(await page.locator('#parse').isEnabled());
 console.log('Font rules, image dimensions, answer widths, drag/drop and file removal passed');
 await page.evaluate(()=>{document.querySelectorAll('*').forEach(n=>{if(n.scrollTop)n.scrollTop=0;});scrollTo(0,0);});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(root,'tests/reverse-import-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'tests/reverse-import-mobile.png'),fullPage:true});
 const importHtml=fs.readFileSync(path.join(root,'import.html'),'utf8');
 const parser=importHtml.slice(importHtml.indexOf('function parseTablesFromHtml(html)'),importHtml.indexOf('// ── 預覽（含分頁）'));
 const marker=await page.evaluate(source=>{
  const imageSources=new Map([['blob:test','images/import-test.png']]);
  const parse=new Function('importedImageSources',source+';return parseTablesFromHtml;')(imageSources);
  return parse('<table><tr><th>題目</th></tr><tr><td><p>有圖的題目<img src="blob:test"></p></td></tr></table>')[0][1][0];
 },parser);
 assert.match(marker,/\[\[圖片:images\/import-test.png\|320\|/);console.log('Existing importer preserves embedded-image markers');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
