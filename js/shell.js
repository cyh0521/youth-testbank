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
  const activePage = () => {
    const page = location.pathname.split('/').pop().replace(/\.html$/, '');
    if (page !== 'settings') return page;
    const view = new URLSearchParams(location.search).get('view');
    return view === 'accounts' ? 'account-admin' : 'settings';
  };
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

  function confirmLogout() {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'logoutDialogTitle');
    overlay.setAttribute('aria-describedby', 'logoutDialogMessage');
    overlay.innerHTML = `<div class="modal" style="max-width:440px">
      <div class="modal-header"><h3 id="logoutDialogTitle">確認登出</h3><button class="modal-close" type="button" data-choice="cancel" aria-label="關閉">✕</button></div>
      <div class="modal-body"><p id="logoutDialogMessage">確定要離開幼獅線上命題系統嗎？</p></div>
      <div class="modal-footer"><button class="btn btn-ghost" type="button" data-choice="cancel">取消</button><button class="btn btn-primary" type="button" data-choice="logout">登出</button></div>
    </div>`;
    const buttons = [...overlay.querySelectorAll('button')];
    const close = confirmed => {
      overlay.remove();
      if (confirmed) window.DataService.logout();
      else previousFocus?.focus?.();
    };
    overlay.addEventListener('click', event => {
      const choice = event.target.closest('[data-choice]')?.dataset.choice;
      if (choice) close(choice === 'logout');
      else if (event.target === overlay) close(false);
    });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(false); }
      if (event.key === 'Tab' && ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons.at(-1)))) {
        event.preventDefault();
        (event.shiftKey ? buttons.at(-1) : buttons[0]).focus();
      }
    });
    document.body.appendChild(overlay);
    overlay.querySelector('[data-choice="cancel"]').focus();
  }

  function mount(role, active = activePage()) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const navRole = role === 'admin' || role === 'manager' ? 'admin' : 'teacher';
    if (el.dataset.navRole !== navRole) {
      const I = window.ICONS || {};
      const item = (page, icon, label, href = `${page}.html`) => `<a class="nav-item" href="${href}" data-page="${page}" title="${label}"><span class="icon">${icon || ''}</span><span class="nav-label">${label}</span></a>`;
      const section = label => `<div class="nav-section-title"><span class="nav-label">${label}</span></div>`;
      const brandIcon = '<img src="img/youth.png" alt="" aria-hidden="true" draggable="false">';
      el.innerHTML = `
        <div class="sidebar-top">
          <button class="sidebar-brand-toggle" id="sidebarToggle" type="button" aria-controls="sidebarNav">
            <span class="sidebar-brand-main"><span class="sidebar-brand-mark">${brandIcon}</span><strong class="sidebar-brand-name">幼獅文化</strong></span>
            <span class="sidebar-brand-subtitle">線上命題系統</span>
          </button>
        </div>
        <nav class="sidebar-nav" id="sidebarNav" aria-label="主要導覽">
          ${item('dashboard', I.navHome20, '首頁總覽')}
          ${navRole === 'admin' ? section('題庫管理') + item('textbooks', I.navTextbooks20, '課本管理') + item('import', I.navImport20, '題目匯入') + item('questions', I.navQuestions20, '題目維護') : ''}
          ${section('出題管理')}
          ${item('compose', I.navAuto20, '電腦選題')}
          ${item('manual', I.navManual20, '手動選題')}
          ${item('coded', I.navNumber20, '編碼選題')}
          ${item('booklet', I.navBooklet20, '題本列印')}
          ${item('exams', I.navExams20, '試卷管理')}
          ${section('系統設定')}
          ${item('settings', I.navSettings20, '進階設定')}
          ${navRole === 'admin' ? item('account-admin', I.navAccounts20, '帳號管理', 'settings.html?view=accounts') : ''}
        </nav>
        <div class="sidebar-footer">
          <button class="nav-item logout-btn" id="logoutBtn" type="button" aria-label="登出" title="登出" disabled><span class="icon">${I.logout20 || '⬅'}</span><span class="nav-label">登出</span></button>
        </div>`;
      el.dataset.navRole = navRole;
      document.getElementById('sidebarToggle').addEventListener('click', () => {
        applyCollapsed(!document.documentElement.classList.contains('sidebar-collapsed'), true);
      });
      document.getElementById('logoutBtn').addEventListener('click', confirmLogout);
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
