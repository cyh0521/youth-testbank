export function blankCount(question) {
  const count = Number(question.answerCount);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

// Keep whole questions together while matching the requested number of blanks.
export function selectFillQuestions(pool, target, hardRatio = 0.5) {
  if (target === 0) return [];
  if (!Number.isInteger(target) || target < 0) return null;
  if (target > pool.reduce((sum, question) => sum + blankCount(question), 0)) return null;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const states = Array.from({ length: target + 1 }, () => new Map());
  states[0].set(0, []);
  for (const question of shuffled) {
    const blanks = blankCount(question);
    if (blanks > target) continue;
    const hard = question.difficulty === '◎' ? blanks : 0;
    for (let total = target - blanks; total >= 0; total--) {
      for (const [hardTotal, chosen] of states[total]) {
        const next = states[total + blanks];
        const key = hardTotal + hard;
        if (!next.has(key)) next.set(key, [...chosen, question]);
      }
    }
  }
  let best = null;
  let distance = Infinity;
  for (const [hardTotal, chosen] of states[target]) {
    const delta = Math.abs(hardTotal - target * hardRatio);
    if (delta < distance) { best = chosen; distance = delta; }
  }
  return best;
}

export function reachableBlankCounts(pool, limit = pool.reduce((sum, question) => sum + blankCount(question), 0)) {
  const reachable = Array(limit + 1).fill(false);
  reachable[0] = true;
  for (const question of pool) {
    const count = blankCount(question);
    for (let sum = limit; sum >= count; sum--) {
      if (reachable[sum - count]) reachable[sum] = true;
    }
  }
  return reachable;
}
