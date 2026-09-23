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
  updateDoc, deleteDoc, query, where,
  serverTimestamp, writeBatch, Timestamp,
  runTransaction, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged,
  setPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
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
const accountCreationApp  = initializeApp(firebaseConfig, 'accountCreation');
const accountCreationAuth = getAuth(accountCreationApp);

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
              DataService._currentUser = null;
            }
          } catch(e) {
            console.warn('讀取使用者資料失敗', e);
            DataService._currentUser = null;
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
    window.AppShell?.clear();
    window.location.href = 'index.html';
  },

  // ── 帳號：由管理員建立工作人員 ────────────────
  async register({ email, password, displayName, role, school, _adminCreate }) {
    if (!_adminCreate || !DataService.isAdmin()) return { ok: false, msg: '權限不足' };
    if (!['admin', 'teacher'].includes(role)) return { ok: false, msg: '不支援的帳號身份' };
    try {
      // 使用獨立 Auth instance 建立帳號，避免管理員目前的登入狀態被切換。
      const cred = await createUserWithEmailAndPassword(accountCreationAuth, email, password);
      const userData = {
        email, displayName, role,
        school: school || null,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      await signOut(accountCreationAuth);
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

  // 尚未設定時顯示完整題庫；設定後只顯示勾選的科目與冊別。
  getVisibleCatalog() {
    const value = DataService._currentUser?.visibleCatalog;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  },
  isSubjectVisible(subjectCode) {
    const catalog = DataService.getVisibleCatalog();
    return !catalog || Object.prototype.hasOwnProperty.call(catalog, subjectCode);
  },
  isBookVisible(subjectCode, bookCode) {
    const catalog = DataService.getVisibleCatalog();
    return !catalog || (Array.isArray(catalog[subjectCode]) && catalog[subjectCode].includes(bookCode));
  },
  isCatalogItemVisible(item) {
    if (!DataService.isSubjectVisible(item.subjectCode)) return false;
    return !item.bookCode || DataService.isBookVisible(item.subjectCode, item.bookCode);
  },
  async getVisibleSubjects() {
    return (await DataService.getSubjects()).filter(s => DataService.isSubjectVisible(s.code));
  },
  async getVisibleBooks(subjectId, subjectCode) {
    const books = await DataService.getBooks(subjectId);
    return subjectCode ? books.filter(b => DataService.isBookVisible(subjectCode, b.code)) : books;
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
    return qs.filter(item => DataService.isCatalogItemVisible(item));
  },

  // ── 依 ID 陣列取得題目（並行讀取，節省 round-trip）──
  async getQuestionsByIds(ids = []) {
    if (!ids.length) return [];
    const docs = await Promise.all(
      ids.map(id => getDoc(doc(db, 'questions', id)))
    );
    return docs
      .filter(d => d.exists())
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(item => DataService.isCatalogItemVisible(item));
  },

  // ── 取得並遞增題目流水號（transaction 保證並發安全）──
  async _nextSeqNums(count) {
    const counterRef = doc(db, 'settings', 'questionCounter');
    let startNum = 0;
    try {
      startNum = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists() ? (snap.data().current || 0) : 0;
        tx.set(counterRef, { current: current + count }, { merge: true });
        return current;
      });
    } catch (e) {
      console.warn('流水號 transaction 失敗，改用時間戳替代', e);
      startNum = Date.now() % 99000;
    }
    return Array.from({ length: count }, (_, i) =>
      String(startNum + i + 1).padStart(5, '0')
    );
  },

  // ── 批次新增題目（匯入用，含自動流水號 + stats 同步）──
  async addQuestions(questions) {
    const BATCH_SIZE = 400;
    const seqNums = await DataService._nextSeqNums(questions.length);
    let count = 0;
    // 累計本次匯入的 stats 增量
    const delta = { total: 0, byType: {}, bySubject: {}, byDifficulty: {} };
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
        delta.total++;
        delta.byType[q.type] = (delta.byType[q.type]||0) + 1;
        delta.bySubject[q.subjectCode] = (delta.bySubject[q.subjectCode]||0) + 1;
        const d = q.difficulty || '';
        delta.byDifficulty[d] = (delta.byDifficulty[d]||0) + 1;
      });
      await batch.commit();
      count += chunk.length;
    }
    // 一次更新 stats（用 increment 累加）
    await DataService._applyStatsDelta(delta);
    return count;
  },

  // ── 新增單題 ──────────────────────────────────
  async addQuestion(q) {
    const ref = await addDoc(collection(db, 'questions'), { ...q, createdAt: serverTimestamp() });
    await DataService._applyStatsDelta({
      total: 1,
      byType:       { [q.type]: 1 },
      bySubject:    { [q.subjectCode]: 1 },
      byDifficulty: { [q.difficulty || '']: 1 },
    });
    return ref.id;
  },

  // ── 更新題目 ──────────────────────────────────
  async updateQuestion(id, data) {
    await updateDoc(doc(db, 'questions', id), { ...data, updatedAt: serverTimestamp() });
  },

  // ── 清除所有題目（批次刪除 + stats 歸零）──────────
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
    // stats 全歸零
    await setDoc(doc(db, 'settings', 'questionStats'),
      { total: 0, byType: {}, bySubject: {}, byDifficulty: {}, updatedAt: serverTimestamp() });
    return docs.length;
  },

  async deleteQuestion(id) {
    // 先讀題目資料以取得 type/subjectCode/difficulty 用來遞減 stats
    let q = null;
    try {
      const snap = await getDoc(doc(db, 'questions', id));
      if (snap.exists()) q = snap.data();
    } catch(e) { /* ignore */ }
    await deleteDoc(doc(db, 'questions', id));
    if (q) {
      await DataService._applyStatsDelta({
        total: -1,
        byType:       { [q.type]: -1 },
        bySubject:    { [q.subjectCode]: -1 },
        byDifficulty: { [q.difficulty || '']: -1 },
      });
    }
  },

  // ── Stats Aggregation —————————————————————————————————
  // 將增量套用到 settings/questionStats 文件（用 dot-notation 增減）
  async _applyStatsDelta(delta) {
    if (!delta || !delta.total) return;
    const ref = doc(db, 'settings', 'questionStats');
    const payload = {
      total:     increment(delta.total),
      updatedAt: serverTimestamp()
    };
    for (const [k, v] of Object.entries(delta.byType||{}))       payload[`byType.${k}`]       = increment(v);
    for (const [k, v] of Object.entries(delta.bySubject||{}))    payload[`bySubject.${k}`]    = increment(v);
    for (const [k, v] of Object.entries(delta.byDifficulty||{})) payload[`byDifficulty.${k||'_blank'}`] = increment(v);
    try {
      await updateDoc(ref, payload);
    } catch(e) {
      // 文件不存在 → 改用 setDoc 初始化
      if (e.code === 'not-found' || e.message?.includes('No document')) {
        await DataService.rebuildQuestionStats();
      } else {
        console.warn('更新 stats 失敗', e);
      }
    }
  },

  // ── 取得題目統計（從 aggregation 文件，1 次讀取）──
  async getQuestionStats() {
    try {
      const snap = await getDoc(doc(db, 'settings', 'questionStats'));
      if (snap.exists()) {
        const data = snap.data();
        // 還原 byDifficulty 中 '_blank' → ''
        const byDifficulty = {};
        for (const [k, v] of Object.entries(data.byDifficulty||{})) {
          byDifficulty[k === '_blank' ? '' : k] = v;
        }
        return {
          total:        data.total || 0,
          byType:       data.byType || {},
          bySubject:    data.bySubject || {},
          byDifficulty,
        };
      }
    } catch(e) { console.warn('讀取 stats 文件失敗', e); }
    // 找不到 → 只有管理員可以即時重建
    if (DataService.isAdmin()) {
      try {
        return await DataService.rebuildQuestionStats();
      } catch(e) { console.warn('重建 stats 失敗', e); }
    }
    // 一般使用者：回空值，避免阻塞
    return { total: 0, byType: {}, bySubject: {}, byDifficulty: {} };
  },

  // ── 重建題目統計（掃全表，僅在初始化或修復時使用）──
  async rebuildQuestionStats() {
    const snap = await getDocs(collection(db, 'questions'));
    const qs = docsToArr(snap);
    const s = { total: qs.length, byType: {}, bySubject: {}, byDifficulty: {} };
    qs.forEach(q => {
      s.byType[q.type]                          = (s.byType[q.type]||0) + 1;
      s.bySubject[q.subjectCode]                = (s.bySubject[q.subjectCode]||0) + 1;
      const d = q.difficulty || '_blank';
      s.byDifficulty[d]                          = (s.byDifficulty[d]||0) + 1;
    });
    await setDoc(doc(db, 'settings', 'questionStats'),
      { ...s, updatedAt: serverTimestamp() });
    // 回傳時還原 _blank
    const byDifficulty = {};
    for (const [k, v] of Object.entries(s.byDifficulty)) {
      byDifficulty[k === '_blank' ? '' : k] = v;
    }
    return { ...s, byDifficulty };
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
    const source = DataService.isAdmin()
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('createdBy', '==', DataService._currentUser?.uid));
    const snap = await getDocs(source);
    const arr = docsToArr(snap);
    arr.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return arr.filter(item => DataService.isCatalogItemVisible(item));
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

  async changePassword(currentPassword, newPassword) {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email || firebaseUser.uid !== DataService._currentUser?.uid) {
      throw new Error('登入狀態已失效，請重新登入');
    }
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
    await reauthenticateWithCredential(firebaseUser, credential);
    await updatePassword(firebaseUser, newPassword);
  },

  // ══════════════════════════════════════════════
  //  班級分類（僅供教師整理試卷，不含學生名單或成績）
  // ══════════════════════════════════════════════

  async getClasses() {
    const source = DataService.isAdmin()
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('teacherUid', '==', DataService._currentUser?.uid));
    const snap = await getDocs(source);
    return docsToArr(snap).sort((a, b) =>
      `${a.school || ''}\u0000${a.name || ''}`.localeCompare(`${b.school || ''}\u0000${b.name || ''}`, 'zh-Hant')
    );
  },

  async saveClass(classData) {
    if (classData.id) {
      const { id, teacherUid: _teacherUid, createdAt: _createdAt, ...data } = classData;
      await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() });
      return id;
    }
    const { id: _id, ...data } = classData;
    const ref = await addDoc(collection(db, 'classes'), {
      ...data,
      teacherUid: DataService._currentUser?.uid,
      teacherName: DataService._currentUser?.displayName || DataService._currentUser?.email || '',
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async deleteClass(id) {
    await deleteDoc(doc(db, 'classes', id));
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
    const subjects = await DataService.getVisibleSubjects();
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
      const books = await DataService.getVisibleBooks(s.id, s.code);
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
