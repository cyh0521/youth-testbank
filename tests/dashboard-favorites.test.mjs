import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('../js/dashboard-favorites.js',import.meta.url),'utf8');
const {favoriteBookKey,orderFavoriteBooks,setFavoriteBook}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const books=['a','b','c','d'].map(code=>({subjectCode:'S',code}));
test('新常用科目排在既有常用科目之後，其餘圖卡維持原順序',()=>{
  let favorites=setFavoriteBook([],books[2],true);
  favorites=setFavoriteBook(favorites,books[0],true);
  assert.deepEqual(orderFavoriteBooks(books,favorites).map(book=>book.code),['c','a','b','d']);
  assert.deepEqual(setFavoriteBook(favorites,books[2],true),favorites);
  favorites=setFavoriteBook(favorites,books[2],false);
  assert.deepEqual(orderFavoriteBooks(books,favorites).map(book=>book.code),['a','b','c','d']);
  assert.deepEqual(books.map(book=>book.code),['a','b','c','d']);
});
test('同冊別代碼但不同科目不會混淆，未顯示的常用科目不影響其餘圖卡',()=>{
  const other={subjectCode:'OTHER',code:'a'};
  const favorites=[favoriteBookKey({subjectCode:'hidden',code:'x'}),favoriteBookKey(other)];
  assert.deepEqual(orderFavoriteBooks([...books,other],favorites),[other,...books]);
});
