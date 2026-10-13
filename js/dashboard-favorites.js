export const favoriteBookKey = book => JSON.stringify([book.subjectCode, book.code]);

export function orderFavoriteBooks(books, favorites = []) {
  const ranks = new Map(favorites.map((key, index) => [key, index]));
  return books.map((book, index) => ({book, index})).sort((a, b) =>
    (ranks.get(favoriteBookKey(a.book)) ?? Infinity) - (ranks.get(favoriteBookKey(b.book)) ?? Infinity) || a.index - b.index
  ).map(entry => entry.book);
}

export function setFavoriteBook(favorites, book, checked) {
  const key = favoriteBookKey(book);
  const result = [...new Set(favorites)];
  return checked ? result.includes(key) ? result : [...result, key] : result.filter(item => item !== key);
}
