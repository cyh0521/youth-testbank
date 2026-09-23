/** 個人頭像：內建插畫與輕量的自訂圖片。 */
(() => {
  const options = [
    { id: 'male-1', label: '男生頭像・藍色', gender: 'male', bg: '#dceafe', shirt: '#537fd0', hair: '#303d55', skin: '#efc5a6', style: 0 },
    { id: 'male-2', label: '男生頭像・綠色', gender: 'male', bg: '#dff2e9', shirt: '#50a487', hair: '#59453c', skin: '#dca783', style: 1 },
    { id: 'male-3', label: '男生頭像・紫色', gender: 'male', bg: '#eae5fa', shirt: '#846bb7', hair: '#36394b', skin: '#b87956', style: 2 },
    { id: 'female-1', label: '女生頭像・粉色', gender: 'female', bg: '#fce8ee', shirt: '#d87998', hair: '#513c43', skin: '#f1c7aa', style: 0 },
    { id: 'female-2', label: '女生頭像・黃色', gender: 'female', bg: '#fff1cf', shirt: '#d7a55f', hair: '#684d35', skin: '#dba17e', style: 1 },
    { id: 'female-3', label: '女生頭像・藍紫色', gender: 'female', bg: '#e2eafc', shirt: '#6d82c0', hair: '#2f354b', skin: '#a97558', style: 2 },
  ];
  const byId = new Map(options.map(option => [option.id, option]));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const isUpload = value => typeof value === 'string' && value.length <= 240000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);

  function illustration(p) {
    const longHair = p.gender === 'female'
      ? `<path d="M18 53V30c0-17 11-25 22-25s22 8 22 25v23l-10 8H28Z" fill="${p.hair}"/>`
      : '';
    const hair = p.gender === 'female'
      ? p.style === 1
        ? `<path d="M18 34c0-20 10-28 22-28 14 0 23 11 22 28-7-2-12-8-14-13-8 8-19 12-30 13Z" fill="${p.hair}"/>`
        : `<path d="M18 34C18 14 29 7 40 7s22 8 22 27c-6-3-11-8-14-13-6 8-17 12-30 13Z" fill="${p.hair}"/>`
      : p.style === 1
        ? `<path d="M19 32C16 17 27 9 39 9c14 0 23 8 22 23-7-7-12-9-19-8-7 1-15 4-23 8Z" fill="${p.hair}"/>`
        : `<path d="M19 31c-1-15 8-23 21-23 14 0 22 9 21 23-5-6-9-10-16-11-8 7-16 9-26 11Z" fill="${p.hair}"/>`;
    const glasses = p.style === 2
      ? '<g fill="none" stroke="#506174" stroke-width="1.7"><rect x="25" y="34" width="12" height="8" rx="4"/><rect x="43" y="34" width="12" height="8" rx="4"/><path d="M37 37h6"/></g>'
      : '';
    return `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="${p.bg}"/>${longHair}<path d="M5 81c2-17 14-26 35-26s33 9 35 26" fill="${p.shirt}"/><path d="M34 50h12v11c-3 3-9 3-12 0Z" fill="${p.skin}"/><ellipse cx="20" cy="38" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="60" cy="38" rx="4" ry="6" fill="${p.skin}"/><ellipse cx="40" cy="35" rx="20" ry="24" fill="${p.skin}"/>${hair}<path d="M29 35h4m14 0h4" stroke="#4a3e40" stroke-width="2" stroke-linecap="round"/><path d="M37 47c2 2 4 2 6 0" stroke="#9f625b" stroke-width="1.5" stroke-linecap="round"/>${glasses}</svg>`;
  }

  function markup(value, name = '', className = '') {
    const cls = `user-avatar${className ? ` ${escape(className)}` : ''}`;
    if (byId.has(value)) {
      const preset = byId.get(value);
      return `<span class="${cls}" role="img" aria-label="${preset.label}">${illustration(preset)}</span>`;
    }
    if (isUpload(value)) return `<span class="${cls}" role="img" aria-label="自訂頭像"><img src="${value}" alt=""></span>`;
    const outline = window.ICONS?.user || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>';
    return `<span class="${cls} user-avatar--outline" role="img" aria-label="預設線條頭像">${outline}</span>`;
  }

  async function prepareUpload(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 圖片');
    if (file.size > 5 * 1024 * 1024) throw new Error('圖片不能超過 5 MB');
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 192;
      const ctx = canvas.getContext('2d');
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 192, 192);
      let data = canvas.toDataURL('image/jpeg', .82);
      if (data.length > 200000) data = canvas.toDataURL('image/jpeg', .65);
      if (!isUpload(data)) throw new Error('圖片處理失敗，請改用較小的圖片');
      return data;
    } finally {
      bitmap.close();
    }
  }

  window.Avatar = { options, markup, prepareUpload };
})();
