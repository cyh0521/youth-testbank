/**
 * 幼獅題庫系統 — 核心資料模組 v1.1
 */
const QUESTION_TYPES = { T1:'是非題',T2:'單選題',T3:'複選題',T4:'填空題',T5:'配合題',T6:'問答題' };
const COMPOSE_DIFFICULTY = {
  hard:  {label:'偏難',  weights:{'◎':0.6,'':0.3,'△':0.1}},
  medium:{label:'適中',  weights:{'◎':0.34,'':0.33,'△':0.33}},
  easy:  {label:'偏易',  weights:{'◎':0.1,'':0.3,'△':0.6}},
  any:   {label:'不限難易',weights:null}
};
const SOURCE_CODES={A1:'課本',A2:'四技二專考題'};
const SUBJECT_CODES={A1:'大學全民國防教育',B1:'高中全民國防教育',C1:'健康與護理',D1:'生涯規劃',E1:'家政',F1:'生命教育',G1:'高中美術',H1:'技高美術',I1:'生活科技'};
const BOOK_CODES={
  A1:{'01':'國際情勢','02':'國防政策','03':'全民國防','04':'防衛動員','05':'國防科技'},
  B1:{'01':'高中全民國防教育（甲版）','02':'高中全民國防教育（乙版）'},
  C1:{'01':'健康與護理','02':'安全教育與傷害防護','03':'運動與健康','04':'健康與休閒生活'},
  D1:{'01':'高中生涯規劃','02':'選修','03':'技高生涯規劃'},
  E1:{'01':'高中家政','02':'選修'},
  F1:{'01':'生命教育','02':'選修'},
  G1:{'01':'高中美術（上）','02':'高中美術（下）','03':'高中藝術生活','04':'選修'},
  H1:{'01':'技高美術'},
  I1:{'01':'生活科技'}
};

const DB={
  _k:k=>`qbank_${k}`,
  get(k){try{return JSON.parse(localStorage.getItem(DB._k(k)));}catch{return null;}},
  set(k,v){localStorage.setItem(DB._k(k),JSON.stringify(v));},
  remove(k){localStorage.removeItem(DB._k(k));},
  getQuestions(){return DB.get('questions')||[];},
  setQuestions(qs){DB.set('questions',qs);},
  addQuestions(nqs){
    const qs=DB.getQuestions();const maxId=qs.reduce((m,q)=>Math.max(m,q.id||0),0);
    nqs.forEach((q,i)=>{q.id=maxId+i+1;});DB.set('questions',[...qs,...nqs]);return nqs.length;
  },
  updateQuestion(id,data){
    const qs=DB.getQuestions();const idx=qs.findIndex(q=>q.id===id);
    if(idx>=0){qs[idx]={...qs[idx],...data};DB.setQuestions(qs);return true;}return false;
  },
  deleteQuestion(id){DB.setQuestions(DB.getQuestions().filter(q=>q.id!==id));},
  getExams(){return DB.get('exams')||[];},
  saveExam(exam){
    const exams=DB.getExams();
    if(!exam.id){exam.id=Date.now();exam.createdAt=new Date().toISOString();exams.push(exam);}
    else{const i=exams.findIndex(e=>e.id===exam.id);if(i>=0)exams[i]=exam;}
    DB.set('exams',exams);return exam.id;
  },
  deleteExam(id){DB.set('exams',DB.getExams().filter(e=>e.id!==id));},
  getResults(){return DB.get('results')||[];},
  saveResult(r){const rs=DB.getResults();r.id=Date.now();r.submittedAt=new Date().toISOString();rs.push(r);DB.set('results',rs);return r.id;},
  getUsers(){return DB.get('users')||[];},
  setUsers(u){DB.set('users',u);},
};

