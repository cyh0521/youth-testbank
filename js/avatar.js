/** 個人頭像：內建插畫與輕量的自訂圖片。 */
(() => {
  const presetSheet = new URL('../images/avatars/people-presets-v1.png', document.currentScript?.src || new URL('js/avatar.js', location.href)).href;
  const extraSheet = new URL('people-presets-extra-v1.png', presetSheet).href;
  const options = [
    { id: 'female-1', label: '女性頭像・短髮', gender: 'female', crop: [60,44,278] },
    { id: 'female-2', label: '女性頭像・長髮瀏海', gender: 'female', crop: [350,44,278] },
    { id: 'female-3', label: '女性頭像・長直髮', gender: 'female', crop: [644,44,278] },
    { id: 'female-4', label: '女性頭像・馬尾', gender: 'female', crop: [932,44,278] },
    { id: 'female-5', label: '女性頭像・丸子頭圓框眼鏡', gender: 'female', crop: [60,368,278] },
    { id: 'female-6', label: '女性頭像・俐落短髮', gender: 'female', crop: [350,368,278] },
    { id: 'female-7', label: '女性頭像・捲髮眼鏡', gender: 'female', crop: [644,368,278] },
    { id: 'female-8', label: '女性頭像・短髮眼鏡', gender: 'female', crop: [932,368,278] },
    { id: 'female-9', label: '女性頭像・辮髮眼鏡', gender: 'female', crop: [26,30,580], sheet: extraSheet, dimensions: [1254,1254] },
    { id: 'female-10', label: '女性頭像・短捲髮', gender: 'female', crop: [650,30,580], sheet: extraSheet, dimensions: [1254,1254] },
    { id: 'male-1', label: '男性頭像・側分短髮', gender: 'male', crop: [62, 694, 262] },
    { id: 'male-2', label: '男性頭像・平頭', gender: 'male', crop: [345, 694, 264] },
    { id: 'male-3', label: '男性頭像・短髮眼鏡', gender: 'male', crop: [633, 694, 272] },
    { id: 'male-4', label: '男性頭像・中分', gender: 'male', crop: [931, 694, 270] },
    { id: 'male-5', label: '男性頭像・自然捲', gender: 'male', crop: [60, 990, 266] },
    { id: 'male-6', label: '男性頭像・平頭圓框眼鏡', gender: 'male', crop: [345, 990, 264] },
    { id: 'male-7', label: '男性頭像・俐落短髮', gender: 'male', crop: [636, 990, 270] },
    { id: 'male-8', label: '男性頭像・成熟灰髮', gender: 'male', crop: [932, 990, 268] },
    { id: 'male-9', label: '男性頭像・側分眼鏡', gender: 'male', crop: [26,650,580], sheet: extraSheet, dimensions: [1254,1254] },
    { id: 'male-10', label: '男性頭像・光頭', gender: 'male', crop: [645,650,580], sheet: extraSheet, dimensions: [1254,1254] },
  ];
  const byId = new Map(options.map(option => [option.id, option]));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const isUpload = value => typeof value === 'string' && value.length <= 240000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);

  function illustration(p) {
    const [x,y,size] = p.crop;
    const [width,height] = p.dimensions || [1268,1241];
    // One fixed circular viewport; slightly inset the source crop to exclude
    // the comparison sheet's ivory margin and antialiased circle edge.
    const side = size * (p.gender === 'male' ? .90 : .94);
    const left = Math.max(0, Math.min(width-side, x + (size-side)/2));
    // The last row of the original sheet ends at the image boundary.
    // Keep the entire viewport inside the asset and above its pale lower rim.
    const top = Math.max(0, Math.min(height-side, y + (size-side)/2 - (p.gender === 'male' ? 6 : 0)));
    const bx = left/(width-side)*100, by = top/(height-side)*100;
    return `<span aria-hidden="true" style="display:block;width:100%;height:100%;border-radius:50%;background-image:url('${p.sheet || presetSheet}');background-size:${width/side*100}% ${height/side*100}%;background-position:${bx}% ${by}%;background-repeat:no-repeat"></span>`;
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
