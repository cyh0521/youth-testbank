/**
 * 幼獅題庫系統 — 頁面守衛（Firebase 版）
 * 每個需要登入的頁面在 <script type="module"> 頂端引入：
 *   import { guardPage, renderSidebar } from './js/auth-guard.js';
 *   await guardPage();                          // 只需登入
 *   await guardPage(['admin']);                 // 限管理員
 *   await guardPage(['admin','teacher']);       // 管理員或教師
 */
import './firebase.js';

export async function guardPage(allowedRoles) {
  await window._dsReady;
  const user = DataService.getCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = 'dashboard.html'; return null;
  }
  // 渲染側邊欄
  const el = document.getElementById('sidebar');
  if (el) renderSidebar(el, window._activeNav || '');
  return user;
}

export function renderSidebar(el, active) {
  const user = DataService.getCurrentUser();
  if (!user) return;
  const ROLES = { admin:{label:'管理員',icon:'🛡️'}, teacher:{label:'教師',icon:'🎓'}, student:{label:'學生',icon:'🧑‍🎓'} };
  const ri  = ROLES[user.role] || ROLES.student;
  const ini = (user.displayName || user.email || '?')[0].toUpperCase();

  const nav = (page, icon, label) =>
    `<div class="nav-item ${active===page?'active':''}" onclick="nav('${page}')"><span class="icon">${icon}</span>${label}</div>`;

  const adminNav = `
    <div class="nav-section-title">題庫管理</div>
    ${nav('textbooks','📚','課本管理')}${nav('import','📥','題目匯入')}${nav('questions','📋','題目維護')}`;

  const staffNav = `
    <div class="nav-section-title">出題管理</div>
    ${nav('compose','✏️','電腦選題')}${nav('manual','✦','手動選題')}${nav('coded','🔢','編碼選題')}${nav('exams','📁','試卷管理')}
    <div class="nav-section-title">班級管理</div>
    ${nav('classes','🏫','班級管理')}
    <div class="nav-section-title">成績管理</div>
    ${nav('results','📊','成績查詢')}
    <div class="nav-section-title">系統設定</div>
    ${nav('settings','⚙️','帳號與設定')}` ;

  const studentNav = `
    <div class="nav-section-title">線上考試</div>
    ${nav('take','📝','參加考試')}${nav('my-results','📊','我的成績')}
    <div class="nav-section-title">班級</div>
    ${nav('classes','🏫','我的班級')}
    <div class="nav-section-title">設定</div>
    ${nav('settings','⚙️','帳號設定')}` ;

  const navMap = { admin: adminNav + staffNav, teacher: staffNav, student: studentNav };

  el.innerHTML = `
    <div class="sidebar-logo"><h1>幼獅題庫系統</h1><span>線上版 v2.0 Firebase</span></div>
    <div class="sidebar-user">
      <div class="avatar">${ini}</div>
      <div class="user-info">
        <div class="user-name">${user.displayName || user.email}</div>
        <div class="user-role">${ri.icon} ${ri.label}</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${nav('dashboard','🏠','首頁總覽')}
      ${navMap[user.role] || studentNav}
    </nav>
    <div class="sidebar-footer">
      <button class="logout-btn" id="logoutBtn"><span>⬅</span> 登出</button>
    </div>`;

  document.getElementById('logoutBtn').onclick = () => DataService.logout();

  // Mark page as ready (removes opacity:0 from .main)
  requestAnimationFrame(() => {
    document.querySelector('.main')?.classList.add('ready');
  });
}
