import { guardPage } from './auth-guard.js';
import { bookArtwork } from './book-artwork.js';
import { favoriteBookKey, orderFavoriteBooks, setFavoriteBook } from './dashboard-favorites.js';

window._activeNav = 'dashboard';
const user = await guardPage();
if (!user) throw new Error('not auth');
const root = document.getElementById('green-comic-test');
const grid = root.querySelector('.gc-grid');
const overlay = root.querySelector('.gc-overlay');
const favoriteCheckbox = root.querySelector('#gc-mode-favorite');
let books = [], selectedBook = null, previousFocus = null;
let favoriteBooks = Array.isArray(user.homeFavoriteBooks) ? user.homeFavoriteBooks.filter(key => typeof key === 'string') : [];
let savingFavorite = false;
function syncFavoriteControls() {
  grid.querySelectorAll('.gc-book-card').forEach(card => {
    const cardButton = card.querySelector('[data-book-code]');
    const book = books.find(item => item.code === cardButton.dataset.bookCode && item.subjectCode === cardButton.dataset.subjectCode);
    const active = !!book && favoriteBooks.includes(favoriteBookKey(book));
    const check = card.querySelector('.gc-book-check');
    check.setAttribute('aria-pressed', String(active));
    check.setAttribute('aria-label', `${book?.name || book?.code || '冊別'}：${active ? '取消常用科目' : '設為常用科目'}`);
  });
  favoriteCheckbox.checked = !!selectedBook && favoriteBooks.includes(favoriteBookKey(selectedBook));
}
function reorderBookCards() {
  const cards = [...grid.querySelectorAll('[data-book-code]')];
  for (const book of orderFavoriteBooks(books, favoriteBooks)) {
    const card = cards.find(card => card.dataset.bookCode === book.code && card.dataset.subjectCode === book.subjectCode);
    if (card) grid.append(card.closest('.gc-book-card'));
  }
}
async function toggleFavorite(book, button) {
  if (savingFavorite) return;
  const next = setFavoriteBook(favoriteBooks, book, !favoriteBooks.includes(favoriteBookKey(book)));
  savingFavorite = true;
  button.disabled = true;
  favoriteCheckbox.disabled = true;
  try {
    await DataService.updateProfile(user.uid, {homeFavoriteBooks:next});
    favoriteBooks = next;
    syncFavoriteControls();
    reorderBookCards();
  } catch (error) {
    UI.toast(`常用科目設定失敗：${error.message}`, 'danger');
  } finally {
    savingFavorite = false;
    button.disabled = false;
    favoriteCheckbox.disabled = false;
    syncFavoriteControls();
  }
}
favoriteCheckbox.addEventListener('change', () => {
  if (selectedBook) toggleFavorite(selectedBook, favoriteCheckbox);
});
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
  const buttons = [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
  if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
});
grid.addEventListener('click', event => {
  const favorite = event.target.closest('.gc-book-check');
  if (favorite) {
    const cardButton = favorite.closest('.gc-book-card').querySelector('[data-book-code]');
    const book = books.find(book => book.code === cardButton.dataset.bookCode && book.subjectCode === cardButton.dataset.subjectCode);
    if (book) toggleFavorite(book, favorite);
    return;
  }
  const button = event.target.closest('[data-book-code]');
  if (!button) return;
  selectedBook = books.find(book => book.code === button.dataset.bookCode && book.subjectCode === button.dataset.subjectCode);
  if (!selectedBook) return;
  previousFocus = button;
  root.querySelector('#gc-mode-title').textContent = selectedBook.name;
  favoriteCheckbox.checked = favoriteBooks.includes(favoriteBookKey(selectedBook));
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
    grid.innerHTML = orderFavoriteBooks(books, favoriteBooks).map(book => `<div class="gc-book-card"><button class="gc-book" type="button" data-book-code="${UI.escapeHtml(book.code)}" data-subject-code="${UI.escapeHtml(book.subjectCode)}" style="--book-tone:${book.tone}">
      ${bookArtwork[book.code] ? `<img src="${bookArtwork[book.code]}" alt="" width="224" height="180" decoding="async"/>` : `<span class="gc-custom-art" aria-hidden="true">${ICONS.book}</span>`}
      <strong>${UI.escapeHtml(book.name || book.code)}</strong></button><button class="gc-book-check" type="button" aria-pressed="${favoriteBooks.includes(favoriteBookKey(book))}" aria-label="${UI.escapeHtml(book.name || book.code)}：${favoriteBooks.includes(favoriteBookKey(book)) ? '取消常用科目' : '設為常用科目'}"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="gc-check-fill" d="M16 4.8c6.6-.1 11.5 4.8 11.2 11.3-.3 6.6-4.7 11.1-11.1 11.3-6.3.2-11-4.3-11.2-10.9C4.6 9.9 9.2 5 16 4.8Z"/><path class="gc-check-ring" d="M16 3.8C9.8 3.4 4.7 7.6 4 14.2c-.8 7.3 3.9 13.1 11 13.8 7.2.7 12.9-4 13-10.8C28.2 10.1 23.8 4.3 16 3.8Z"/><path class="gc-check-mark" d="m9.1 16.3 4.8 4.1c2.7-3.3 5.6-6.5 9.4-10"/></svg></button></div>`).join('') || '<p class="gc-empty">目前沒有顯示的冊別，可至「設定」調整題庫環境。</p>';
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
