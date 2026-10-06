export const DOWNLOAD_TYPES = [
  {code:'questions', label:'題目卷', answers:false, analysis:false},
  {code:'answers', label:'題目卷附答案', answers:true, analysis:false, source:true},
  {code:'analysis', label:'題目卷附答案及解析', answers:true, analysis:true, source:true},
  {code:'student', label:'作答卷', answers:false, analysis:false, answerSheet:true},
  {code:'studentAnswers', label:'作答卷附答案', answers:true, analysis:false, answerSheet:true},
];

export function downloadFilename(title = '試卷', label = '') {
  const base = String(title || '試卷').replace(/\.docx$/i, '').replace(/[\\/:*?"<>|]/g, '_');
  return `${label ? String(label).replace(/[\\/:*?"<>|]/g, '_') : base}.docx`;
}

export function buildDownloadVariants(questions, codes, ab = false, booklet = false, random = Math.random) {
  const selected = DOWNLOAD_TYPES.filter(type => codes.includes(type.code));
  if (!selected.length) throw new Error('請至少選擇一種試卷類型');
  let bQuestions = [...questions];
  if (ab) {
    const groups = new Map();
    questions.forEach((question, index) => {
      const key = JSON.stringify([question.type, ...(booklet ? ['chapterNum','sectionNum','subsectionNum'].map(field => Number(question[field]) || 0) : [])]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    });
    let changed = false;
    for (const indices of groups.values()) {
      if (indices.length < 2) continue;
      const items = indices.map(index => questions[index]);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i],items[j]] = [items[j],items[i]];
      }
      if (items.every((item,index) => item === questions[indices[index]])) items.push(items.shift());
      indices.forEach((index, position) => { bQuestions[index] = items[position]; });
      changed = true;
    }
    if (!changed) throw new Error('每個題型／章節都只有一題，無法產生題序不同的 A／B 卷');
  }
  return selected.flatMap(type => (ab ? ['A','B'] : ['']).map(version => ({
    ...type, label:type.label + (version ? `（${version}卷）` : ''),
    questions:version === 'B' ? bQuestions : [...questions], preserveQuestionOrder:ab,
  })));
}