const Auth={
  ROLES:{admin:{label:'管理員',icon:'🔑'},teacher:{label:'老師',icon:'🎓'},student:{label:'學生',icon:'🧑‍🎓'}},
  getCurrentUser(){return DB.get('currentUser');},
  isLoggedIn(){return!!Auth.getCurrentUser();},
  isAdmin(){const u=Auth.getCurrentUser();return u&&u.role==='admin';},
  isTeacher(){const u=Auth.getCurrentUser();return u&&u.role==='teacher';},
  isStudent(){const u=Auth.getCurrentUser();return u&&u.role==='student';},
  isStaff(){const u=Auth.getCurrentUser();return u&&(u.role==='admin'||u.role==='teacher');},
  can:{
    importQuestion(){return Auth.isAdmin();},
    editQuestion(){return Auth.isAdmin();},
    deleteQuestion(){return Auth.isAdmin();},
    viewQuestions(){return Auth.isStaff();},
    compose(){return Auth.isStaff();},
    manageExam(){return Auth.isStaff();},
    viewResults(){return Auth.isStaff();}
  },
  login(username,password){
    const user=DB.getUsers().find(u=>u.username===username);
    if(!user)return{ok:false,msg:'帳號不存在'};
    if(user.password!==password)return{ok:false,msg:'密碼錯誤'};
    DB.set('currentUser',user);return{ok:true,user};
  },
  register(data){
    if(DB.getUsers().find(u=>u.username===data.username))return{ok:false,msg:'帳號已存在'};
    const user={id:Date.now(),username:data.username,password:data.password,
      displayName:data.displayName||data.username,role:data.role,createdAt:new Date().toISOString()};
    DB.setUsers([...DB.getUsers(),user]);return{ok:true,user};
  },
  logout(){DB.remove('currentUser');window.location.href='index.html';},
  requireLogin(rolesArg){
    if(!Auth.isLoggedIn()){window.location.href='index.html';return false;}
    if(rolesArg!==undefined&&rolesArg!==null){
      // 同時支援陣列 ['admin','teacher'] 或單一字串 'admin'
      const allowed=Array.isArray(rolesArg)?rolesArg:[rolesArg];
      const u=Auth.getCurrentUser();
      if(!allowed.includes(u.role)){window.location.href='dashboard.html';return false;}
    }
    return true;
  },
  getRegCode(role){return DB.get('regCode_'+role)||(role==='admin'?'admin2024':'teacher2024');},
  setRegCode(role,code){DB.set('regCode_'+role,code);},
  verifyRegCode(role,code){if(role==='student')return true;return code===Auth.getRegCode(role);}
};

