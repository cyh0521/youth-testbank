export function prepareQuestionMove(questions, target, book) {
  if (!target.subjectCode || !target.bookCode || !book) throw new Error('請選擇目標科目與冊別');
  const invalid = [];
  const updates = questions.map(q => {
    const chapter = Number(q.chapterNum), section = Number(q.sectionNum || 0), sub = Number(q.subsectionNum || 0);
    const chapterDef = book.chapters?.find(c => Number(c.chapterNum) === chapter);
    const sectionDef = chapterDef?.sections?.find(s => Number(s.sectionNum) === section);
    if (!Number.isInteger(chapter) || chapter < 1 || !chapterDef
      || (book.l2 ? !sectionDef : section !== 0)
      || (book.l3 ? !sectionDef?.subsections?.some(s => Number(s.num ?? s.subsectionNum) === sub) : sub !== 0)) {
      invalid.push(q.qnum || q.id);
    }
    const part = value => String(value).padStart(2,'0');
    const suffix = target.subjectCode === 'B1' ? part(chapter)+part(section)+part(sub)
      : target.subjectCode === 'C1' ? part(chapter)+part(section) : part(chapter);
    return {id:q.id, subjectCode:target.subjectCode, bookCode:target.bookCode,
      catalogCode:`${target.subjectCode}-${target.bookCode}-${suffix}`};
  });
  if (invalid.length) throw new Error(`目標課本沒有對應章節，尚未移動任何題目。請先確認章節設定；題號：${invalid.slice(0,10).join('、')}${invalid.length > 10 ? '…' : ''}`);
  return updates;
}
