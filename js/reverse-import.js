// 直接讀取 OOXML，避免 HTML 轉換遺失浮動圖片與 VML 圖片。
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = s => { const d = new DOMParser().parseFromString(s, 'application/xml'); if (d.querySelector('parsererror')) throw Error('Word XML 格式損壞'); return d; };
const all = (n, name) => Array.from(n.getElementsByTagNameNS(W, name));
const serialize = n => new XMLSerializer().serializeToString(n);
const clean = s => s.replace(/\u00a0/g,' ').trim();
// U+2029 是 Enter 段落；LF 是 Shift+Enter 段內換行。
export const PARAGRAPH_BREAK='\u2029';
const stripImages = value => value.split(PARAGRAPH_BREAK).map(part=>({part,remaining:part.replace(/\n?⟦圖\d+⟧/g,'')})).filter(({part,remaining})=>!(/⟦圖\d+⟧/.test(part)&&!remaining.trim())).map(({remaining})=>remaining).join(PARAGRAPH_BREAK);
const header = s => clean(s).replace(/\s/g,'').replace(/\(.*\)|（.*）/g,'').replace(/^簡答(?:\/答案)?$/, '簡答/答案').replace(/^詳答(?:\/解析)?$/, '詳答/解析').replace(/^題尾$/, '結尾');
export const CHOICE_HEADERS = ['難易','章數','節數','小節','題型','頁數/出處','來源','答數','簡答/答案','題目','選項1','選項2','選項3','選項4','選項5','結尾','詳答/解析'];
export const OTHER_HEADERS = [...CHOICE_HEADERS.slice(0,10),'詳答/解析'];
const typeNames = {是非題:'T1',選擇題:'T2',單選題:'T2',複選題:'T3',多選題:'T3',填空題:'T4',配合題:'T5',問答題:'T6',簡答題:'T6'};
const halfAlphanumeric = s => s.replace(/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
const fullAnswer = s => halfAlphanumeric(s).replace(/[A-Za-z0-9]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0));
export function formatScopeNumber(value) {
  const text=halfAlphanumeric(String(value??'')).trim();
  return /^\d+$/.test(text)?text.padStart(2,'0'):text;
}
export function formatQuestion(question) {
  const q={...question}, choice=['T2','T3'].includes(q['題型']);
  for(const key of CHOICE_HEADERS)q[key]=key==='簡答/答案'&&choice?fullAnswer(String(q[key]||'')):halfAlphanumeric(String(q[key]||''));
  for(const key of ['章數','節數','小節'])q[key]=formatScopeNumber(q[key]);
  const images=[];
  for(const key of CHOICE_HEADERS) {
    if(!choice&&['題目','詳答/解析'].includes(key))continue;
    const markers=q[key].match(/⟦圖\d+⟧/g)||[];images.push(...markers);
    if(markers.length)q[key]=stripImages(q[key]);
  }
  const destination=choice?'結尾':'題目';
  if(!choice)for(const key of ['題目','詳答/解析']) {
    const markers=q[key].match(/⟦圖\d+⟧/g)||[];
    if(markers.length)q[key]=stripImages(q[key])+'\n'+markers.join('\n');
  }
  images.sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
  if(images.length)q[destination]+='\n'+images.join('\n');
  return q;
}
function setFont(run,font='新細明體') {
  const d=run.ownerDocument;
  let pr=Array.from(run.children).find(n=>n.localName==='rPr');
  if(!pr){pr=d.createElementNS(W,'w:rPr');run.prepend(pr);}
  let fonts=all(pr,'rFonts')[0];if(!fonts){fonts=d.createElementNS(W,'w:rFonts');pr.prepend(fonts);}
  for(const attr of Array.from(fonts.attributes))fonts.removeAttributeNode(attr);
  for(const attr of ['ascii','hAnsi','eastAsia','cs'])fonts.setAttributeNS(W,'w:'+attr,font);
}
function defaultFonts(d) {
  for(const fonts of all(d,'rFonts')) {
    for(const attr of Array.from(fonts.attributes))fonts.removeAttributeNode(attr);
    for(const attr of ['ascii','hAnsi','eastAsia','cs'])fonts.setAttributeNS(W,'w:'+attr,'新細明體');
  }
  all(d,'r').forEach(r=>setFont(r));
}
function chineseNumber(s) { if (/^\d+$/.test(s)) return +s; const digits='零一二三四五六七八九'; if(s==='十')return 10; if(s.includes('十')) { const [a,b]=s.split('十'); return (a?digits.indexOf(a):1)*10+(b?digits.indexOf(b):0); } return digits.indexOf(s); }

