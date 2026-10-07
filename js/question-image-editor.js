// GitHub Pages 圖片編輯：本地預覽，資料只保存相對路徑，圖片另行下載發布。
export function editorHtml(value) {
  return UI.questionText(value).split('\u2029').map(part =>
    `<div>${UI.questionInlineHtml(part).replace(/\n/g, '<br>') || '<br>'}</div>`).join('');
}

export function editorText(editor) {
  const inline = node => {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return '';
    if (node.tagName === 'BR') return '\n';
    if (node.tagName === 'IMG') {
      const path = UI.imagePath(node.dataset.questionImage);
      return path ? UI.imageMarker(path, node.getAttribute('width'), node.alt) : '';
    }
    return [...node.childNodes].map(inline).join('');
  };
  return [...editor.childNodes].map(node => {
    if (node.nodeType === 1 && /^(DIV|P)$/.test(node.tagName)) {
      const text = inline(node);
      const breaks = [...node.childNodes].filter(child => child.nodeName === 'BR');
      if (breaks.length === 1 && node.textContent === '' && !node.querySelector('img')) return '';
      return breaks.length >= 2 && node.lastChild?.nodeName === 'BR' ? text.slice(0, -1) : text;
    }
    return inline(node);
  }).join('\u2029').trim();
}

// ZIP 的 STORE 格式（圖片已壓縮），不依賴外部服務或 CDN。
export async function imageArchive(entries) {
  const encoder = new TextEncoder();
  const local = [], central = [];
  let offset = 0;
  for (const [path, blob] of entries) {
    const normalizedPath = UI.imagePath(path);
    if (!normalizedPath) throw new Error('圖片路徑不正確');
    const name = encoder.encode(normalizedPath);
    const data = new Uint8Array(await blob.arrayBuffer());
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(12, 33, true); // DOS 日期：1980-01-01
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    local.push(header, data);
    const directory = new Uint8Array(46 + name.length);
    const dir = new DataView(directory.buffer);
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(14, 33, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    offset += header.length + data.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, central.reduce((sum, entry) => sum + entry.length, 0), true);
  view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], {type:'application/zip'});
}

