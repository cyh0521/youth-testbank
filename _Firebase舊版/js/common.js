// ============================================================
//  幼獅題庫系統 — 共用工具函式
// ============================================================

import { auth, db } from './firebase-config.js';
import {
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── 角色顯示名 ──────────────────────────────────────────────
export const ROLE_LABEL = { admin: '管理員', teacher: '教師', student: '學生' };

// ── 取得當前使用者資料（Firestore users/{uid}）──────────────
export async function getCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { resolve(null); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      resolve(snap.exists() ? { uid: user.uid, ...snap.data() } : null);
    });
  });
}

// ── 頁面守衛：未登入跳轉，可限定角色 ──────────────────────
export async function requireAuth(allowedRoles = null) {
  const user = await getCurrentUser();
  if (!user) { location.href = 'index.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    location.href = 'index.html'; return null;
  }
  return user;
}

// ── 渲染側欄 ───────────────────────────────────────────────
export function renderSidebar(user, activePage) {
  const initials = (user.name || '?').slice(0, 2);
  const role = user.role;

  // 依角色決定可見選單
  const commonItems = [
    { href: 'dashboard.html', icon: iconHome, label: '首頁總覽', page: 'dashboard' },
  ];
  const adminTeacher = [
    { href: 'questions.html', icon: iconDB,      label: '題目維護',   page: 'questions' },
    { href: 'import.html',    icon: iconImport,  label: '題目匯入',   page: 'import' },
    { href: 'compose.html',   icon: iconAuto,    label: '電腦選題',   page: 'compose' },
    { href: 'manual.html',    icon: iconHand,    label: '人工選題',   page: 'manual' },
    { href: 'exams.html',     icon: iconExam,    label: '試卷管理',   page: 'exams' },
    { href: 'results.html',   icon: iconChart,   label: '成績查詢',   page: 'results' },
  ];
  const adminOnly = [
    { href: 'settings.html',  icon: iconSettings,label: '帳號管理',   page: 'settings' },
  ];
  const studentItems = [
    { href: 'my-exams.html',  icon: iconExam,    label: '我的考試',   page: 'my-exams' },
    { href: 'my-results.html',icon: iconChart,   label: '我的成績',   page: 'my-results' },
  ];

  let navSections = '';

  if (role === 'student') {
    navSections = renderSection('', [...commonItems, ...studentItems], activePage);
  } else if (role === 'teacher') {
    navSections = renderSection('', [...commonItems, ...adminTeacher], activePage);
  } else { // admin
    navSections = renderSection('', commonItems, activePage)
      + renderSection('題庫作業', adminTeacher, activePage)
      + renderSection('系統管理', adminOnly, activePage);
  }

  document.querySelector('.sidebar').innerHTML = `
    <div class="sidebar-logo">
      <h1>幼獅題庫</h1>
      <span>YOUTH TESTBANK</span>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="info">
        <div class="name">${escHtml(user.name)}</div>
        <div class="role">${ROLE_LABEL[role] || role}</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navSections}</nav>
    <div class="sidebar-bottom">
      <button class="nav-item" id="btn-logout">
        ${iconLogout} 登出
      </button>
    </div>
  `;

  document.getElementById('btn-logout').onclick = async () => {
    await signOut(auth);
    location.href = 'index.html';
  };
}

function renderSection(label, items, activePage) {
  const labelHtml = label ? `<div class="nav-section-label">${label}</div>` : '';
  const links = items.map(i => `
    <a href="${i.href}" class="nav-item${activePage === i.page ? ' active' : ''}">
      ${i.icon} ${i.label}
    </a>`).join('');
  return labelHtml + links;
}

// ── Toast 通知 ─────────────────────────────────────────────
export function toast(msg, type = 'default', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = Object.assign(document.createElement('div'), { id: 'toast-container' });
    document.body.appendChild(container);
  }
  const el = Object.assign(document.createElement('div'), {
    className: `toast${type !== 'default' ? ' ' + type : ''}`,
    textContent: msg
  });
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── HTML 轉義 ──────────────────────────────────────────────
export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 格式化日期 ────────────────────────────────────────────
export function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ── SVG 圖示（共用） ──────────────────────────────────────
export const iconHome = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6h-6v6H3.75A.75.75 0 013 21V9.75z"/></svg>`;
export const iconDB = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path stroke-linecap="round" d="M3 5v5c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/><path stroke-linecap="round" d="M3 10v5c0 1.657 4.03 3 9 3s9-1.343 9-3v-5"/><path stroke-linecap="round" d="M3 15v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4"/></svg>`;
export const iconImport = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v13m0 0l-4-4m4 4l4-4"/></svg>`;
export const iconAuto = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
export const iconHand = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/></svg>`;
export const iconExam = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
export const iconChart = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
export const iconSettings = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>`;
export const iconLogout = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`;
export const iconPlus = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`;
export const iconEdit = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;
export const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
export const iconSearch = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`;
export const iconClose = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
export const iconKey = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>`;
export const iconUser = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;