export async function readBooklet(buffer, filename='題本.docx') {
  const zip = await JSZip.loadAsync(buffer);
  if (!zip.file('word/document.xml')) throw Error('不是有效的 DOCX 文件');
  const document = xml(await zip.file('word/document.xml').async('string'));
  const rels = xml(await zip.file('word/_rels/document.xml.rels').async('string'));
  const images = [], warnings = [];
  async function content(node) {
    let value = '';
    for (const e of Array.from(node.childNodes)) {
      if(e.nodeType!==1) continue;
      if(e.localName==='t') value += e.textContent;
      else if(e.localName==='tab') value+='\t';
      else if(e.localName==='br'&&!['page','column'].includes(e.getAttributeNS(W,'type')) || e.localName==='cr') value+='\n';
      else if(e.localName==='drawing'||e.localName==='pict') {
        const ids = Array.from(e.getElementsByTagName('*')).flatMap(n => Array.from(n.attributes).filter(a=>a.namespaceURI===R && ['embed','id','link'].includes(a.localName)).map(a=>a.value));
        const files=[];
        for(const id of new Set(ids)) {
          const rel=Array.from(rels.documentElement.children).find(n=>n.getAttribute('Id')===id);
          if(!rel || rel.getAttribute('TargetMode')==='External') throw Error('含外部或無法讀取的圖片，請先在 Word 嵌入圖片');
          const path=rel.getAttribute('Target').replace(/^\//,'');
          const resolved=path.startsWith('word/')?path:'word/'+path;
          const f=zip.file(resolved); if(!f) throw Error('圖片檔案遺失：'+resolved);
          files.push({id,path:resolved,data:await f.async('uint8array')});
        }
        images.push({drawing:serialize(e),files}); value+=`⟦圖${images.length-1}⟧`;
      } else value+=await content(e);
    }
    return value;
  }
  const questions=[];
  const tables=all(document,'tbl'); let tableFormat=false;
  for(const table of tables) {
    const rows=Array.from(table.children).filter(n=>n.localName==='tr');
    if(!rows.length)continue;
    const heads=await Promise.all(Array.from(rows[0].children).filter(n=>n.localName==='tc').map(async n=>header(await content(n))));
    if(!heads.includes('題型')||!heads.includes('題目'))continue;
    tableFormat=true;
    for(const tr of rows.slice(1)) {
      const cells=Array.from(tr.children).filter(n=>n.localName==='tc'); const q={_id:String(questions.length+1)};
      for(let i=0;i<heads.length;i++) q[heads[i]]=(await Promise.all(all(cells[i]||tr,'p').map(content))).join(PARAGRAPH_BREAK).replace(/\u00a0/g,' ');
      if(!q['題目'])continue;
      q['題型']=q['題型'].replace(/\s/g,''); q['簡答/答案']=fullAnswer(q['簡答/答案']||'');
      questions.push(q);
    }
  }
  const headings=[];
  if(!tableFormat) {
    let current=null, type='', chapter='', section='', subsection='';
    function finish() {
      if(!current)return;
      let body=current.body.join(PARAGRAPH_BREAK);
      const analysis=body.indexOf('【解析】');
      current['詳答/解析']=analysis<0?'':clean(body.slice(analysis+4));
      if(analysis>=0)body=body.slice(0,analysis);
      const sources=[...body.matchAll(/【\s*(P\.[^】]*)】/gi)];
      current['頁數/出處']=sources.map(m=>m[1].replace(/\s/g,'')).join('、');
      body=body.replace(/【\s*P\.[^】]*】/gi,'');
      const lead=body.match(/^\s*[（(]\s*([^）)]*)[）)]\s*\d+[.．、]\s*/);
      current['簡答/答案']=lead?fullAnswer(clean(lead[1])):'';
      if(lead)body=body.slice(lead[0].length);
      if(!['T2','T3'].includes(current['題型'])) {
        // 填空、配合與問答題的答案另列於【答案】後，不能留在題幹。
        const answer=body.match(/【\s*答案\s*】/);
        if(answer) {
          current['簡答/答案']=clean(body.slice(answer.index+answer[0].length));
          body=body.slice(0,answer.index);
        }
        body=body.replace(/^\s*[0-9０-９]+[.．、]\s*/, '');
      }
      if(['T2','T3'].includes(current['題型'])) {
        const options=[...body.matchAll(/[（(]\s*([A-EＡ-Ｅ])\s*[）)]/g)];
        current['題目']=clean(options.length?body.slice(0,options[0].index):body);
        options.forEach((m,i)=>current['選項'+(m[1].normalize('NFKC').charCodeAt(0)-64)]=clean(body.slice(m.index+m[0].length,options[i+1]?.index??body.length)));
        const last='選項'+options.length;
        const trailingImages=(current[last]||'').match(/(?:\s*⟦圖\d+⟧)+\s*$/)?.[0]||'';
        if(trailingImages)current[last]=clean(current[last].slice(0,-trailingImages.length));
        current['結尾']='';
        if(current[last]?.endsWith('。')) {current[last]=current[last].slice(0,-1).trim();current['結尾']='。';}
        // 題幹圖片移到結尾，選項與解析圖片仍留在原欄位。
        const pics=current['題目'].match(/⟦圖\d+⟧/g)||[];
        current['題目']=clean(current['題目'].replace(/⟦圖\d+⟧/g,''));
        current['結尾'] += pics.length?PARAGRAPH_BREAK+pics.join(PARAGRAPH_BREAK):'';
        if(trailingImages)current['結尾']+=PARAGRAPH_BREAK+clean(trailingImages);
      } else current['題目']=clean(body);
      current['答數']=current['題型']==='T3'?String((current['簡答/答案'].match(/[Ａ-Ｅ]/g)||[]).length):'1';
      if(!current['題目'])warnings.push('編碼 '+current._id+' 缺少題目');
      if(!current['簡答/答案'])warnings.push('編碼 '+current._id+' 缺少答案，請補填');
      delete current.body;questions.push(current);current=null;
    }
    for(const p of all(document,'p')) {
      const raw=await content(p),text=clean(raw);
      if(!text){if(current)current.body.push(raw);continue;}
      const t=Object.keys(typeNames).find(n=>new RegExp('^[一二三四五六七八九十\\d]+[、.．]\\s*'+n+'$').test(text));
      if(t){finish();type=typeNames[t];continue;}
      const h=text.match(/^(?:第)?([零一二三四五六七八九十\d]+)(章|課|單元|節|小節)\s*(.*)$/) || text.match(/^(單元)([零一二三四五六七八九十\d]+)\s*(.*)$/)?.map((v,i,a)=>i===1?a[2]:i===2?a[1]:v);
      if(h){finish();headings.push(text); const n=String(chineseNumber(h[1])); if(h[2]==='小節')subsection=n;else if(h[2]==='節'){section=n;subsection='';}else{chapter=n;section='';subsection='';}continue;}
      const meta=text.match(/^編碼[：:]\s*(\S+)\s+難易度[：:]\s*(\S+)\s+來源[：:]\s*(.*)$/);
      if(meta){finish();current={_id:meta[1],_headings:headings.slice(),題型:type,章數:chapter,節數:section,小節:subsection,難易:meta[2].includes('較難')?'◎':meta[2].includes('簡易')?'△':'',來源:meta[3].includes('課本')?'A1':meta[3].includes('考題')?'A2':'',body:[]};continue;}
      if(current)current.body.push(raw);else if(/⟦圖/.test(text))warnings.push('有圖片位於題目範圍外，請檢查原檔');
    }
    finish();
  }
  if(!questions.length)throw Error('無法辨識題目。需含編碼／難易度／來源的舊版題本，或入題表格。');
  return {filename,questions:questions.map(formatQuestion),images,headings,warnings,tableFormat};
}

