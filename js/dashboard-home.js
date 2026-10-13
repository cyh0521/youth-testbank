import { guardPage } from './auth-guard.js';
import { bookArtwork } from './book-artwork.js';
import { favoriteBookKey, orderFavoriteBooks, setFavoriteBook } from './dashboard-favorites.js';

window._activeNav = 'dashboard';
const user = await guardPage();
if (!user) throw new Error('not auth');
const root = document.getElementById('green-comic-test');
const grid = root.querySelector('.gc-grid');
const overlay = root.querySelector('.gc-overlay');
let books = [], selectedBook = null, previousFocus = null;
let favoriteBooks = Array.isArray(user.homeFavoriteBooks) ? user.homeFavoriteBooks.filter(key => typeof key === 'string') : [];
let savingFavorite = false;
function closeBookMenus() {
  grid.querySelectorAll('.gc-book-menu').forEach(menu => menu.hidden = true);
  grid.querySelectorAll('.gc-book-more').forEach(button => button.setAttribute('aria-expanded', 'false'));
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
  try {
    await DataService.updateProfile(user.uid, {homeFavoriteBooks:next});
    favoriteBooks = next;
    grid.querySelectorAll('.gc-book-card').forEach(card => {
      const item = books.find(book => book.code === card.querySelector('[data-book-code]').dataset.bookCode && book.subjectCode === card.querySelector('[data-book-code]').dataset.subjectCode);
      card.querySelector('.gc-book-favorite').textContent = favoriteBooks.includes(favoriteBookKey(item)) ? '取消常用科目' : '常用科目';
    });
    closeBookMenus();
    reorderBookCards();
  } catch (error) {
    UI.toast(`常用科目設定失敗：${error.message}`, 'danger');
  } finally {
    savingFavorite = false;
    button.disabled = false;
  }
}
document.addEventListener('click', event => { if (!event.target.closest('.gc-book-actions')) closeBookMenus(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const expanded = grid.querySelector('.gc-book-more[aria-expanded="true"]');
    closeBookMenus();
    expanded?.focus();
  }
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
  const more = event.target.closest('.gc-book-more');
  if (more) {
    const menu = more.nextElementSibling;
    const opening = menu.hidden;
    closeBookMenus();
    menu.hidden = !opening;
    more.setAttribute('aria-expanded', String(opening));
    if (opening) menu.querySelector('button').focus();
    return;
  }
  const favorite = event.target.closest('.gc-book-favorite');
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
    grid.innerHTML = orderFavoriteBooks(books, favoriteBooks).map((book, index) => `<div class="gc-book-card"><button class="gc-book" type="button" data-book-code="${UI.escapeHtml(book.code)}" data-subject-code="${UI.escapeHtml(book.subjectCode)}" style="--book-tone:${book.tone}">
      ${bookArtwork[book.code] ? `<img src="${bookArtwork[book.code]}" alt="" width="224" height="180" decoding="async"/>` : `<span class="gc-custom-art" aria-hidden="true">${ICONS.book}</span>`}
      <strong>${UI.escapeHtml(book.name || book.code)}</strong></button><div class="gc-book-actions"><button class="gc-book-more" type="button" aria-label="${UI.escapeHtml(book.name || book.code)}的更多選項" aria-expanded="false" aria-controls="gc-book-menu-${index}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button><div class="gc-book-menu" id="gc-book-menu-${index}" hidden><button class="gc-book-favorite" type="button">${favoriteBooks.includes(favoriteBookKey(book)) ? '取消常用科目' : '常用科目'}</button></div></div></div>`).join('') || '<p class="gc-empty">目前沒有顯示的冊別，可至「設定」調整題庫環境。</p>';
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
