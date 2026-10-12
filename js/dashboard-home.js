import { guardPage } from './auth-guard.js';
import { bookArtwork } from './book-artwork.js';

window._activeNav = 'dashboard';
const user = await guardPage();
if (!user) throw new Error('not auth');
const root = document.getElementById('green-comic-test');
const grid = root.querySelector('.gc-grid');
const overlay = root.querySelector('.gc-overlay');
let books = [], selectedBook = null, previousFocus = null;
const tones = ['#4b8064','#5a9274','#79a77c','#8caa75','#72a19a','#7c9782','#88916b','#6a8f83','#568c70'];

function closeModes() {
  overlay.hidden = true;
  previousFocus?.focus();
}
root.querySelector('.gc-close').addEventListener('click', closeModes);
overlay.addEventListener('click', event => { if (event.target === overlay) closeModes(); });
overlay.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeModes(); }
  if (event.key !== 'Tab') return;
  const buttons = [...overlay.querySelectorAll('button')];
  if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
});
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-book-code]');
  if (!button) return;
  selectedBook = books.find(book => book.code === button.dataset.bookCode);
  if (!selectedBook) return;
  previousFocus = button;
  root.querySelector('#gc-mode-title').textContent = selectedBook.name;
  overlay.hidden = false;
  root.querySelector('.gc-close').focus();
});
const pages = { '電腦選題':'compose', '手動選題':'manual', '編碼選題':'coded', '題本列印':'booklet' };
overlay.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  if (!selectedBook || !pages[button.dataset.mode]) return;
  const query = new URLSearchParams({ subject:selectedBook.subjectCode, book:selectedBook.code });
  window.location.assign(`${pages[button.dataset.mode]}.html?${query}`);
}));

async function loadBooks() {
  grid.setAttribute('aria-busy', 'true');
  try {
    await initTextbookCache();
    books = _tbCache.subjects.flatMap((subject,index) => (_tbCache.booksBySubject[subject.id] || [])
      .filter((book,i,list) => list.findIndex(item => item.code === book.code) === i)
      .map(book => ({ ...book, subjectCode:subject.code, tone:tones[index % tones.length] })));
    root.querySelector('.gc-heading>span').textContent = `${books.length} 冊`;
    grid.innerHTML = books.map(book => `<button class="gc-book" type="button" data-book-code="${UI.escapeHtml(book.code)}" style="--book-tone:${book.tone}">
      ${bookArtwork[book.code] ? `<img src="${bookArtwork[book.code]}" alt="" width="224" height="180" decoding="async"/>` : `<span class="gc-custom-art" aria-hidden="true">${ICONS.book}</span>`}
      <strong>${UI.escapeHtml(book.name || book.code)}</strong></button>`).join('') || '<p class="gc-empty">目前沒有顯示的冊別，可至「設定」調整題庫環境。</p>';
  } catch (error) {
    grid.innerHTML = '<p class="gc-empty">冊別暫時無法載入，請稍後再試。</p><button type="button" class="btn btn-outline" id="retryBooks">重新載入</button>';
    grid.querySelector('#retryBooks').addEventListener('click', loadBooks);
    console.error('Homepage catalog unavailable:', error);
  } finally {
    grid.setAttribute('aria-busy', 'false');
    document.getElementById('content').setAttribute('aria-busy', 'false');
  }
}
await loadBooks();
