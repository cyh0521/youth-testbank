/**
 * 幼獅題庫系統 — 共用 SVG 圖示
 * =====================================================
 * 使用方式：
 *   <script src="js/icons.js"></script>
 *   element.innerHTML = ICONS.home;
 *   或取出固定大小：ICONS.home16, ICONS.home20, ICONS.home24
 *
 * 所有圖示為 stroke-only 線條風格（lucide-style），
 * 預設 24x24，stroke-width 2，使用 currentColor。
 * =====================================================
 */
(function() {
  const svg = (path, size = 24) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

  // ── lucide-style 路徑定義 ──
  const PATHS = {
    printer:    '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/><path d="M18 12h.01"/>',
    home:       '<path d="M3 9.5L12 2l9 7.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5z"/>',
    book:       '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    list:       '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    edit:       '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    image:      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    auto:       '<path d="M9.66 17h4.68"/><path d="M12 3v1"/><path d="m18.36 5.64-.7.7"/><path d="M21 12h-1"/><path d="M4 12H3"/><path d="m6.34 5.64.7.7"/><path d="M8.46 14.46a5 5 0 1 1 7.08 0l-.55.55A3.37 3.37 0 0 0 14 17.47V18a2 2 0 0 1-4 0v-.53a3.37 3.37 0 0 0-.99-2.46l-.55-.55z"/>',
    folder:     '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    chart:      '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    school:     '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    settings:   '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    logout:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash:      '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    search:     '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    close:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    user:       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:      '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    test:       '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    clock:      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check:      '<polyline points="20 6 9 17 4 12"/>',
    refresh:    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    code:       '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    layers:     '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    sparkles:   '<path d="m12 3-1.9 5.8L4 10l5.8 1.9L12 18l1.9-5.8L20 10l-5.8-1.9z"/><path d="M5 18l-.7 1.4L3 20l1.3.6L5 22l.7-1.4L7 20l-1.3-.6z"/><path d="M19 16l-.7 1.4L17 18l1.3.6L19 20l.7-1.4L21 18l-1.3-.6z"/>',
    award:      '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    info:       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    tool:       '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    menu:       '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    hash:       '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  };

  // 側邊欄專用圖示，統一圓角線條。編碼選題以題號清單表示。
  const NAV_PATHS = {
    navHome: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    navTextbooks: '<path d="M12 6.5c-2.8-1.8-5.7-2-9-1.2v14c3.3-.8 6.2-.6 9 1.2 2.8-1.8 5.7-2 9-1.2v-14c-3.3-.8-6.2-.6-9 1.2z"/><path d="M12 6.5v14"/>',
    navImport: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    navQuestions: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="m2 6 1.5 1.5L6 4.5m-4 7.5 1.5 1.5L6 10.5m-4 7.5 1.5 1.5L6 16.5"/>',
    navAuto: '<path d="M4 7h3c4 0 6 10 10 10h3m-3-3 3 3-3 3M4 17h3c1.5 0 2.8-1.4 4-3m2-4c1.2-1.6 2.5-3 4-3h3m-3-3 3 3-3 3"/>',
    navManual: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="m5 7 1.5 1.5L9 5.5M14 7h7M3 17h7m4 0h7"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    navNumber: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 1-1v5m-1 0h2m4-3a2 2 0 0 1 4 0c0 1-1 1.5-4 3h4M7 17h10"/>',
    navBooklet: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    navExams: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M8 12h8M8 16h6"/>',
    navSettings: '<path d="M4 6h3m4 0h9M4 12h10m4 0h2M4 18h4m4 0h8"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    navAccounts: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3zM17 5a3 3 0 0 1 0 6m2 9h2v-2a5 5 0 0 0-4-4.9"/>',
  };

  // 對外提供
  const ICONS = {};
  for (const [k, p] of Object.entries(PATHS)) {
    ICONS[k]   = svg(p, 24);
    ICONS[k+'16'] = svg(p, 16);
    ICONS[k+'18'] = svg(p, 18);
    ICONS[k+'20'] = svg(p, 20);
  }
  for (const [name, path] of Object.entries(NAV_PATHS)) {
    ICONS[name + '20'] = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }
  window.ICONS = ICONS;
})();
