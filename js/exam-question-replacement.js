/** 在已儲存試卷中換題：優先同章節，缺題時才擴大到同冊。 */
export async function chooseExamReplacement(original, usedIds) {
  const pool = await window.DataService.getQuestions({
    subjectCode: original.subjectCode,
    bookCode: original.bookCode,
  });
  const used = new Set([...usedIds].map(String));
  const answerCount = question => Math.max(1, parseInt(question.answerCount, 10) || 1);
  const candidates = pool.filter(question =>
    question.type === original.type &&
    question.subjectCode === original.subjectCode &&
    question.bookCode === original.bookCode &&
    !used.has(String(question.id)) &&
    (original.type !== 'T4' || answerCount(question) === answerCount(original))
  );
  const sameSection = candidates.filter(question =>
    ['chapterNum', 'sectionNum', 'subsectionNum'].every(field =>
      Number(question[field] || 0) === Number(original[field] || 0)
    )
  );
  const choices = sameSection.length ? sameSection : candidates;
  return {
    question: choices.length ? choices[Math.floor(Math.random() * choices.length)] : null,
    sameSection: sameSection.length > 0,
  };
}
