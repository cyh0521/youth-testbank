import {guardPage} from './auth-guard.js';
import {StaticTextbank} from './static-textbank.js';
import {readBooklet,catalogCandidates,applyCatalog,validateQuestions,exportImportFile,formatScopeNumber,imageQuestionReminders,CHOICE_HEADERS} from './reverse-import.js';
window._activeNav='reverse-import';
const user=await guardPage(['admin','manager']);
if(!user)throw Error('not auth');
const status=document.getElementById('status'), parse=document.getElementById('parse'), files=document.getElementById('files');
const uploadZone=document.getElementById('uploadZone'),fileList=document.getElementById('fileList');
let selectedFiles=[],isParsing=false;
const fileStates=new Map();
let catalog;
let previewUrls=[];
try {catalog=await new StaticTextbank().catalog();UI.toast('已載入網站課本目錄','success');}catch(e){status.textContent='目錄載入失敗：'+e.message;}
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
function showStep(step) {
  document.getElementById('uploadPanel').hidden=step!==1;
  document.getElementById('previewPanel').hidden=step!==2;
  ['flowUpload','flowPreview'].forEach((id,index)=>{
    const indicator=document.getElementById(id);
    indicator.classList.toggle('active',index+1===step);
    indicator.classList.toggle('done',index+1<step);
    if(index+1===step)indicator.setAttribute('aria-current','step');else indicator.removeAttribute('aria-current');
  });
}
document.getElementById('backToUpload').onclick=()=>showStep(1);
function resetPreview() {
  document.getElementById('results').replaceChildren();fileStates.clear();
  previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
  showStep(1);
}
function renderFiles() {
  fileList.replaceChildren();
  selectedFiles.forEach(file=>{
    const state=fileStates.get(file)||'待解析';
    const stateClass=state==='解析失敗'?'error':state==='解析中…'?'parsing':state.startsWith('已解析')?'done':'pending';
    const row=el('div',null,'file-row '+stateClass),info=el('div',null,'fr-info'),remove=el('button',null,'fr-remove'),icon=el('span',null,'fr-icon');
    info.append(el('div',file.name,'fr-name'),el('div',`${(file.size/1024).toFixed(1)} KB`,'fr-meta'));
    info.querySelector('.fr-name').title=file.name;
    icon.innerHTML=window.ICONS.test16;icon.setAttribute('aria-hidden','true');
    remove.innerHTML=window.ICONS.close16;remove.type='button';remove.title='移除';remove.setAttribute('aria-label','移除 '+file.name);remove.disabled=isParsing;
    remove.onclick=()=>{selectedFiles=selectedFiles.filter(f=>f!==file);resetPreview();renderFiles();};
    row.append(icon,info,el('span',state,'fr-status'),remove);fileList.append(row);
  });
  document.getElementById('fileCount').textContent=selectedFiles.length?`已選 ${selectedFiles.length} 個檔案`:'';
  document.getElementById('fileCount').parentElement.hidden=!selectedFiles.length;
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
  resetPreview();status.textContent=rejected.length?rejected.join('；'):'';renderFiles();
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
  if(isParsing||!catalog||!selectedFiles.length)return;
  isParsing=true;files.disabled=true;uploadZone.setAttribute('aria-disabled','true');renderFiles();document.getElementById('results').replaceChildren();
  previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
  for(const file of selectedFiles) {
    status.textContent='解析中：'+file.name;
    fileStates.set(file,'解析中…');renderFiles();
    try {if(file.size>20*1024*1024)throw Error('檔案超過 20 MB');const result=await readBooklet(await file.arrayBuffer(),file.name);await render(result);fileStates.set(file,`已解析 ${result.questions.length} 題`);}
    catch(e){fileStates.set(file,'解析失敗');document.getElementById('results').append(el('p',file.name+'：'+e.message,'reverse-warning'));}
    renderFiles();
  }
  status.textContent='';isParsing=false;files.disabled=false;uploadZone.removeAttribute('aria-disabled');renderFiles();
  showStep(2);
  document.querySelector('.import-page-heading').scrollIntoView({block:'start'});
  document.getElementById('previewTitle').focus({preventScroll:true});
};
async function render(result) {
  const card=el('section',null,'card import-card reverse-result-card'), body=el('div',null,'card-body import-card-body'),header=el('div',null,'card-header section-heading'),title=el('div',null,'reverse-file-heading'),actions=el('div',null,'import-header-actions reverse-actions');
  title.append(el('h2',result.filename));header.append(title,actions);card.append(header,body);document.getElementById('results').append(card);
  const counts={};result.questions.forEach(q=>counts[q['題型']]=(counts[q['題型']]||0)+1);
  const stats=el('div',null,'reverse-stats');
  for(const [name,count] of [['總題數',result.questions.length],['圖片',result.images.length],...Object.entries(counts).sort(([a],[b])=>['T1','T2','T3','T4','T5','T6'].indexOf(a)-['T1','T2','T3','T4','T5','T6'].indexOf(b)).map(([t,n])=>[QUESTION_TYPES[t]||t,n])]){const stat=el('span',null,'reverse-stat');stat.append(el('span',name),el('strong',String(count)));stats.append(stat);}
  body.append(stats);
  const pictureReminder=el('section',null,'reverse-image-reminders');
  pictureReminder.setAttribute('aria-label','含圖片題目提醒');body.append(pictureReminder);
  const questionRows=[];
  function showImageReminders() {
    const items=imageQuestionReminders(result);pictureReminder.replaceChildren();pictureReminder.hidden=!items.length;
    if(!items.length)return;
    pictureReminder.append(el('h3',`含圖片題目提醒：${items.length} 題，共 ${items.reduce((sum,item)=>sum+item.count,0)} 張圖片`));
    const list=el('ul');pictureReminder.append(list);
    for(const item of items) {
      const li=el('li'),link=el('button',`編碼 ${item.id}（${QUESTION_TYPES[item.type]||item.type}）：${item.locations.map(location=>`${location.field} ${location.count} 張`).join('、')}`,'reverse-image-link');
      link.type='button';link.onclick=()=>{const row=questionRows[item.index];if(!row)return;row.open=true;row.scrollIntoView({block:'center',behavior:'smooth'});row.querySelector('summary')?.focus({preventScroll:true});};
      li.append(link);list.append(li);
    }
  }
  const select=el('select',null,'form-control'), label=el('label','科目與冊別','form-label'),scope=el('div',null,'reverse-scope');label.append(select);scope.append(label);body.append(scope);
  select.append(new Option('請確認科目與冊別',''));
  for(const s of catalog)for(const b of s.books)select.append(new Option(`${s.code} ${s.name} ／ ${b.code} ${b.name}`,b.code));
  const candidates=catalogCandidates(result,catalog);
  if(candidates.length===1)select.value=candidates[0].book.code;
  scope.append(el('p',candidates.length===1?'已依章節標題比對冊別，仍可調整。':'來源未提供足以唯一判斷冊別的資訊，請選擇正確冊別。','reverse-scope-note'));
  const warnings=el('p',null,'reverse-warning');body.append(warnings);
  const book=()=>catalog.flatMap(s=>s.books).find(b=>b.code===select.value);
  if(book())applyCatalog(result,book());
  const levels=el('p',null,'reverse-scope-note');scope.append(levels);
  const buttons=[];
  for(const choice of [true,false]) {
    const count=result.questions.filter(q=>choice?['T2','T3'].includes(q['題型']):!['T2','T3'].includes(q['題型'])).length;
    if(!count)continue;
    const button=el('button',`下載${choice?'選擇題':'其他題型'}入題檔（${count} 題）`,'btn btn-primary btn-sm');actions.append(button);buttons.push(button);
    button.onclick=async()=>{
      button.disabled=true;
      try {const output=await exportImportFile(result,choice,select.value);const url=URL.createObjectURL(output.blob), a=el('a');a.href=url;a.download=output.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
      catch(e){warnings.textContent=e.message;}finally{validate();}
    };
  }
  function validate(){const selected=book();levels.textContent=selected?`此冊層級：${[selected.l1,selected.l2,selected.l3].filter(Boolean).join(' → ')}。章數／節數／小節填入各層序號，依網站目錄驗證。`:'';const errors=validateQuestions(result,selected);warnings.textContent=[...result.warnings,...errors].join('\n');buttons.forEach(b=>b.disabled=!select.value||errors.length>0);showImageReminders();}
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
      const refreshPictures=()=>{
        label.querySelectorAll('.reverse-picture').forEach(image=>image.remove());
        for(const marker of String(q[key]||'').matchAll(/⟦圖(\d+)⟧/g)) {
          const image=el('img');image.src=urls[+marker[1]]||'';image.alt=`${key} 圖片 ${+marker[1]+1}`;image.className='reverse-picture';label.append(image);
        }
      };
      input.oninput=()=>{q[key]=multiline?readEditor(input):input.value;refreshPictures();validate();};
      if(multiline)input.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
      if(['章數','節數','小節'].includes(key))scopeInputs.push({q,key,input});
      if(['章數','節數','小節'].includes(key))input.onblur=()=>{q[key]=formatScopeNumber(input.value);input.value=q[key];validate();};
      refreshPictures();
    }
    list.append(row);questionRows.push(row);
  }
  body.append(el('p','Enter 另起段落，Shift+Enter 在同段內換行。⟦圖編號⟧ 表示原檔圖片，可在欄位間移動；下載時會還原為內嵌圖片。章節必須符合所選冊別目錄。'));
  validate();
}
