/**
 * 幼獅題庫系統 — Firebase 資料層 v1.0
 * =====================================================
 * 所有頁面只透過 DataService 存取資料，不直接碰 Firebase。
 * 未來換成 PHP+MySQL 時，只需替換本檔案，其他頁面不變。
 * =====================================================
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  getDocsFromServer,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  serverTimestamp, writeBatch, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged,
  setPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── Firebase 設定 ──────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAESI-xumpIXZTymeKHNnJMhBwZ5V6OQiQ",
  authDomain:        "youth-testbank.firebaseapp.com",
  projectId:         "youth-testbank",
  storageBucket:     "youth-testbank.firebasestorage.app",
  messagingSenderId: "703759738861",
  appId:             "1:703759738861:web:6e6e75eca40f67d808e9e4",
  measurementId:     "G-2M825SFLJK"
};

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const auth    = getAuth(app);
const storage = getStorage(app);

// 設定 Session 持久性：關閉瀏覽器分頁後登入狀態失效
setPersistence(auth, browserSessionPersistence).catch(e => console.warn('Auth persistence error:', e));

// ── 工具函式 ───────────────────────────────────────
function ts2str(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
  return ts;
}
function docToObj(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: snap.id, ...d, createdAt: ts2str(d.createdAt), updatedAt: ts2str(d.updatedAt) };
}
function docsToArr(snap) {
  return snap.docs.map(d => docToObj(d));
}

// ══════════════════════════════════════════════════
//  DataService — 所有頁面使用的統一介面
// ══════════════════════════════════════════════════
window.DataService = {

  // ── 初始化（頁面載入時呼叫）──────────────────────
  async init() {
    return new Promise(resolve => {
      // unsubscribe 確保只觸發一次
      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        unsub(); // 取消後續監聽，避免重複觸發
        if (firebaseUser) {
          // 從 Firestore 讀使用者資料（await 確保完成後才 resolve）
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (snap.exists()) {
              DataService._currentUser = { uid: firebaseUser.uid, ...snap.data() };
            } else {
              DataService._currentUser = { uid: firebaseUser.uid, email: firebaseUser.email, role: 'student' };
            }
          } catch(e) {
            console.warn('讀取使用者資料失敗', e);
            DataService._currentUser = { uid: firebaseUser.uid, email: firebaseUser.email, role: 'student' };
          }
        } else {
          DataService._currentUser = null;
        }
        resolve(DataService._currentUser);
      });
    });
  },

  _currentUser: null,

  getCurrentUser() { return DataService._currentUser; },
  isLoggedIn()     { return !!DataService._currentUser; },
  isAdmin()        { return DataService._currentUser?.role === 'admin'; },
  isTeacher()      { return DataService._currentUser?.role === 'teacher'; },
  isStudent()      { return DataService._currentUser?.role === 'student'; },
  isStaff()        { const r = DataService._currentUser?.role; return r === 'admin' || r === 'teacher'; },

  // ── 帳號：登入 ────────────────────────────────
  async login(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) return { ok: false, msg: '使用者資料不存在' };
      DataService._currentUser = { uid: cred.user.uid, ...snap.data() };
      return { ok: true, user: DataService._currentUser };
    } catch(e) {
      const msg = {
        'auth/user-not-found':  '帳號不存在',
        'auth/wrong-password':  '密碼錯誤',
        'auth/invalid-email':   '電子信箱格式錯誤',
        'auth/too-many-requests':'嘗試次數過多，請稍後再試',
        'auth/invalid-credential': '帳號或密碼錯誤',
      }[e.code] || e.message;
      return { ok: false, msg };
    }
  },

  // ── 帳號：登出 ────────────────────────────────
  async logout() {
    await signOut(auth);
    DataService._currentUser = null;
    window.location.href = 'index.html';
  },

  // ── 帳號：註冊 ────────────────────────────────
  // _adminCreate=true 時略過驗證碼，由管理員直接建立帳號
  async register({ email, password, displayName, role, regCode, school, _adminCreate }) {
    // 驗證身份驗證碼（管理員建立時略過）
    if (!_adminCreate) {
      const codeSnap = await getDoc(doc(db, 'settings', 'regCodes'));
      const codes = codeSnap.exists() ? codeSnap.data() : { admin: 'admin2024', teacher: 'teacher2024' };
      if (role !== 'student') {
        if (!regCode || regCode !== codes[role]) return { ok: false, msg: '身份驗證碼錯誤' };
      }
    } else {
      // 管理員建立：驗證碼必須是 admin2024（避免前端偽造）
      if (regCode !== 'admin2024') {
        if (!DataService.isAdmin()) return { ok: false, msg: '權限不足' };
      }
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const userData = {
        email, displayName, role,
        school: school || null,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      // 管理員建立時，不覆蓋目前登入狀態
      if (!_adminCreate) {
        DataService._currentUser = { uid: cred.user.uid, email, displayName, role, school: school||null };
      }
      return { ok: true, user: { uid: cred.user.uid, ...userData } };
    } catch(e) {
      const msg = {
        'auth/email-already-in-use': '此電子信箱已被使用',
        'auth/weak-password':        '密碼強度不足（至少6字元）',
        'auth/invalid-email':        '電子信箱格式錯誤',
      }[e.code] || e.message;
      return { ok: false, msg };
    }
  },

  // ── 帳號：取得所有使用者（管理員用）────────────
  async getUsers() {
    const snap = await getDocs(collection(db, 'users'));
    // id 欄位即為 Firebase UID，方便前端使用
    return snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, uid: d.id, ...data, createdAt: ts2str(data.createdAt), updatedAt: ts2str(data.updatedAt) };
    });
  },

  async deleteUser(uid) {
    await deleteDoc(doc(db, 'users', uid));
    // 注意：Firebase Auth 帳號需從 Firebase Console 或 Admin SDK 刪除
  },

  // ── 帳號：修改個人資料 ────────────────────────
  async updateProfile(uid, data) {
    // 過濾 null 值要存，但允許 null 清空欄位
    const payload = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'users', uid), payload);
    if (DataService._currentUser?.uid === uid) {
      Object.assign(DataService._currentUser, data);
    }
  },

  // ── 驗證碼管理 ────────────────────────────────
  async getRegCodes() {
    const snap = await getDoc(doc(db, 'settings', 'regCodes'));
    return snap.exists() ? snap.data() : { admin: 'admin2024', teacher: 'teacher2024' };
  },
  async setRegCode(role, code) {
    const codes = await DataService.getRegCodes();
    codes[role] = code;
    await setDoc(doc(db, 'settings', 'regCodes'), codes);
  },

  // ══════════════════════════════════════════════
  //  題目管理
  // ══════════════════════════════════════════════

  // ── 查詢題目（含篩選）────────────────────────
  async getQuestions(opts = {}) {
    let q = collection(db, 'questions');
    const constraints = [];
    if (opts.subjectCode) constraints.push(where('subjectCode', '==', opts.subjectCode));
    if (opts.bookCode)    constraints.push(where('bookCode',    '==', opts.bookCode));
    if (opts.type)        constraints.push(where('type',        '==', opts.type));
    if (opts.difficulty)  constraints.push(where('difficulty',  '==', opts.difficulty));
    if (opts.qnum)        constraints.push(where('qnum',        '==', opts.qnum));
    // orderBy removed: Firestore requires composite index for where+orderBy
    // Sorting is done client-side instead
    const snap = await getDocs(constraints.length ? query(q, ...constraints) : q);
    let qs = docsToArr(snap);
    // 章節篩選（在記憶體做，Firestore 不支援複合陣列查詢）
    if (opts.chapters && opts.chapters.length) {
      qs = qs.filter(q => opts.chapters.some(c => {
        const p = c.split('-').map(Number);  // 統一轉數字比對
        // 相容舊資料（chapterNum 可能是數字或零填充字串如 "01"）
        const eq = (a, b) => Number(a) === Number(b);
        if (p.length === 1) return eq(q.chapterNum, p[0]);
        if (p.length === 2) return eq(q.chapterNum, p[0]) && eq(q.sectionNum, p[1]);
        return eq(q.chapterNum, p[0]) && eq(q.sectionNum, p[1]) && eq(q.subsectionNum, p[2]);
      }));
    }
    if (opts.keyword) {
      const kw = opts.keyword.toLowerCase();
      qs = qs.filter(q => (q.text||'').includes(kw) || (q.answer||'').includes(kw));
    }
    return qs;
  },

  // ── 依 ID 陣列取得題目（只讀需要的題目，節省讀取次數）──
  async getQuestionsByIds(ids = []) {
    if (!ids.length) return [];
    // Firestore 每次 in 查詢最多 30 筆，分批處理
    const BATCH = 30;
    const results = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const snap = await getDocs(query(
        collection(db, 'questions'),
        where('__name__', 'in', batch.map(id => doc(db, 'questions', id)))
      ));
      // __name__ in 不支援，改用個別 getDoc
      // 改用 Promise.all + getDoc
    }
    // 用 Promise.all 批次 getDoc（每個 ID 一次讀取，但是並行）
    const docs = await Promise.all(
      ids.map(id => getDoc(doc(db, 'questions', id)))
    );
    return docs
      .filter(d => d.exists())
      .map(d => ({ id: d.id, ...d.data() }));
  },

  // ── 取得並遞增題目流水號（transaction 保證不衝突）──
  async _nextSeqNums(count) {
    const counterRef = doc(db, 'settings', 'questionCounter');
    let startNum = 0;
    await (async () => {
      // 用簡單的 get + set（非嚴格 transaction，足夠單一管理員使用）
      try {
        const snap = await getDoc(counterRef);
        startNum = snap.exists() ? (snap.data().current || 0) : 0;
        await setDoc(counterRef, { current: startNum + count }, { merge: true });
      } catch(e) {
        console.warn('流水號取得失敗，使用時間戳替代', e);
        startNum = Date.now() % 99000; // fallback
      }
    })();
    return Array.from({ length: count }, (_, i) =>
      String(startNum + i + 1).padStart(5, '0')
    );
  },

  // ── 批次新增題目（匯入用，含自動流水號）──────
  async addQuestions(questions) {
    const BATCH_SIZE = 400;
    // 取得流水號
    const seqNums = await DataService._nextSeqNums(questions.length);
    let count = 0;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = questions.slice(i, i + BATCH_SIZE);
      chunk.forEach((q, idx) => {
        const ref = doc(collection(db, 'questions'));
        batch.set(ref, {
          ...q,
          qnum: seqNums[i + idx],
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      count += chunk.length;
    }
    return count;
  },

  // ── 新增單題 ──────────────────────────────────
  async addQuestion(q) {
    const ref = await addDoc(collection(db, 'questions'), { ...q, createdAt: serverTimestamp() });
    return ref.id;
  },

  // ── 更新題目 ──────────────────────────────────
  async updateQuestion(id, data) {
    await updateDoc(doc(db, 'questions', id), { ...data, updatedAt: serverTimestamp() });
  },

  // ── 刪除題目 ──────────────────────────────────
  // ── 清除所有題目（批次刪除）──────────────────────
  async deleteAllQuestions(onProgress) {
    const snap = await getDocs(collection(db, 'questions'));
    const docs = snap.docs;
    const BATCH_SIZE = 400;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(doc(db, 'questions', d.id)));
      await batch.commit();
      deleted = Math.min(i + BATCH_SIZE, docs.length);
      if (onProgress) onProgress(deleted, docs.length);
    }
    return docs.length;
  },

  async deleteQuestion(id) {
    await deleteDoc(doc(db, 'questions', id));
  },

  // ── 取得題目統計 ──────────────────────────────
  async getQuestionStats() {
    const snap = await getDocs(collection(db, 'questions'));
    const qs = docsToArr(snap);
    const s = { total: qs.length, byType: {}, bySubject: {}, byDifficulty: {} };
    qs.forEach(q => {
      s.byType[q.type]           = (s.byType[q.type]||0) + 1;
      s.bySubject[q.subjectCode] = (s.bySubject[q.subjectCode]||0) + 1;
      s.byDifficulty[q.difficulty||''] = (s.byDifficulty[q.difficulty||'']||0) + 1;
    });
    return s;
  },

  // ── 取得章節結構 ──────────────────────────────
  async getChapters(subjectCode, bookCode) {
    const qs = await DataService.getQuestions({ subjectCode, bookCode });
    const chapters = {};
    qs.forEach(q => {
      const chap = q.chapterNum; const sec = q.sectionNum;
      if (!chap) return;
      if (!chapters[chap]) chapters[chap] = { num: chap, sections: {} };
      if (sec && !chapters[chap].sections[sec]) chapters[chap].sections[sec] = { num: sec };
    });
    return chapters;
  },

  // ── 亂數取題（含難易加權）────────────────────
  async randomWithDifficulty(opts, diffLevel, count, type) {
    const pool = await DataService.getQuestions({ ...opts, type });
    const cfg = COMPOSE_DIFFICULTY[diffLevel] || COMPOSE_DIFFICULTY.medium;
    if (!cfg.weights) return [...pool].sort(() => Math.random() - .5).slice(0, count);
    const buckets = { '◎': [], '': [], '△': [] };
    pool.forEach(q => { const d = q.difficulty||''; if (d in buckets) buckets[d].push(q); });
    Object.values(buckets).forEach(b => b.sort(() => Math.random() - .5));
    const result = []; const w = cfg.weights;
    ['◎','','△'].forEach(d => {
      const want = Math.round(w[d] * count);
      result.push(...buckets[d].slice(0, Math.min(want, buckets[d].length)));
    });
    if (result.length < count) {
      const used = new Set(result.map(q => q.id));
      const rest = pool.filter(q => !used.has(q.id)).sort(() => Math.random() - .5);
      result.push(...rest.slice(0, count - result.length));
    }
    return result.slice(0, count);
  },

  // ══════════════════════════════════════════════
  //  圖片管理（Firebase Storage）
  // ══════════════════════════════════════════════

  // ── 上傳圖片 ──────────────────────────────────
  async uploadImage(file, path) {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const ref  = storageRef(storage, `${path || 'questions'}/${name}`);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    return { url, path: ref.fullPath };
  },

  // ── 刪除圖片 ──────────────────────────────────
  async deleteImage(fullPath) {
    try { await deleteObject(storageRef(storage, fullPath)); } catch(e) { /* 已刪除則忽略 */ }
  },

  // ══════════════════════════════════════════════
  //  試卷管理
  // ══════════════════════════════════════════════

  async getExams() {
    const snap = await getDocs(collection(db, 'exams'));
    const arr = docsToArr(snap);
    arr.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return arr;
  },

  async saveExam(exam) {
    if (exam.id && !exam.id.startsWith('_new')) {
      // 更新
      const { id, ...data } = exam;
      await updateDoc(doc(db, 'exams', id), { ...data, updatedAt: serverTimestamp() });
      return id;
    } else {
      // 新增
      const { id: _id, ...data } = exam;
      const ref = await addDoc(collection(db, 'exams'), { ...data, createdBy: DataService._currentUser?.uid, createdAt: serverTimestamp() });
      return ref.id;
    }
  },

  async deleteExam(id) {
    await deleteDoc(doc(db, 'exams', id));
  },

  // ══════════════════════════════════════════════
  //  成績管理
  // ══════════════════════════════════════════════

  async getResults(opts = {}) {
    // No orderBy with where to avoid composite index requirement — sort client-side
    const constraints = [];
    if (opts.studentUid) constraints.push(where('studentUid', '==', opts.studentUid));
    if (opts.examId)     constraints.push(where('examId',     '==', opts.examId));
    const snap = await getDocs(constraints.length
      ? query(collection(db, 'results'), ...constraints)
      : collection(db, 'results'));
    const arr = docsToArr(snap);
    // Sort by submittedAt descending (client-side)
    arr.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });
    return arr;
  },

  async saveResult(result) {
    // 取得試卷資訊，記錄所屬班級和出題教師
    let examClassIds = [];
    let examCreatedBy = null;
    if (result.examId) {
      try {
        const examSnap = await getDoc(doc(db, 'exams', result.examId));
        if (examSnap.exists()) {
          const examData = examSnap.data();
          examClassIds = examData.classIds || [];
          examCreatedBy = examData.createdBy || null;
        }
      } catch(e) { /* ignore */ }
    }
    
    const ref = await addDoc(collection(db, 'results'), {
      ...result,
      studentUid:  DataService._currentUser?.uid,
      studentName: DataService._currentUser?.displayName,
      classIds:    examClassIds,      // 記錄考試所屬班級
      examCreatedBy: examCreatedBy,   // 記錄出題教師
      submittedAt: serverTimestamp()
    });
    return ref.id;
  },

  // ══════════════════════════════════════════════
  //  班級管理
  // ══════════════════════════════════════════════

  // 產生 6 碼教室代碼（大寫英數，排除易混淆字元）
  _genRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  async getClasses(opts = {}) {
    try {
      const constraints = [];
      if (opts.teacherUid) constraints.push(where('teacherUid', '==', opts.teacherUid));
      const snap = await getDocs(constraints.length
        ? query(collection(db, 'classes'), ...constraints)
        : collection(db, 'classes'));
      return docsToArr(snap);
    } catch(e) {
      if (e.code === 'permission-denied') {
        // Firestore rules may not include 'classes' yet — return empty and warn
        console.warn('Classes permission denied. Please update Firestore rules.');
        return [];
      }
      throw e;
    }
  },

  async saveClass(cls) {
    if (cls.id) {
      const { id, ...data } = cls;
      await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() });
      return id;
    } else {
      // 產生唯一教室代碼
      let roomCode, tries = 0;
      while (tries++ < 10) {
        roomCode = DataService._genRoomCode();
        const existing = await getDocs(query(collection(db, 'classes'), where('roomCode', '==', roomCode)));
        if (existing.empty) break;
      }
      const ref = await addDoc(collection(db, 'classes'), {
        ...cls,
        roomCode,
        teacherUid:  DataService._currentUser?.uid,
        teacherName: DataService._currentUser?.displayName,
        createdAt:   serverTimestamp()
      });
      return ref.id;
    }
  },

  async deleteClass(id) {
    await deleteDoc(doc(db, 'classes', id));
  },

  // 學生加入班級（用教室代碼）
  async joinClassByCode(roomCode) {
    const snap = await getDocs(query(collection(db, 'classes'), where('roomCode', '==', roomCode.toUpperCase())));
    if (snap.empty) return { ok: false, msg: '找不到此教室代碼，請確認是否正確' };
    const cls = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const uid = DataService._currentUser?.uid;
    if (!uid) return { ok: false, msg: '請先登入' };
    // 加入班級成員
    const memberRef = doc(db, 'classes', cls.id, 'members', uid);
    await setDoc(memberRef, {
      uid,
      displayName: DataService._currentUser?.displayName,
      joinedAt:    serverTimestamp()
    });
    // 同時在 users 裡記錄 classIds
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const existing = userSnap.exists() ? (userSnap.data().classIds || []) : [];
    if (!existing.includes(cls.id)) {
      await updateDoc(userRef, { classIds: [...existing, cls.id] });
    }
    return { ok: true, cls };
  },

  // 取得班級成員
  async getClassMembers(classId) {
    const snap = await getDocs(collection(db, 'classes', classId, 'members'));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  // 取得學生所屬班級
  async getMyClasses() {
    const uid = DataService._currentUser?.uid;
    if (!uid) return [];
    const snap = await getDocs(query(collection(db, 'classes'), where('memberUids', 'array-contains', uid)));
    // Fallback: check user's classIds
    const userSnap = await getDoc(doc(db, 'users', uid));
    const classIds = userSnap.exists() ? (userSnap.data().classIds || []) : [];
    if (!classIds.length) return [];
    const results = [];
    for (const cid of classIds) {
      const csnap = await getDoc(doc(db, 'classes', cid));
      if (csnap.exists()) results.push({ id: csnap.id, ...csnap.data() });
    }
    return results;
  },

  // ── 重置題目流水號計數器 ────────────────────────
  async resetQuestionCounter() {
    const counterRef = doc(db, 'settings', 'questionCounter');
    await setDoc(counterRef, { current: 0 });
  },

  // ── 課本管理 (textbooks)
  //  結構：textbooks/{id} → books 子集合 → chapters 子集合
  //  科目 (subject) → 冊別 (book) → 章節 (chapter/section/subsection)
  // ══════════════════════════════════════════════════

  // ── 科目 ──────────────────────────────────────────
  // ── 課本快取：一次讀取所有科目與冊別（供各頁面下拉選單使用）──
  async loadTextbookCache() {
    const subjects = await DataService.getSubjects();
    const cache = {
      subjects: [],          // [{id, code, name, order}]
      books: {},             // bookCode -> {id, subjectId, code, name, order, l1, l2, l3}
      booksBySubject: {},    // subjectId -> [{id, code, name, ...}]
      subjectByCode: {},     // subjectCode -> subject obj
      subjectById: {},       // subjectId   -> subject obj
    };
    for (const s of subjects) {
      cache.subjects.push(s);
      cache.subjectByCode[s.code] = s;
      cache.subjectById[s.id]     = s;
      cache.booksBySubject[s.id]  = [];
      const books = await DataService.getBooks(s.id);
      for (const b of books) {
        const entry = { ...b, subjectId: s.id };
        cache.books[b.code] = entry;
        cache.booksBySubject[s.id].push(entry);
      }
    }
    return cache;
  },

    async getSubjects() {
    const snap = await getDocs(collection(db, 'textbooks'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order||0) - (b.order||0));
  },

  async saveSubject(data) {
    // data: { id?, name, code, order }
    if (data.id) {
      const { id, ...rest } = data;
      await updateDoc(doc(db, 'textbooks', id), { ...rest, updatedAt: serverTimestamp() });
      return data.id;
    } else {
      const ref = await addDoc(collection(db, 'textbooks'), { ...data, createdAt: serverTimestamp() });
      return ref.id;
    }
  },

  async deleteSubject(subjectId) {
    // 刪除前先刪所有冊別（及其章節）
    const books = await DataService.getBooks(subjectId);
    for (const b of books) await DataService.deleteBook(subjectId, b.id);
    await deleteDoc(doc(db, 'textbooks', subjectId));
  },

  // ── 冊別 ──────────────────────────────────────────
  async getBooks(subjectId) {
    const snap = await getDocs(collection(db, 'textbooks', subjectId, 'books'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order||0) - (b.order||0));
  },

  async saveBook(subjectId, data) {
    // data: { id?, name, code, order }
    if (data.id) {
      const { id, ...rest } = data;
      await updateDoc(doc(db, 'textbooks', subjectId, 'books', id), { ...rest, updatedAt: serverTimestamp() });
      return data.id;
    } else {
      const ref = await addDoc(collection(db, 'textbooks', subjectId, 'books'), { ...data, createdAt: serverTimestamp() });
      return ref.id;
    }
  },

  async deleteBook(subjectId, bookId) {
    // 刪除前先刪所有章節
    const chapters = await DataService.getChapterDefs(subjectId, bookId);
    for (const c of chapters) await deleteDoc(doc(db, 'textbooks', subjectId, 'books', bookId, 'chapters', c.id));
    await deleteDoc(doc(db, 'textbooks', subjectId, 'books', bookId));
  },

  // ── 章節定義 ─────────────────────────────────────
  // 章節以 JSON 陣列方式儲存在 book 文件的 chapters 欄位，結構：
  // [ { num, title, sections: [ { num, title, subsections: [ { num, title } ] } ] } ]
  async getChapterDefs(subjectId, bookId) {
    const snap = await getDocsFromServer(collection(db, 'textbooks', subjectId, 'books', bookId, 'chapters'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.chapterNum||0) - (b.chapterNum||0));
  },

  async saveChapter(subjectId, bookId, data) {
    // data: { id?, chapterNum, title, sections: [{sectionNum, title, subsections:[...]}] }
    if (!subjectId || !bookId) throw new Error('subjectId or bookId is missing: '+subjectId+'/'+bookId);
    // Firestore does not accept undefined values — strip them
    function stripUndefined(obj) {
      return JSON.parse(JSON.stringify(obj, (k,v) => v === undefined ? null : v));
    }
    if (data.id) {
      const { id, ...rest } = data;
      await updateDoc(doc(db, 'textbooks', subjectId, 'books', bookId, 'chapters', id), { ...stripUndefined(rest), updatedAt: serverTimestamp() });
      return data.id;
    } else {
      const { id: _ignored, ...rest } = data;
      const ref = await addDoc(collection(db, 'textbooks', subjectId, 'books', bookId, 'chapters'), { ...stripUndefined(rest), createdAt: serverTimestamp() });
      return ref.id;
    }
  },

  async deleteChapter(subjectId, bookId, chapterId) {
    await deleteDoc(doc(db, 'textbooks', subjectId, 'books', bookId, 'chapters', chapterId));
  },

  // ── 快取：取得完整課本結構（供出題頁面使用）──────
  async getFullTextbook(subjectId, bookId) {
    const [subSnap, bookSnap, chapters] = await Promise.all([
      getDoc(doc(db, 'textbooks', subjectId)),
      getDoc(doc(db, 'textbooks', subjectId, 'books', bookId)),
      DataService.getChapterDefs(subjectId, bookId),
    ]);
    if (!subSnap.exists() || !bookSnap.exists()) return null;
    return {
      subject: { id: subjectId, ...subSnap.data() },
      book:    { id: bookId,    ...bookSnap.data() },
      chapters,
    };
  },
};

// ── 在頁面載入時自動初始化 ────────────────────────
window._dsReady = DataService.init();
