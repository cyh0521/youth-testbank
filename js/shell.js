/**
 * 在 Firebase 驗證前同步繪製導覽外框，避免多頁切換時側欄空白。
 * sessionStorage 只保存導覽外觀的角色提示，絕不用於權限判斷。
 * 每頁仍由 auth-guard.js 驗證真實使用者與存取權限。
 */
(() => {
  const ROLE_KEY = 'youth.shellRole';
  const COLLAPSED_KEY = 'sidebarCollapsed';
  const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, value); } catch { /* Storage may be unavailable. */ } };
  const activePage = () => location.pathname.split('/').pop().replace(/\.html$/, '');
  const isCollapsed = () => {
    const saved = read('localStorage', COLLAPSED_KEY);
    return saved === null ? matchMedia('(max-width: 760px)').matches : saved === '1';
  };

  function applyCollapsed(collapsed, remember = false) {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    if (remember) write('localStorage', COLLAPSED_KEY, collapsed ? '1' : '0');
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
      const label = collapsed ? '展開側邊欄' : '收合側邊欄';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  }

  function mount(role, active = activePage()) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const navRole = role === 'admin' ? 'admin' : 'teacher';
    if (el.dataset.navRole !== navRole) {
      const I = window.ICONS || {};
      const item = (page, icon, label) => `<a class="nav-item" href="${page}.html" data-page="${page}" title="${label}"><span class="icon">${icon || ''}</span><span class="nav-label">${label}</span></a>`;
      const section = label => `<div class="nav-section-title"><span class="nav-label">${label}</span></div>`;
      const brandIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></svg>';
      el.innerHTML = `
        <div class="sidebar-top">
          <button class="sidebar-brand-toggle" id="sidebarToggle" type="button" aria-controls="sidebarNav">${brandIcon}</button>
          <div class="sidebar-logo"><h1 class="nav-label">幼獅文化</h1><span class="nav-label">線上命題系統</span></div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav" aria-label="主要導覽">
          ${item('dashboard', I.home20, '首頁總覽')}
          ${navRole === 'admin' ? section('題庫管理') + item('textbooks', I.book20, '課本管理') + item('import', I.upload20, '題目匯入') + item('questions', I.list20, '題目維護') : ''}
          ${section('出題管理')}
          ${item('compose', I.auto20, '電腦選題')}
          ${item('manual', I.edit20, '手動選題')}
          ${item('coded', I.code20, '編碼選題')}
          ${item('exams', I.folder20, '試卷管理')}
          ${section('系統設定')}
          ${item('settings', I.settings20, '帳號與設定')}
        </nav>
        <div class="sidebar-footer">
          <p class="sidebar-note nav-label">陪伴老師<br>讓每一次出題更簡單</p>
          <button class="logout-btn" id="logoutBtn" aria-label="登出" title="登出" disabled>${I.logout18 || '⬅'}<span class="nav-label">登出</span></button>
        </div>`;
      el.dataset.navRole = navRole;
      document.getElementById('sidebarToggle').addEventListener('click', () => {
        applyCollapsed(!document.documentElement.classList.contains('sidebar-collapsed'), true);
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('確定要登出嗎？')) window.DataService.logout();
      });
    }
    el.querySelectorAll('[data-page]').forEach(link => {
      const selected = link.dataset.page === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    applyCollapsed(isCollapsed());
  }

  function confirmUser(user, active) {
    write('sessionStorage', ROLE_KEY, user.role);
    mount(user.role, active);
    document.documentElement.classList.add('auth-ready');
    const main = document.querySelector('.main');
    if (main) main.inert = false;
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.disabled = false;
  }

  function clear() {
    try { sessionStorage.removeItem(ROLE_KEY); } catch { /* No cached shell. */ }
    document.documentElement.classList.remove('auth-ready');
  }

  window.AppShell = { mount, confirmUser, clear };
  mount(read('sessionStorage', ROLE_KEY));
  // 靜態版面先顯示，資料操作等真實登入驗證後才啟用。
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('.main');
    if (main) main.inert = !document.documentElement.classList.contains('auth-ready');
  });
})();