const QuestionQuery={
  filter(opts={}){
    let qs=DB.getQuestions();
    if(opts.subjectCode) qs=qs.filter(q=>q.subjectCode===opts.subjectCode);
    if(opts.bookCode)    qs=qs.filter(q=>q.bookCode===opts.bookCode);
    if(opts.type)        qs=qs.filter(q=>q.type===opts.type);
    if(opts.difficulty)  qs=qs.filter(q=>q.difficulty===opts.difficulty);
    if(opts.chapterNum)  qs=qs.filter(q=>q.chapterNum===opts.chapterNum);
    if(opts.chapterNums&&opts.chapterNums.length) qs=qs.filter(q=>opts.chapterNums.includes(q.chapterNum));
    // chapters：格式為 ["01-01","01-02"] 表示章-節，支援精確章節篩選
    if(opts.chapters&&opts.chapters.length){
      qs=qs.filter(q=>{
        return opts.chapters.some(c=>{
          const parts=c.split('-');
          if(parts.length===1) return q.chapterNum===parts[0];
          if(parts.length===2) return q.chapterNum===parts[0]&&q.sectionNum===parts[1];
          return q.chapterNum===parts[0]&&q.sectionNum===parts[1]&&q.subsectionNum===parts[2];
        });
      });
    }
    if(opts.keyword){const kw=opts.keyword.toLowerCase();qs=qs.filter(q=>(q.text||'').includes(kw)||(q.answer||'').includes(kw));}
    return qs;
  },
  getStats(){
    const qs=DB.getQuestions();
    const s={total:qs.length,byType:{},bySubject:{},byDifficulty:{}};
    qs.forEach(q=>{
      s.byType[q.type]=(s.byType[q.type]||0)+1;
      s.bySubject[q.subjectCode]=(s.bySubject[q.subjectCode]||0)+1;
      s.byDifficulty[q.difficulty||'']=(s.byDifficulty[q.difficulty||'']||0)+1;
    });
    return s;
  },
  randomWithDifficulty(baseOpts,diffLevel,count,type){
    const cfg=COMPOSE_DIFFICULTY[diffLevel]||COMPOSE_DIFFICULTY.any;
    const opts={...baseOpts,type};
    if(!cfg.weights){return[...QuestionQuery.filter(opts)].sort(()=>Math.random()-.5).slice(0,count);}
    const buckets={'◎':[],'':[],'△':[]};
    QuestionQuery.filter(opts).forEach(q=>{const d=q.difficulty||'';if(d in buckets)buckets[d].push(q);});
    Object.values(buckets).forEach(b=>b.sort(()=>Math.random()-.5));
    const result=[];const w=cfg.weights;
    ['◎','','△'].forEach(d=>{const want=Math.round(w[d]*count);result.push(...buckets[d].slice(0,Math.min(want,buckets[d].length)));});
    if(result.length<count){const used=new Set(result.map(q=>q.id));const rest=QuestionQuery.filter(opts).filter(q=>!used.has(q.id)).sort(()=>Math.random()-.5);result.push(...rest.slice(0,count-result.length));}
    return result.slice(0,count);
  },
  getChapters(subjectCode,bookCode){
    // 回傳格式：{ '01':{ num:'01', sections:{ '01':{ num:'01' }, ... } }, ... }
    const qs=QuestionQuery.filter({subjectCode,bookCode:bookCode||undefined});
    const chapters={};
    qs.forEach(q=>{
      const chap=q.chapterNum;
      const sec=q.sectionNum;
      if(!chap)return;
      if(!chapters[chap])chapters[chap]={num:chap,sections:{}};
      if(sec&&!chapters[chap].sections[sec])chapters[chap].sections[sec]={num:sec};
    });
    return chapters;
  }
};

const DocImporter={
  parseMarkdownTable(text){
    const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('|'));
    if(lines.length<3)return[];
    const headers=lines[0].split('|').map(h=>h.trim()).filter(Boolean);
    const rows=[];
    for(let i=2;i<lines.length;i++){
      const cells=lines[i].split('|').slice(1,-1).map(c=>c.trim());
      if(!cells.length)continue;
      const row={};headers.forEach((h,idx)=>{row[h]=cells[idx]||'';});rows.push(row);
    }
    return rows;
  },
  rowToQuestion(row,subjectCode,bookCode){
    const type=(row['題型']||'').trim();
    // 統一存為數字（0 表示未填）
    const chap=parseInt(row['章數']||'0')||0;
    const sec=parseInt(row['節數']||'0')||0;
    const sub=parseInt(row['小節']||'0')||0;
    // catalogCode 仍用零填充字串供範圍代碼對應
    const chapStr=String(chap).padStart(2,'0');
    const secStr=String(sec).padStart(2,'0');
    const subStr=String(sub).padStart(2,'0');
    let catalogCode='';
    if(subjectCode&&bookCode){
      if(subjectCode==='B1') catalogCode=`${subjectCode}-${bookCode}-${chapStr}${secStr}${subStr}`;
      else if(subjectCode==='C1') catalogCode=`${subjectCode}-${bookCode}-${chapStr}${secStr}`;
      else catalogCode=`${subjectCode}-${bookCode}-${chapStr}`;
    }
    const q={subjectCode,bookCode,type,difficulty:(row['難易']||'').trim(),
      source:(row['頁數/出處']||row['頁數']||'').trim(),sourceCode:(row['來源']||'A1').trim(),
      answerCount:parseInt(row['答數']||'1')||1,answer:(row['簡答/答案']||row['簡答']||'').trim(),
      text:(row['題目']||'').trim(),analysis:(row['詳答/解析']||row['詳答']||'').trim(),
      chapterNum:chap,sectionNum:sec,subsectionNum:sub,catalogCode};
    if(type==='T2'){
      q.options=[row['選項1']||'',row['選項2']||'',row['選項3']||'',row['選項4']||'',row['選項5']||''].filter(o=>o!=='');
      q.tail=(row['結尾']||'').trim();
    }
    return q;
  },
  parseText(text,subjectCode,bookCode){
    return DocImporter.parseMarkdownTable(text).filter(r=>r['題型']&&r['題目']).map(r=>DocImporter.rowToQuestion(r,subjectCode,bookCode));
  }
};