export function catalogCandidates(result,catalog) {
  const normalize=s=>s.replace(/[\s　]/g,'');
  const found=[];
  for(const subject of catalog)for(const book of subject.books) {
    if(result.headings.some(h=>catalogPaths(book).some(c=>normalize(c.title)===normalize(h))))found.push({subject,book});
  }
  return found;
}
function catalogPaths(book) {
  return book.chapters.flatMap(c=>[{title:c.title,scope:[c.chapterNum,'','']},...(c.sections||[]).flatMap(s=>[{title:s.title,scope:[c.chapterNum,s.sectionNum,'']},...(s.subsections||[]).map(u=>({title:u.title,scope:[c.chapterNum,s.sectionNum,u.num??u.subsectionNum]}))])]);
}
export function applyCatalog(result,book) {
  const normalize=s=>s.replace(/\s/g,'');
  for(const q of result.questions) {
    if(!q._headings?.length)continue;
    const paths=catalogPaths(book);
    const match=q._headings.slice().reverse().map(h=>paths.find(p=>normalize(p.title)===normalize(h))).find(Boolean);
    if(match) ['章數','節數','小節'].forEach((key,i)=>q[key]=formatScopeNumber(match.scope[i]));
  }
}
export function validateQuestions(result,book) {
  const errors=[];
  for(const q of result.questions) {
    const tag='題 '+q._id;
    if(!/^T[1-6]$/.test(q['題型']))errors.push(tag+'：題型不明');
    if(!q['題目']||!q['簡答/答案'])errors.push(tag+'：題目或答案空白');
    if(q['題型']==='T2' && (!q['選項1']||!q['選項2']))errors.push(tag+'：缺少選項（表格式選擇題須有獨立選項欄）');
    if(['T2','T3'].includes(q['題型']))for(const answer of (q['簡答/答案']||'').match(/[Ａ-ＥA-E]/g)||[])if(!q['選項'+(answer.normalize('NFKC').charCodeAt(0)-64)])errors.push(tag+'：答案指向空白選項');
    for(const marker of Object.values(q).filter(v=>typeof v==='string').join('\n').matchAll(/⟦圖(\d+)⟧/g))if(!result.images[+marker[1]])errors.push(tag+'：圖片編號不存在');
    const c=book?.chapters.find(c=>Number(c.chapterNum)===Number(q['章數']));
    if(!c){errors.push(tag+'：章數不在冊別目錄');continue;}
    if(book.l2) {
      const s=c.sections?.find(s=>Number(s.sectionNum)===Number(q['節數']));
      if(!s){errors.push(tag+'：節數不在目錄');continue;}
      if(book.l3 && !s.subsections?.some(s=>Number(s.num??s.subsectionNum)===Number(q['小節'])))errors.push(tag+'：小節不在目錄');
    } else if(Number(q['節數'])||Number(q['小節']))errors.push(tag+'：此冊別只有一層，請確認章節');
  }
  return errors;
}

