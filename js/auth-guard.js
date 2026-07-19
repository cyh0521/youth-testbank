/**
 * 幼獅題庫系統 — 頁面守衛 + 側欄渲染
 * =====================================================
 * 每個需要登入的頁面在 <script type="module"> 頂端引入：
 *   import { guardPage } from './js/auth-guard.js';
 *   await guardPage();                          // 只需登入
 *   await guardPage(['admin']);                 // 限管理員
 *   await guardPage(['admin','teacher']);       // 教師或管理員
 *
 * 此模組會自動：
 *   1. 等候 Firebase auth 初始化
 *   2. 未登入則跳轉 index.html
 *   3. 角色不符則跳轉 dashboard.html
 *   4. 渲染側邊欄（含收合功能）
 *   5. 將 .main 加上 .ready class 觸發淡入
 * =====================================================
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
  // 觸發主內容淡入
  requestAnimationFrame(() => {
    document.querySelector('.main')?.classList.add('ready');
  });
  return user;
}

// ── 收合狀態持久化 ──────────────────────────────
const COLLAPSED_KEY = 'sidebarCollapsed';

function isCollapsed() {
  return localStorage.getItem(COLLAPSED_KEY) === '1';
}

function applyCollapsed(collapsed) {
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
}

export function renderSidebar(el, active) {
  const user = DataService.getCurrentUser();
  if (!user) return;
  const I = window.ICONS || {};
  const ROLES = {
    admin:   { label:'管理員', cls:'role-admin' },
    teacher: { label:'教師',   cls:'role-teacher' },
    student: { label:'學生',   cls:'role-student' }
  };
  const ri  = ROLES[user.role] || ROLES.student;
  const ini = (user.displayName || user.email || '?')[0].toUpperCase();

  // nav-item：label 包在 <span class="nav-label"> 方便收合時隱藏
  const item = (page, icon, label) =>
    `<div class="nav-item ${active===page?'active':''}" onclick="nav('${page}')" title="${label}">
       <span class="icon">${icon || ''}</span><span class="nav-label">${label}</span>
     </div>`;

  // ── 教師/管理員共用（staffNav）──────────────
  //  「班級管理」+「成績管理」合併為「班級與成績」
  const adminNav = `
    <div class="nav-section-title"><span class="nav-label">題庫管理</span></div>
    ${item('textbooks', I.book20,   '課本管理')}
    ${item('import',    I.upload20, '題目匯入')}
    ${item('questions', I.list20,   '題目維護')}`;

  const staffNav = `
    <div class="nav-section-title"><span class="nav-label">出題管理</span></div>
    ${item('compose', I.auto20,   '電腦選題')}
    ${item('manual',  I.edit20,   '手動選題')}
    ${item('coded',   I.code20,   '編碼選題')}
    ${item('exams',   I.folder20, '試卷管理')}
    <div class="nav-section-title"><span class="nav-label">班級與成績</span></div>
    ${item('classes', I.school20, '班級管理')}
    ${item('results', I.chart20,  '成績查詢')}
    <div class="nav-section-title"><span class="nav-label">系統設定</span></div>
    ${item('settings',I.settings20,'帳號與設定')}`;

  const studentNav = `
    <div class="nav-section-title"><span class="nav-label">線上考試</span></div>
    ${item('take',       I.test20,  '參加考試')}
    ${item('my-results', I.chart20, '我的成績')}
    <div class="nav-section-title"><span class="nav-label">班級</span></div>
    ${item('classes',    I.school20,'我的班級')}
    <div class="nav-section-title"><span class="nav-label">設定</span></div>
    ${item('settings',   I.settings20,'帳號設定')}`;

  const navMap = {
    admin:   adminNav + staffNav,
    teacher: staffNav,
    student: studentNav
  };

  // 漢堡選單 icon
  const menuIcon = I.menu20 || '☰';

  el.innerHTML = `
    <div class="sidebar-top">
      <button class="sidebar-toggle" id="sidebarToggle" title="收合側欄">
        ${menuIcon}
      </button>
      <div class="sidebar-logo">
        <h1 class="nav-label">幼獅題庫系統</h1>
        <span class="nav-label">線上版 v2.1</span>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${ini}</div>
      <div class="user-info nav-label">
        <div class="user-name">${user.displayName || user.email}</div>
        <div class="user-role"><span class="role-badge ${ri.cls}">${ri.label}</span></div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${item('dashboard', I.home20, '首頁總覽')}
      ${navMap[user.role] || studentNav}
    </nav>
    <div class="sidebar-footer">
      <button class="logout-btn" id="logoutBtn">${I.logout18 || '⬅'}<span class="nav-label">登出</span></button>
    </div>`;

  // 事件綁定
  document.getElementById('logoutBtn').onclick = () => {
    if (confirm('確定要登出嗎？')) DataService.logout();
  };
  document.getElementById('sidebarToggle').onclick = () => {
    applyCollapsed(!isCollapsed());
  };

  // 還原收合狀態（safety net — 主要由 head 中的 inline script 處理以避免閃爍）
  if (isCollapsed()) {
    document.documentElement.classList.add('sidebar-collapsed');
  }
}
