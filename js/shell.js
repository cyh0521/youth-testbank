/**
 * 在 Firebase 驗證前同步繪製導覽外框，避免多頁切換時側欄空白。
 * sessionStorage 只保存導覽外觀的角色提示，絕不用於權限判斷。
 * 每頁仍由 auth-guard.js 驗證真實使用者與存取權限。
 */
(() => {
  const ROLE_KEY = 'youth.shellRole';
  const ACCOUNT_KEY = 'youth.shellAccount';
  const AVATAR_URL = new URL('avatar.js', document.currentScript.src).href;
  const avatarReady = window.Avatar ? Promise.resolve() : import(AVATAR_URL);
  const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, value); } catch { /* Storage may be unavailable. */ } };
  const activePage = () => {
    const page = location.pathname.split('/').pop().replace(/\.html$/, '');
    if (page !== 'settings') return page;
    const view = new URLSearchParams(location.search).get('view');
    return view === 'accounts' ? 'account-admin' : 'settings';
  };

  function enhanceTopbar() {
    const topbar = document.querySelector('.topbar');
    const title = topbar?.querySelector('.topbar-title');
    if (!title || topbar.querySelector('.topbar-heading')) return;

    const descriptions = {
      dashboard: '查看題庫與試卷的最新狀態',
      textbooks: '管理科目、冊別與課本章節',
      import: '依步驟上傳並確認題目資料',
      questions: '搜尋、檢視與編輯題庫內容',
      compose: '設定條件，從題庫自動組卷',
      manual: '依科目與範圍挑選題目',
      coded: '輸入題目編號，快速建立試卷',
      booklet: '準備題本與列印內容',
      exams: '查找與管理已建立的試卷',
      settings: '管理個人資訊與系統偏好',
      'account-admin': '管理系統使用者與帳號權限'
    };
    const heading = document.createElement('div');
    heading.className = 'topbar-heading';
    const h1 = document.createElement('h1');
    h1.className = title.className;
    if (title.id) h1.id = title.id;
    h1.textContent = title.textContent;
    heading.appendChild(h1);
    const description = descriptions[activePage()];
    if (description) {
      const subtitle = document.createElement('p');
      subtitle.className = 'topbar-subtitle';
      subtitle.textContent = description;
      heading.appendChild(subtitle);
    }
    title.replaceWith(heading);
    topbar.querySelector('.topbar-breadcrumb')?.remove();
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

  function closeAccountMenu(returnFocus = false) {
    const menu = document.getElementById('accountMenu');
    const toggle = document.getElementById('toolbarAccount');
    if (!menu || !toggle || menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '開啟帳號選單');
    if (returnFocus) toggle.focus();
  }

  function accountSnapshot(user) {
    return {
      uid: user.uid,
      role: user.role,
      displayName: user.displayName || '',
      nickname: user.nickname || '',
      email: user.email || '',
      avatar: user.avatar || ''
    };
  }

  function cachedAccount() {
    try {
      const user = JSON.parse(read('sessionStorage', ACCOUNT_KEY));
      if (!user || typeof user.uid !== 'string' || !['admin', 'manager', 'teacher'].includes(user.role) ||
          typeof user.displayName !== 'string' || typeof user.email !== 'string' ||
          (user.nickname != null && typeof user.nickname !== 'string') ||
          typeof user.avatar !== 'string' || user.avatar.length > 240000 ||
          user.role !== read('sessionStorage', ROLE_KEY)) return null;
      return user;
    } catch { return null; }
  }

  function renderAccount(user) {
    const topbar = document.getElementById('siteAccount') || document.querySelector('.topbar');
    if (!topbar || !user) return;

    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      topbar.appendChild(actions);
    }
    let greeting = actions.querySelector('#welcomeText');
    if (!greeting) {
      greeting = document.createElement('span');
      greeting.id = 'welcomeText';
      greeting.className = 'text-sm text-muted';
      actions.prepend(greeting);
    }
    const name = (user.nickname?.trim() || user.displayName || user.email?.split('@')[0] || '').trim().replace(/\s*老師$/, '');
    const title = user.role === 'teacher' ? `${name ? `${name} ` : ''}老師` : name;
    greeting.textContent = activePage() === 'dashboard' ? `歡迎回來，${title}` : title;
    let account = actions.querySelector('.toolbar-account');
    if (!account) {
      account = document.createElement('div');
      account.className = 'toolbar-account';
      account.innerHTML = `<button class="toolbar-account-toggle" type="button" id="toolbarAccount" aria-label="開啟帳號選單" aria-expanded="false" aria-controls="accountMenu"></button>
        <div class="account-menu" id="accountMenu" hidden>
          <a href="settings.html" id="accountProfile">${window.ICONS?.user16 || ''}<span>個人資訊</span><span class="account-role" id="accountRole"></span></a>
          <button type="button" id="accountLogout">${window.ICONS?.logout16 || ''}<span>登出</span></button>
        </div>`;
      actions.appendChild(account);
      const toggle = account.querySelector('#toolbarAccount');
      const menu = account.querySelector('#accountMenu');
      toggle.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
        toggle.setAttribute('aria-label', opening ? '關閉帳號選單' : '開啟帳號選單');
        if (opening) account.querySelector('#accountProfile').focus();
      });
      account.querySelector('#accountLogout').addEventListener('click', () => {
        closeAccountMenu();
        confirmLogout();
      });
      document.addEventListener('pointerdown', event => {
        if (!account.contains(event.target)) closeAccountMenu();
      });
      document.addEventListener('focusin', event => {
        if (!account.contains(event.target)) closeAccountMenu();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
          event.preventDefault();
          closeAccountMenu(true);
        }
      });
    }
    const roleBadge = account.querySelector('#accountRole');
    roleBadge.textContent = { admin: '主要管理員', manager: '管理員', teacher: '教師' }[user.role] || '';
    roleBadge.className = `account-role account-role--${user.role}`;
    const toggle = account.querySelector('#toolbarAccount');
    if (toggle._avatarValue !== user.avatar) {
      toggle.innerHTML = window.Avatar.markup(user.avatar, user.displayName || user.email, 'user-avatar--toolbar');
      toggle._avatarValue = user.avatar;
    }
  }

  async function refreshAccount(user) {
    if (!user || !document.documentElement.classList.contains('auth-ready')) return;
    write('sessionStorage', ACCOUNT_KEY, JSON.stringify(accountSnapshot(user)));
    await avatarReady;
    if (document.documentElement.classList.contains('auth-ready')) renderAccount(user);
  }

  function mount(role, active = activePage()) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const navRole = role === 'admin' || role === 'manager' ? 'admin' : 'teacher';
    document.documentElement.classList.remove('sidebar-collapsed');
    document.documentElement.classList.add('ui-redesign');
    el.className = 'site-header';
    if (el.dataset.navRole !== navRole) {
      const I = window.ICONS || {};
      const previousAccount = el.querySelector('#siteAccount');
      const item = (page, icon, label, href = `${page}.html`) => `<a href="${href}" data-page="${page}">${icon ? `<span class="site-nav-icon">${icon}</span>` : ''}<span>${label}</span></a>`;
      const group = (label, contents) => `<details class="site-nav-group"><summary>${label}</summary><div class="site-nav-menu">${contents}</div></details>`;
      el.innerHTML = `
        <a class="site-brand" href="dashboard.html"><span class="site-brand-mark" aria-hidden="true"><span class="brand-tiles"><i></i><i></i><i></i></span></span><strong>幼獅<span class="brand-name-accent">線上命題</span></strong></a>
        <nav class="site-nav" aria-label="主要導覽">
          ${item('dashboard', '', '首頁')}
          ${group('出題與列印',item('compose',I.navAuto20,'電腦選題')+item('manual',I.navManual20,'手動選題')+item('coded',I.navNumber20,'編碼選題')+item('booklet',I.navBooklet20,'題本列印'))}
          ${item('exams', '', '試卷管理')}
          ${navRole === 'admin' ? group('題庫管理',item('textbooks',I.navTextbooks20,'課本管理')+item('import',I.navImport20,'題目匯入')+item('questions',I.navQuestions20,'題目維護')) : ''}
          ${navRole === 'admin' ? group('設定',item('settings',I.navSettings20,'進階設定')+item('account-admin',I.navAccounts20,'帳號管理','settings.html?view=accounts')) : item('settings','','設定')}
        </nav>
        <div id="siteAccount" class="site-account"></div>`;
      if (previousAccount) el.querySelector('#siteAccount').replaceChildren(...previousAccount.childNodes);
      el.querySelector('#siteAccount').inert = !document.documentElement.classList.contains('auth-ready');
      el.dataset.navRole = navRole;
      el.querySelectorAll('.site-nav-group').forEach(group => {
        group.addEventListener('pointerenter',event=>{
          if(event.pointerType==='touch'||!matchMedia('(hover: hover)').matches)return;
          el.querySelectorAll('.site-nav-group').forEach(other=>{other.open=other===group;});
        });
        group.addEventListener('pointerleave',()=>{if(!group.contains(document.activeElement))group.open=false;});
        group.addEventListener('focusout',event=>{if(!group.contains(event.relatedTarget)&&!group.matches(':hover'))group.open=false;});
      });
      if (!el._navigationEvents) {
        el._navigationEvents = true;
        el.addEventListener('toggle',event=>{
          if(event.target.matches('.site-nav-group[open]'))el.querySelectorAll('.site-nav-group').forEach(group=>{if(group!==event.target)group.open=false;});
        },true);
        document.addEventListener('pointerdown',event=>{if(!el.contains(event.target))el.querySelectorAll('.site-nav-group').forEach(group=>group.open=false);});
        el.addEventListener('keydown',event=>{if(event.key==='Escape'){const group=event.target.closest('.site-nav-group');if(group){group.open=false;group.querySelector('summary').focus();}}});
      }
    }
    el.querySelectorAll('[data-page]').forEach(link => {
      const selected = link.dataset.page === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    el.querySelectorAll('.site-nav-group').forEach(group=>group.classList.toggle('active',!!group.querySelector('a.active')));
  }

  function confirmUser(user, active) {
    write('sessionStorage', ROLE_KEY, user.role);
    mount(user.role, active);
    document.documentElement.classList.add('auth-ready');
    const main = document.querySelector('.main');
    if (main) main.inert = false;
    document.getElementById('siteAccount').inert = false;
    refreshAccount(user);
  }

  function clear() {
    try {
      sessionStorage.removeItem(ROLE_KEY);
      sessionStorage.removeItem(ACCOUNT_KEY);
    } catch { /* No cached shell. */ }
    document.documentElement.classList.remove('auth-ready');
  }

  window.AppShell = { mount, confirmUser, clear, confirmLogout, refreshAccount };
  mount(read('sessionStorage', ROLE_KEY));
  // 靜態版面先顯示，資料操作等真實登入驗證後才啟用。
  document.addEventListener('DOMContentLoaded', () => {
    enhanceTopbar();
    document.querySelectorAll('.topbar .topbar-actions').forEach(actions=>actions.remove());
    const main = document.querySelector('.main');
    if (main) main.inert = !document.documentElement.classList.contains('auth-ready');
    const cached = cachedAccount();
    if (cached) avatarReady.then(() => {
      if (!document.documentElement.classList.contains('auth-ready')) renderAccount(cached);
    }).catch(() => {});
  });
})();