const UI={
  renderSidebar(containerId,activeItem){
    const user=Auth.getCurrentUser();if(!user)return;
    const role=user.role;const ri=Auth.ROLES[role]||Auth.ROLES.student;
    const ini=(user.displayName||user.username||'?')[0].toUpperCase();
    const adminNav=`<div class="nav-section-title">題庫管理</div>
      <div class="nav-item ${activeItem==='import'?'active':''}" onclick="nav('import')"><span class="icon">📥</span>題目匯入</div>
      <div class="nav-item ${activeItem==='questions'?'active':''}" onclick="nav('questions')"><span class="icon">📋</span>題目維護</div>`;
    const staffNav=`<div class="nav-section-title">出題管理</div>
      <div class="nav-item ${activeItem==='compose'?'active':''}" onclick="nav('compose')"><span class="icon">✏️</span>電腦選題</div>
      <div class="nav-item ${activeItem==='manual'?'active':''}" onclick="nav('manual')"><span class="icon">🖊️</span>人工選題</div>
      <div class="nav-item ${activeItem==='coded'?'active':''}" onclick="nav('coded')"><span class="icon">🔢</span>編碼選題</div>
      <div class="nav-item ${activeItem==='exams'?'active':''}" onclick="nav('exams')"><span class="icon">📁</span>試卷管理</div>
      <div class="nav-section-title">成績管理</div>
      <div class="nav-item ${activeItem==='results'?'active':''}" onclick="nav('results')"><span class="icon">📊</span>成績查詢</div>
      <div class="nav-section-title">系統設定</div>
      <div class="nav-item ${activeItem==='settings'?'active':''}" onclick="nav('settings')"><span class="icon">⚙️</span>帳號與設定</div>`;
    const studentNav=`<div class="nav-section-title">線上考試</div>
      <div class="nav-item ${activeItem==='take'?'active':''}" onclick="nav('take')"><span class="icon">📝</span>參加考試</div>
      <div class="nav-item ${activeItem==='my-results'?'active':''}" onclick="nav('my-results')"><span class="icon">📊</span>我的成績</div>`;
    const navContent=role==='admin'?adminNav+staffNav:role==='teacher'?staffNav:studentNav;
    document.getElementById(containerId).innerHTML=`
      <div class="sidebar-logo"><h1>幼獅題庫系統</h1><span>線上版 v1.0</span></div>
      <div class="sidebar-user">
        <div class="avatar">${ini}</div>
        <div class="user-info"><div class="user-name">${user.displayName||user.username}</div><div class="user-role">${ri.icon} ${ri.label}</div></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-item ${activeItem==='dashboard'?'active':''}" onclick="nav('dashboard')"><span class="icon">🏠</span>首頁總覽</div>
        ${navContent}
      </nav>
      <div class="sidebar-footer"><button class="logout-btn" onclick="Auth.logout()"><span>⬅</span> 登出</button></div>`;
  },
  toast(msg,type='info',duration=3000){
    const colors={success:'#1e8449',danger:'#c0392b',warning:'#d35400',info:'#1a3a5c'};
    const icons={success:'✓',danger:'✕',warning:'⚠',info:'ℹ'};
    const t=document.createElement('div');
    t.style.cssText=`position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]||colors.info};color:white;padding:12px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);font-size:.875rem;display:flex;align-items:center;gap:8px;animation:slideUp .2s ease;max-width:320px;`;
    t.innerHTML=`<strong>${icons[type]||'ℹ'}</strong>${msg}`;
    document.body.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},duration);
  },
  confirm(msg){return window.confirm(msg);},
  formatDate(iso){if(!iso)return'-';const d=new Date(iso);return`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;},
  formatDateTime(iso){if(!iso)return'-';const d=new Date(iso);return`${UI.formatDate(iso)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;},
  typeBadge(type){return`<span class="badge badge-${type.toLowerCase()}">${QUESTION_TYPES[type]||type}</span>`;},
  diffBadge(diff){if(diff==='◎')return`<span class="badge badge-hard">較難</span>`;if(diff==='△')return`<span class="badge badge-easy">簡易</span>`;return`<span class="badge badge-normal">一般</span>`;},
  buildOptions(obj,selected='',placeholder='請選擇'){let h=placeholder?`<option value="">${placeholder}</option>`:'';Object.entries(obj).forEach(([v,l])=>{h+=`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`;});return h;}
};