export function downloadArchive(blob, questionNumber) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(questionNumber || '題目').replace(/[<>:"/\\|?*]/g, '_')}-圖片.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export class QuestionImageEditor {
  constructor(editor, controls) {
    this.editor = editor;
    this.controls = controls;
    this.pending = new Map();
    this.range = null;
    this.selected = null;
    this.busy = false;
    this.closed = false;
    window.questionImagePreviews ||= new Map();
    controls.innerHTML = `<div class="question-image-toolbar">
      <button type="button" class="btn btn-outline" data-action="file">選擇圖片</button>
      <button type="button" class="btn btn-ghost" data-action="path">插入已上傳圖片</button>
      <input type="file" accept="image/png,image/jpeg" hidden data-file>
      <span class="question-image-status" role="status" aria-live="polite"></span>
    </div>
    <div class="question-image-path hidden"><label>圖片路徑<input class="form-control" data-path placeholder="images/example.png"></label><button type="button" class="btn btn-primary" data-action="insert">插入</button></div>
    <div class="question-image-settings hidden"><label>寬度（px）<input class="form-control" type="number" min="40" max="1200" step="10" data-width></label><label>圖片說明<input class="form-control" data-alt></label><button type="button" class="btn btn-ghost" data-action="remove">移除圖片</button></div>
    <div class="question-image-hint">圖片插入游標位置；點選圖片可調整大小。新增圖片會在儲存時下載，請解壓後將 images 資料夾內的圖片上傳到 GitHub 同名資料夾。</div>`;
    this.status = controls.querySelector('.question-image-status');
    this.settings = controls.querySelector('.question-image-settings');
    this.width = controls.querySelector('[data-width]');
    this.alt = controls.querySelector('[data-alt]');
    this.file = controls.querySelector('[data-file]');
    this.path = controls.querySelector('[data-path]');
    this.rememberRange = () => {
      const selection = window.getSelection();
      if (selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) this.range = selection.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', this.rememberRange);
    editor.addEventListener('click', event => this.selectImage(event.target.closest('img[data-question-image]')));
    editor.addEventListener('input', () => { if (this.selected && !editor.contains(this.selected)) this.selectImage(null); this.updateStatus(); });
    editor.addEventListener('paste', event => {
      // 外部 HTML 不帶入任意圖片或樣式；圖片一律經明確的圖片操作加入。
      event.preventDefault();
      this.insertText(event.clipboardData.getData('text/plain'));
    });
    editor.addEventListener('drop', event => event.preventDefault());
    controls.addEventListener('pointerdown', () => this.rememberRange());
    controls.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'file') this.file.click();
      if (action === 'path') {
        controls.querySelector('.question-image-path').classList.toggle('hidden');
        if (!controls.querySelector('.question-image-path').classList.contains('hidden')) this.path.focus();
      }
      if (action === 'insert') {
        const path = UI.imagePath(this.path.value);
        if (!path) { UI.toast('請輸入 images/ 開頭的 PNG 或 JPG 路徑，檔名請使用英數字、底線或連字號', 'warning'); return; }
        this.insertImage(path, 320, '題目圖片');
        controls.querySelector('.question-image-path').classList.add('hidden');
        this.path.value = '';
      }
      if (action === 'remove' && this.selected) {
        this.selected.remove(); this.selectImage(null); this.updateStatus(); editor.focus();
      }
    });
    this.file.addEventListener('change', async () => {
      if (!this.file.files[0] || this.busy) return;
      this.busy = true; this.status.textContent = '圖片處理中…';
      try { await this.addFile(this.file.files[0]); }
      catch (error) { if (!this.closed) UI.toast(error.message, 'danger'); }
      finally { this.busy = false; this.file.value = ''; this.updateStatus(); }
    });
    this.width.addEventListener('change', () => {
      if (!this.selected) return;
      const width = Math.max(40, Math.min(1200, Math.round(Number(this.width.value) || 320)));
      this.selected.width = width; this.width.value = width;
    });
    this.width.addEventListener('input', () => {
      const width = Number(this.width.value);
      if (this.selected && width >= 40 && width <= 1200) this.selected.width = Math.round(width);
    });
    this.alt.addEventListener('input', () => { if (this.selected) this.selected.alt = this.alt.value; });
    editor.querySelectorAll('img[data-question-image]').forEach(image => this.watchImage(image));
    this.updateStatus();
  }

  updateStatus() {
    if (this.closed || this.busy) return;
    const count = this.entries().length;
    this.status.textContent = count ? `${count} 張新圖片待下載及上傳` : '';
  }

  entries() {
    const used = new Set([...this.editor.querySelectorAll('img[data-question-image]')].map(image => image.dataset.questionImage));
    return [...this.pending].filter(([path]) => used.has(path));
  }

  selectImage(image) {
    this.selected?.classList.remove('is-selected');
    this.selected = image;
    this.settings.classList.toggle('hidden', !image);
    if (!image) return;
    image.classList.add('is-selected');
    this.width.value = image.getAttribute('width') || 320;
    this.alt.value = image.alt;
  }

  watchImage(image) {
    image.contentEditable = 'false';
    image.draggable = false;
    image.tabIndex = 0;
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); this.selectImage(image); this.width.focus();
      }
    });
    image.addEventListener('error', () => { image.classList.add('is-missing'); image.title = '找不到圖片，請確認已上傳至 GitHub，並等待網站發布完成'; });
    image.addEventListener('load', () => image.classList.remove('is-missing'));
  }

  insertionRange() {
    if (this.range && this.editor.contains(this.range.commonAncestorContainer)) return this.range;
    const range = document.createRange();
    range.selectNodeContents(this.editor); range.collapse(false);
    return range;
  }

  insertText(text) {
    const range = this.insertionRange();
    const fragment = document.createDocumentFragment();
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
      if (index) fragment.appendChild(document.createElement('br'));
      fragment.appendChild(document.createTextNode(line));
    });
    const last = fragment.lastChild;
    range.deleteContents(); range.insertNode(fragment);
    if (last) range.setStartAfter(last);
    range.collapse(true); this.restoreRange(range);
  }

  restoreRange(range) {
    this.editor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    this.range = range.cloneRange();
  }

  insertImage(path, width, alt) {
    const holder = document.createElement('div');
    holder.innerHTML = UI.questionInlineHtml(UI.imageMarker(path, width, alt));
    const image = holder.firstChild;
    this.watchImage(image);
    const range = this.insertionRange();
    range.deleteContents(); range.insertNode(image); range.setStartAfter(image); range.collapse(true);
    this.restoreRange(range); this.selectImage(image); this.updateStatus();
  }

  async addFile(file) {
    if (!['image/png','image/jpeg'].includes(file.type)) throw new Error('請選擇 PNG 或 JPG 圖片');
    if (file.size > 20 * 1024 * 1024) throw new Error('圖片不可超過 20 MB');
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, .9));
      if (!blob) throw new Error('圖片處理失敗，請重試');
      if (this.closed) return;
      const path = `images/${crypto.randomUUID()}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`;
      this.pending.set(path, blob);
      window.questionImagePreviews.set(path, URL.createObjectURL(blob));
      this.insertImage(path, Math.min(480, canvas.width), file.name.replace(/\.[^.]+$/, '') || '題目圖片');
    } finally { bitmap.close(); }
  }

  destroy(keepPaths = new Set()) {
    this.closed = true;
    document.removeEventListener('selectionchange', this.rememberRange);
    this.selectImage(null);
    for (const path of this.pending.keys()) {
      if (keepPaths.has(path)) continue;
      URL.revokeObjectURL(window.questionImagePreviews.get(path));
      window.questionImagePreviews.delete(path);
    }
  }
}
