const ROOT = new URL('../data/textbank/', import.meta.url);

export class StaticTextbank {
  constructor(fetcher = (url, options) => globalThis.fetch(url, options)) {
    this.fetcher = fetcher;
    this.manifestPromise = null;
    this.shards = new Map();
  }

  async manifest() {
    if (!this.manifestPromise) {
      this.manifestPromise = this.fetchJson('manifest.json', { cache: 'no-store' }).then(value => {
        if (value?.schema !== 1 || !Array.isArray(value.books) || !value.byId) {
          throw new Error('靜態題庫索引格式不正確');
        }
        return value;
      }).catch(error => {
        this.manifestPromise = null;
        throw error;
      });
    }
    return this.manifestPromise;
  }

  async fetchJson(path, options = {}) {
    const response = await this.fetcher(new URL(path, ROOT), options);
    if (!response.ok) throw new Error(`靜態題庫檔案載入失敗：${path} (${response.status})`);
    return response.json();
  }

  async shard(entry) {
    if (!this.shards.has(entry.path)) {
      this.shards.set(entry.path, this.fetchJson(entry.path).then(items => {
        if (!Array.isArray(items) || items.length !== entry.count) {
          throw new Error(`靜態題庫題數不符：${entry.path}`);
        }
        return items;
      }).catch(error => {
        this.shards.delete(entry.path);
        throw error;
      }));
    }
    return this.shards.get(entry.path);
  }

  async questions(options = {}) {
    if (options.sourceFile) throw new Error('匯入檔案查詢需使用 Firestore');
    const manifest = await this.manifest();
    const entries = manifest.books.filter(book =>
      (!options.subjectCode || book.subjectCode === options.subjectCode) &&
      (!options.bookCode || book.bookCode === options.bookCode));
    const lists = await Promise.all(entries.map(entry => this.shard(entry)));
    return lists.flat().filter(question => {
      if (options.type && question.type !== options.type) return false;
      if (options.difficulty && question.difficulty !== options.difficulty) return false;
      if (options.qnum && question.qnum !== options.qnum) return false;
      if (options.keyword) {
        const keyword = options.keyword.toLowerCase();
        if (!(question.text || '').toLowerCase().includes(keyword) &&
            !(question.answer || '').toLowerCase().includes(keyword)) return false;
      }
      if (options.chapters?.length) {
        const numberEquals = (left, right) => Number(left) === Number(right);
        if (!options.chapters.some(code => {
          const [chapter, section, subsection] = code.split('-');
          return numberEquals(question.chapterNum, chapter) &&
            (section == null || numberEquals(question.sectionNum, section)) &&
            (subsection == null || numberEquals(question.subsectionNum, subsection));
        })) return false;
      }
      return true;
    });
  }

  async byIds(ids) {
    const manifest = await this.manifest();
    const paths = new Set(ids.map(id => manifest.byId[id]).filter(Boolean));
    const entries = manifest.books.filter(book => paths.has(book.path));
    const lists = await Promise.all(entries.map(entry => this.shard(entry)));
    const byId = new Map(lists.flat().map(question => [question.id, question]));
    return { found: ids.map(id => byId.get(id)).filter(Boolean), missing: ids.filter(id => !byId.has(id)) };
  }

  async count({ subjectCode, bookCode }) {
    const manifest = await this.manifest();
    return manifest.books.filter(book =>
      (!subjectCode || book.subjectCode === subjectCode) &&
      (!bookCode || book.bookCode === bookCode))
      .reduce((total, book) => total + book.count, 0);
  }

  async stats() {
    return (await this.manifest()).stats;
  }
}