export async function exportImportFile(result,choice,bookCode) {
  const response=await fetch('assets/reverse-import/'+(choice?'choice':'other')+'.docx'); if(!response.ok)throw Error('範本無法載入');
  const zip=await JSZip.loadAsync(await response.arrayBuffer());
  const d=xml(await zip.file('word/document.xml').async('string'));
  defaultFonts(d);
  for(const path of Object.keys(zip.files).filter(p=>/^word\/(styles|numbering|header\d+|footer\d+)\.xml$/.test(p))) {
    const part=xml(await zip.file(path).async('string'));defaultFonts(part);zip.file(path,serialize(part));
  }
  const rels=xml(await zip.file('word/_rels/document.xml.rels').async('string'));
  const ct=xml(await zip.file('[Content_Types].xml').async('string'));
  const body=all(d,'body')[0], table=all(d,'tbl')[0];
  const rows=Array.from(table.children).filter(n=>n.localName==='tr'), prototype=rows[1].cloneNode(true);
  if(choice) {
    const tail=Array.from(rows[0].children).filter(n=>n.localName==='tc')[15];
    const texts=all(tail,'t');texts.forEach((t,i)=>t.textContent=i===0?'結尾':'');
  }
  rows.slice(1).forEach(r=>r.remove());
  // 不保留範本的示範題、圖片關係與私人文件資訊。
  for(const n of Array.from(body.children))if(n!==table&&n.localName!=='sectPr')n.remove();
  for(const n of Array.from(rels.documentElement.children))if(n.getAttribute('Type')?.endsWith('/image'))n.remove();
  Object.keys(zip.files).filter(p=>p.startsWith('word/media/')).forEach(p=>zip.remove(p));
  const imageMap=new Map(); let imageId=0;
  const heads=choice?CHOICE_HEADERS:OTHER_HEADERS;
  for(const original of result.questions.filter(q=>choice?['T2','T3'].includes(q['題型']):!['T2','T3'].includes(q['題型']))) {
    const q=formatQuestion(original);
    const row=prototype.cloneNode(true), cells=Array.from(row.children).filter(n=>n.localName==='tc');
    all(row,'trHeight').forEach(n=>n.remove());
    for(let i=0;i<heads.length;i++) {
      const cell=cells[i]; for(const n of Array.from(cell.children))if(n.localName!=='tcPr')n.remove();
      let value=q[heads[i]]||'';
      for(const line of value.split(PARAGRAPH_BREAK)) {
        const p=d.createElementNS(W,'w:p');cell.append(p);
        for(const part of line.split(q['題型']==='T4'?/(⟦圖\d+⟧|_{3,}|\n|\t)/g:/(⟦圖\d+⟧|\n|\t)/g)) {
          if(!part)continue;const r=d.createElementNS(W,'w:r');p.append(r);
          setFont(r,q['題型']==='T4'&&/^_{3,}$/.test(part)?'Times New Roman':'新細明體');
          if(part==='\n'||part==='\t'){r.append(d.createElementNS(W,part==='\n'?'w:br':'w:tab'));continue;}
          const match=part.match(/^⟦圖(\d+)⟧$/);
          if(!match){const t=d.createElementNS(W,'w:t');t.setAttribute('xml:space','preserve');t.textContent=part;r.append(t);continue;}
          const image=result.images[+match[1]];if(!image)throw Error('圖片索引遺失');
          const drawing=xml(image.drawing).documentElement;
          // 將原題本的浮動圖改成儲存格內的行內圖，避免沿用頁面座標。
          for(const anchor of Array.from(drawing.getElementsByTagName('*')).filter(n=>n.localName==='anchor')) {
            const inline=anchor.ownerDocument.createElementNS(anchor.namespaceURI,'wp:inline');
            for(const n of Array.from(anchor.children))if(['extent','effectExtent','docPr','cNvGraphicFramePr','graphic'].includes(n.localName))inline.append(n.cloneNode(true));
            anchor.replaceWith(inline);
          }
          for(const f of image.files) {
            if(!imageMap.has(f.id)) {
              const ext=f.path.split('.').pop().toLowerCase(), id='reverseImage'+(++imageId), name='reverse-'+imageId+'.'+ext;
              zip.file('word/media/'+name,f.data); const rel=rels.createElementNS(rels.documentElement.namespaceURI,'Relationship');
              rel.setAttribute('Id',id);rel.setAttribute('Type',R+'/image');rel.setAttribute('Target','media/'+name);rels.documentElement.append(rel);
              if(!Array.from(ct.documentElement.children).some(n=>n.getAttribute('Extension')===ext)) {
                const def=ct.createElementNS(ct.documentElement.namespaceURI,'Default');def.setAttribute('Extension',ext);def.setAttribute('ContentType',({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',emf:'image/x-emf',wmf:'image/x-wmf'})[ext]||'application/octet-stream');ct.documentElement.append(def);
              }
              imageMap.set(f.id,id);
            }
            for(const n of Array.from(drawing.getElementsByTagName('*')))for(const a of Array.from(n.attributes))if(a.namespaceURI===R&&a.value===f.id)a.value=imageMap.get(f.id);
          }
          for(const n of Array.from(drawing.getElementsByTagName('*')))if(n.localName==='docPr')n.setAttribute('id',String(++imageId));
          r.append(d.importNode(drawing,true));
        }
      }
    }
    table.append(row);
  }
  zip.file('word/document.xml',serialize(d));zip.file('word/_rels/document.xml.rels',serialize(rels));zip.file('[Content_Types].xml',serialize(ct));
  return {name:bookCode+'-'+(choice?'選擇題':'其他題型')+'-'+result.filename,blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'})};
}
