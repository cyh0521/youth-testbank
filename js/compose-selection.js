/** 從已載入的冊次資料取得命題範圍；未勾選章節時不抽題。 */
export function filterComposePool(questions, { subjectCode, bookCode, chapters = [], type } = {}) {
  if (!chapters.length) return [];
  return questions.filter(q =>
    String(q.subjectCode) === String(subjectCode) &&
    String(q.bookCode) === String(bookCode) &&
    (!type || q.type === type) &&
    chapters.some(chapter => {
      const parts = chapter.split('-').map(Number);
      return Number(q.chapterNum) === parts[0] &&
        (parts.length < 2 || Number(q.sectionNum) === parts[1]) &&
        (parts.length < 3 || Number(q.subsectionNum) === parts[2]);
    })
  );
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 保留原有難易比例與不足時由剩餘題目補足的規則。 */
export function pickComposeQuestions(pool, config, count) {
  if (!config.weights) return shuffled(pool).slice(0, count);
  const hardCount = Math.round(config.weights['◎'] * count);
  const result = [
    ...shuffled(pool.filter(q => q.difficulty === '◎')).slice(0, hardCount),
    ...shuffled(pool.filter(q => q.difficulty === '△')).slice(0, count - hardCount),
  ];
  if (result.length < count) {
    const used = new Set(result.map(q => q.id));
    result.push(...shuffled(pool.filter(q => !used.has(q.id))).slice(0, count - result.length));
  }
  return result.slice(0, count);
}