function initDefaultAccounts(){
  if(DB.getUsers().length>0)return;
  DB.setUsers([
    {id:1,username:'admin',  password:'admin123',  displayName:'系統管理員',role:'admin',  createdAt:new Date().toISOString()},
    {id:2,username:'teacher',password:'teacher123',displayName:'示範老師',  role:'teacher',createdAt:new Date().toISOString()},
    {id:3,username:'student',password:'student123',displayName:'示範學生',  role:'student',createdAt:new Date().toISOString()}
  ]);
}
initDefaultAccounts();

function nav(page){
  const pages={dashboard:'dashboard.html',import:'import.html',questions:'questions.html',
    compose:'compose.html',manual:'manual.html',coded:'coded.html',exams:'exams.html',
    classes:'classes.html',results:'results.html',settings:'settings.html',take:'take.html','my-results':'my-results.html',
    textbooks:'textbooks.html'};
  if(pages[page])window.location.href=pages[page];
}

// ── 課本快取（全域，供 import/questions/compose/manual 使用）──────
window._tbCache = null;

window.initTextbookCache = async function() {
  if (window._tbCache) return window._tbCache;
  await window._dsReady;
  window._tbCache = await DataService.loadTextbookCache();
  return window._tbCache;
};

// 快取輔助函式
window.tbSubjectOptions = function(selectedCode = '') {
  if (!window._tbCache) return '<option value="">（讀取中）</option>';
  let h = '<option value="">請選擇科目</option>';
  for (const s of window._tbCache.subjects) {
    h += `<option value="${s.code}" ${selectedCode === s.code ? 'selected' : ''}>${s.name}</option>`;
  }
  return h;
};

window.tbBookOptions = function(subjectCode, selectedCode = '') {
  if (!window._tbCache) return '<option value="">（讀取中）</option>';
  const subj = window._tbCache.subjectByCode[subjectCode];
  if (!subj) return '<option value="">請先選科目</option>';
  const books = window._tbCache.booksBySubject[subj.id] || [];
  let h = '<option value="">請選擇冊別</option>';
  for (const b of books) {
    h += `<option value="${b.code}" ${selectedCode === b.code ? 'selected' : ''}>${b.name}</option>`;
  }
  return h;
};

window.tbSubjectName = function(subjectCode) {
  return window._tbCache?.subjectByCode?.[subjectCode]?.name || subjectCode || '—';
};

window.tbBookName = function(bookCode) {
  return window._tbCache?.books?.[bookCode]?.name || bookCode || '—';
};
