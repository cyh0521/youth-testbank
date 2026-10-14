import {guardPage} from './auth-guard.js';
import {StaticTextbank} from './static-textbank.js';
import {readBooklet,catalogCandidates,applyCatalog,validateQuestions,exportImportFile,formatScopeNumber,CHOICE_HEADERS} from './reverse-import.js';
window._activeNav='import';
const user=await guardPage(['admin','manager']);
if(!user)throw Error('not auth');
const status=document.getElementById('status'), parse=document.getElementById('parse'), files=document.getElementById('files');
const uploadZone=document.getElementById('uploadZone'),fileList=document.getElementById('fileList');
let selectedFiles=[],isParsing=false;
const fileStates=new Map();
let catalog;
let previewUrls=[];
try {catalog=await new StaticTextbank().catalog();status.textContent='已載入網站課本目錄。';}catch(e){status.textContent='目錄載入失敗：'+e.message;}
const el=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
function fillEditor(editor,value) {
  for(const paragraph of value.split('\u2029')) {
    const block=el('div');const lines=paragraph.split('\n');
    lines.forEach((line,i)=>{if(i)block.append(el('br'));block.append(document.createTextNode(line));});
    if(!paragraph)block.append(el('br'));editor.append(block);
  }
}
function readEditor(editor) {
  const inline=n=>n.nodeType===3?n.nodeValue:n.nodeType!==1?'':n.tagName==='BR'?'\n':Array.from(n.childNodes).map(inline).join('');
  return Array.from(editor.childNodes).map(n=>{
    let value=inline(n);
    if(n.nodeType===1&&['DIV','P'].includes(n.tagName)) {
      const breaks=Array.from(n.children).filter(c=>c.tagName==='BR');
      if(breaks.length===1&&!n.textContent)return '';
      if(breaks.length>=2&&n.lastChild?.nodeName==='BR')value=value.slice(0,-1);
    }
    return value;
  }).join('\u2029');
}
function resetPreview() {
  document.getElementById('results').replaceChildren();fileStates.clear();
  previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
  document.getElementById('flowPreview').removeAttribute('aria-current');document.getElementById('flowUpload').setAttribute('aria-current','step');
}
function renderFiles() {
  fileList.replaceChildren();
  selectedFiles.forEach(file=>{
    const row=el('div',null,'file-row'),info=el('div',null,'fr-info'),remove=el('button','×','fr-remove');
    info.append(el('div',file.name,'fr-name'),el('div',`${(file.size/1024/1024).toFixed(2)} MB · ${fileStates.get(file)||'等待解析'}`,'fr-meta'));
    remove.type='button';remove.setAttribute('aria-label','移除 '+file.name);remove.disabled=isParsing;
    remove.onclick=()=>{selectedFiles=selectedFiles.filter(f=>f!==file);resetPreview();renderFiles();};
    row.append(el('span','DOCX','fr-icon'),info,remove);fileList.append(row);
  });
  document.getElementById('fileCount').textContent=selectedFiles.length?`已選取 ${selectedFiles.length} 個檔案`:'尚未選取檔案';
  parse.disabled=isParsing||!catalog||!selectedFiles.length;
}
function selectFiles(incoming,append=false) {
  if(isParsing)return;
  const rejected=[];if(!append)selectedFiles=[];
  for(const file of incoming) {
    if(!/\.docx$/i.test(file.name)){rejected.push(file.name+'：只支援 .docx');continue;}
    if(file.size>20*1024*1024){rejected.push(file.name+'：超過 20 MB');continue;}
    if(!selectedFiles.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))selectedFiles.push(file);
  }
  resetPreview();status.textContent=rejected.length?rejected.join('；'):'已選取檔案，點擊「解析題本」開始。';renderFiles();
}
files.onchange=()=>{selectFiles(files.files);files.value='';};
uploadZone.onclick=()=>{if(!isParsing)files.click();};
uploadZone.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();uploadZone.click();}};
uploadZone.ondragover=e=>{e.preventDefault();if(!isParsing)uploadZone.classList.add('drag-over');};
uploadZone.ondragleave=e=>{if(!uploadZone.contains(e.relatedTarget))uploadZone.classList.remove('drag-over');};
uploadZone.ondrop=e=>{e.preventDefault();uploadZone.classList.remove('drag-over');selectFiles(e.dataTransfer.files,true);};
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
renderFiles();
parse.onclick=async()=>{
  isParsing=true;files.disabled=true;uploadZone.setAttribute('aria-disabled','true');renderFiles();document.getElementById('results').replaceChildren();
  previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
  for(const file of selectedFiles) {
    status.textContent='解析中：'+file.name;
    fileStates.set(file,'解析中…');renderFiles();
    try {if(file.size>20*1024*1024)throw Error('檔案超過 20 MB');const result=await readBooklet(await file.arrayBuffer(),file.name);await render(result);fileStates.set(file,`已解析 ${result.questions.length} 題`);}
    catch(e){fileStates.set(file,'解析失敗');document.getElementById('results').append(el('p',file.name+'：'+e.message,'reverse-warning'));}
    renderFiles();
  }
  status.textContent='解析完成。請確認冊別與各題欄位，再下載。';isParsing=false;files.disabled=false;uploadZone.removeAttribute('aria-disabled');renderFiles();
  document.getElementById('flowUpload').removeAttribute('aria-current');document.getElementById('flowPreview').setAttribute('aria-current','step');
};
async function render(result) {
  const card=el('section',null,'card'), body=el('div',null,'card-body');card.append(body);document.getElementById('results').append(card);
  const counts={};result.questions.forEach(q=>counts[q['題型']]=(counts[q['題型']]||0)+1);
  body.append(el('h2',result.filename),el('p',`${result.questions.length} 題，${result.images.length} 個圖片物件；`+Object.entries(counts).map(([t,n])=>`${QUESTION_TYPES[t]||t} ${n} 題`).join('、')));
  const select=el('select'), label=el('label','科目與冊別');label.append(select);body.append(label);
  select.append(new Option('請確認科目與冊別',''));
  for(const s of catalog)for(const b of s.books)select.append(new Option(`${s.code} ${s.name} ／ ${b.code} ${b.name}`,b.code));
  const candidates=catalogCandidates(result,catalog);
  if(candidates.length===1)select.value=candidates[0].book.code;
  body.append(el('p',candidates.length===1?'已依章節標題比對冊別，仍可調整。':'來源未提供足以唯一判斷冊別的資訊，請選擇正確冊別。'));
  const warnings=el('p',null,'reverse-warning'), actions=el('div',null,'reverse-actions');body.append(warnings,actions);
  const book=()=>catalog.flatMap(s=>s.books).find(b=>b.code===select.value);
  if(book())applyCatalog(result,book());
  const levels=el('p');body.append(levels);
  const buttons=[];
  for(const choice of [true,false]) {
    const count=result.questions.filter(q=>choice?['T2','T3'].includes(q['題型']):!['T2','T3'].includes(q['題型'])).length;
    if(!count)continue;
    const button=el('button',`下載${choice?'選擇題':'其他題型'}入題檔（${count} 題）`,'btn btn-primary');actions.append(button);buttons.push(button);
    button.onclick=async()=>{
      button.disabled=true;
      try {const output=await exportImportFile(result,choice,select.value);const url=URL.createObjectURL(output.blob), a=el('a');a.href=url;a.download=output.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
      catch(e){warnings.textContent=e.message;}finally{validate();}
    };
  }
  function validate(){const selected=book();levels.textContent=selected?`此冊層級：${[selected.l1,selected.l2,selected.l3].filter(Boolean).join(' → ')}。章數／節數／小節填入各層序號，依網站目錄驗證。`:'';const errors=validateQuestions(result,selected);warnings.textContent=[...result.warnings,...errors].join('\n');buttons.forEach(b=>b.disabled=!select.value||errors.length>0);}
  const scopeInputs=[];
  select.onchange=()=>{if(book())applyCatalog(result,book());scopeInputs.forEach(({q,key,input})=>input.value=q[key]||'');validate();};
  const list=el('div',null,'reverse-results');body.append(list);
  const urls=[];
  for(let i=0;i<result.images.length;i++) {
    const image=result.images[i], file=image.files[0];
    urls[i]=file?URL.createObjectURL(new Blob([file.data],{type:/png$/i.test(file.path)?'image/png':/jpe?g$/i.test(file.path)?'image/jpeg':'application/octet-stream'})):'';
    if(urls[i])previewUrls.push(urls[i]);
  }
  for(const q of result.questions) {
    const row=el('details',null,'reverse-question');row.append(el('summary',`編碼 ${q._id} ｜ ${QUESTION_TYPES[q['題型']]||q['題型']} ｜ ${(q['題目']||'').slice(0,55)}`));
    const fields=el('div',null,'reverse-fields');row.append(fields);
    for(const key of CHOICE_HEADERS) {
      if(!['T2','T3'].includes(q['題型']) && /選項|結尾/.test(key))continue;
      const multiline=['題目','結尾','詳答/解析','簡答/答案'].includes(key)||key.startsWith('選項');
      const label=el('label',key),input=el(multiline?'div':'input');
      if(multiline){input.className='reverse-editor';input.contentEditable='true';input.setAttribute('role','textbox');input.setAttribute('aria-multiline','true');input.setAttribute('aria-label',key);fillEditor(input,q[key]||'');}
      else input.value=q[key]||'';
      label.append(input);
      if(multiline)row.append(label);else fields.append(label);
      input.oninput=()=>{q[key]=multiline?readEditor(input):input.value;validate();};
      if(multiline)input.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
      if(['章數','節數','小節'].includes(key))scopeInputs.push({q,key,input});
      if(['章數','節數','小節'].includes(key))input.onblur=()=>{q[key]=formatScopeNumber(input.value);input.value=q[key];validate();};
      for(const marker of (q[key]||'').matchAll(/⟦圖(\d+)⟧/g)) {
        const image=el('img');image.src=urls[+marker[1]];image.alt=`${key} 圖片 ${+marker[1]+1}`;image.className='reverse-picture';label.append(image);
      }
    }
    list.append(row);
  }
  body.append(el('p','Enter 另起段落，Shift+Enter 在同段內換行。⟦圖編號⟧ 表示原檔圖片，可在欄位間移動；下載時會還原為內嵌圖片。章節必須符合所選冊別目錄。'));
  validate();
}
