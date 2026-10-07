import { blankCount } from './blank-selection.js';

const same = (a, b) => String(a ?? '') === String(b ?? '') || (String(a ?? '') !== '' && String(b ?? '') !== '' && Number(a) === Number(b));
export function questionInSection(question, code) {
  return code.split('-').every((value, index) => same([question.chapterNum, question.sectionNum, question.subsectionNum][index], value));
}

export function requiresSectionCoverage(questionCount, sections) {
  return questionCount >= sections.length;
}

// Use catalog leaves, including empty leaves, so missing coverage is reported.
export function selectedSections(catalog, selected, pool = []) {
  const rows = [];
  const add = (parts, title = '') => {
    const code = parts.join('-');
    if (!selected.some(parent => parent === code || code.startsWith(parent + '-'))) return;
    const name = String(title).replace(/^(?:第\s*[0-9０-９一二三四五六七八九十百千零〇]+\s*(?:單元|章|節|課)|(?:單元|章|節|課)\s*[0-9０-９一二三四五六七八九十百千零〇]+)\s*/, '').trim();
    const levels = parts.map((num, i) => `第${num}${catalog.labels[i] || ['章','節','小節'][i]}`).slice(-2);
    rows.push({ code, label:levels.join(' ') + (name ? ' ' + name : ''), numberLabels:levels, title:name });
  };
  (catalog.chapters || []).forEach(chapter => {
    const ch = [String(chapter.chapterNum)];
    if (!chapter.sections?.length) add(ch, chapter.title);
    (chapter.sections || []).forEach(section => {
      const sec = [...ch, String(section.sectionNum)];
      if (!section.subsections?.length) add(sec, section.title);
      (section.subsections || []).forEach(sub => add([...sec, String(sub.num)], sub.title));
    });
  });
  // Preserve questions whose legacy location is absent from the catalog.
  pool.forEach(q => {
    if (rows.some(row => questionInSection(q, row.code))) return;
    const parts = [q.chapterNum, q.sectionNum, q.subsectionNum].filter(value => value !== '' && value != null && Number(value) !== 0).map(String);
    if (parts.length && !rows.some(row => row.code === parts.join('-'))) add(parts);
  });
  return rows;
}

export function selectSectionQuestions({ pool, sections, counts, weights = {}, hardRatio = .5, locked = [], random = Math.random }) {
  const units = q => q.type === 'T4' ? blankCount(q) : 1;
  const targets = { ...counts };
  const lockedIds = new Set(locked.map(q => String(q.id)));
  const sectionIndexCache = new WeakMap();
  const index = q => {
    if (!sectionIndexCache.has(q)) sectionIndexCache.set(q, sections.findIndex(section => questionInSection(q, section.code)));
    return sectionIndexCache.get(q);
  };
  const candidates = pool.filter(q => !lockedIds.has(String(q.id)) && targets[q.type] > 0 && index(q) >= 0);
  const covered = new Set(locked.map(index));
  const remaining = { ...targets };
  locked.forEach(q => { remaining[q.type] = (remaining[q.type] || 0) - units(q); });
  if (Object.values(remaining).some(n => n < 0)) throw new Error('既有題數超過目前題型設定，請重新選題');
  let coverageError = '';
  sections.forEach((section, i) => {
    if (!covered.has(i) && !candidates.some(q => index(q) === i && units(q) <= remaining[q.type])) {
      coverageError ||= `${section.label} 沒有符合目前題型與格數設定的可用題目，請調整題型或命題範圍`;
    }
  });
  if (Object.values(remaining).reduce((s,n) => s + n, 0) < sections.filter((_, i) => !covered.has(i)).length) {
    coverageError ||= `已選 ${sections.length} 節，設定題數不足以讓每節至少一題，請增加題數或縮小範圍`;
  }
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const chosen = [...locked];
  const used = new Set(lockedIds);
  function feasible() {
    for (const [type, target] of Object.entries(remaining)) {
      if (!target) continue;
      const items = shuffled.filter(q => q.type === type && !used.has(String(q.id)));
      if (type !== 'T4') { if (items.length < target) return false; }
      else {
        const reachable = new Uint8Array(target + 1); reachable[0] = 1;
        items.forEach(q => { const n = units(q); for (let sum = target; sum >= n; sum--) reachable[sum] ||= reachable[sum - n]; });
        if (!reachable[target]) return false;
      }
    }
    return true;
  }
  if (!feasible()) throw new Error(coverageError || '目前範圍的題數不足或無法湊足填空格數，請調整題數或命題範圍');
  // 填空依完整題目計算最少／最多題數，不把格數視為題數。
  const fillTarget = remaining.T4 || 0;
  const minFill = Array(fillTarget + 1).fill(Infinity);
  const maxFill = Array(fillTarget + 1).fill(-Infinity);
  minFill[0] = maxFill[0] = 0;
  shuffled.filter(q => q.type === 'T4').forEach(q => {
    const n = units(q);
    for (let sum = fillTarget; sum >= n; sum--) {
      minFill[sum] = Math.min(minFill[sum], minFill[sum - n] + 1);
      maxFill[sum] = Math.max(maxFill[sum], maxFill[sum - n] + 1);
    }
  });
  const regularCount = Object.entries(remaining).reduce((sum, [type, count]) => sum + (type === 'T4' ? 0 : count), 0);
  const baseQuestionCount = locked.length + regularCount;
  const canUseFewerQuestions = !requiresSectionCoverage(baseQuestionCount + minFill[fillTarget], sections);
  let nodes = 0;
  function cover() {
    if (++nodes > 50000) throw new Error('章節與填空格數組合較複雜，請縮小範圍或調整題數後再試');
    if (!feasible()) return false;
    let options = null, sectionIndex = -1;
    sections.forEach((_, i) => {
      if (covered.has(i)) return;
      const items = shuffled.filter(q => index(q) === i && !used.has(String(q.id)) && units(q) <= remaining[q.type]);
      if (options === null || items.length < options.length) { options = items; sectionIndex = i; }
    });
    if (options === null) return true;
    const tried = new Set();
    for (const q of options) {
      const equivalent = `${q.type}:${units(q)}`;
      if (tried.has(equivalent)) continue;
      tried.add(equivalent);
      used.add(String(q.id)); chosen.push(q); remaining[q.type] -= units(q); covered.add(sectionIndex);
      if (cover()) return true;
      covered.delete(sectionIndex); remaining[q.type] += units(q); chosen.pop(); used.delete(String(q.id));
    }
    return false;
  }
  // 題數足夠時仍優先涵蓋每節；只有實際題數少於節數才可略過此限制。
  const enforceCoverage = !coverageError && requiresSectionCoverage(baseQuestionCount + maxFill[fillTarget], sections) && cover();
  if (!enforceCoverage && !canUseFewerQuestions) {
    throw new Error(coverageError || '目前題型題數與填空格數無法讓每節至少一題，請調整題數或命題範圍');
  }
  const fillQuestionLimit = sections.length - 1 - baseQuestionCount;
  const sectionCounts = sections.map((_, i) => chosen.filter(q => index(q) === i).length);
  const weight = i => Number(weights[sections[i].code]) || 2;
  // Marginal cost of sum(count² / weight) distributes questions by 3:2:1.
  const marginal = (q, n = sectionCounts[index(q)]) => (2 * n + 1) / weight(index(q));
  for (const [type, target] of Object.entries(remaining)) {
    if (!target) continue;
    const items = shuffled.filter(q => q.type === type && !used.has(String(q.id)));
    const hardUnits = chosen.filter(q => q.type === type && q.difficulty === '◎').reduce((sum,q) => sum + units(q), 0);
    if (type === 'T4') {
      const dp = Array.from({length:target + 1}, () => new Map());
      dp[0].set(0, {cost:0,items:[],hardCount:0});
      for (const q of items) {
        const n = units(q), hard = q.difficulty === '◎' ? n : 0;
        for (let sum = target; sum >= n; sum--) {
          for (const prev of dp[sum - n].values()) {
            if (!enforceCoverage && prev.items.length + 1 > fillQuestionLimit) continue;
            const count = prev.items.filter(item => index(item) === index(q)).length;
            const cost = prev.cost + marginal(q, sectionCounts[index(q)] + count);
            const hardCount = prev.hardCount + hard;
            const key = enforceCoverage ? hardCount : `${hardCount}:${prev.items.length + 1}`;
            if (!dp[sum].has(key) || cost < dp[sum].get(key).cost) dp[sum].set(key, {cost,items:[...prev.items,q],hardCount});
          }
        }
      }
      let best = null, bestCost = Infinity;
      for (const state of dp[target].values()) {
        const cost = state.cost + Math.abs(hardUnits + state.hardCount - targets[type] * hardRatio) * .2;
        if (cost < bestCost) { best = state; bestCost = cost; }
      }
      if (!best) throw new Error('無法湊足填空格數，請調整格數');
      best.items.forEach(q => { chosen.push(q); used.add(String(q.id)); sectionCounts[index(q)]++; });
    } else {
      let hard = hardUnits;
      for (let n = 0; n < target; n++) {
        const needHard = hard < targets[type] * hardRatio;
        items.sort((a,b) => marginal(a) - marginal(b) || Number((b.difficulty === '◎') === needHard) - Number((a.difficulty === '◎') === needHard));
        const q = items.shift(); chosen.push(q); used.add(String(q.id)); sectionCounts[index(q)]++; if (q.difficulty === '◎') hard++;
      }
    }
  }
  // Improve the weight distribution without changing type units or coverage.
  const fixed = new Set(lockedIds);
  for (let pass = 0; pass < chosen.length * 2; pass++) {
    let best = null, delta = -1e-8;
    const hardTotals = {};
    chosen.forEach(q => { if (q.difficulty === '◎') hardTotals[q.type] = (hardTotals[q.type] || 0) + units(q); });
    chosen.forEach((old, pos) => {
      if (fixed.has(String(old.id))) return;
      const from = index(old);
      shuffled.forEach(q => {
        if (used.has(String(q.id)) || q.type !== old.type || units(q) !== units(old)) return;
        const to = index(q); if (enforceCoverage && to !== from && sectionCounts[from] <= 1) return;
        const distributionDelta = to === from ? 0 : (-2 * sectionCounts[from] + 1) / weight(from) + (2 * sectionCounts[to] + 1) / weight(to);
        const hard = hardTotals[old.type] || 0, goal = targets[old.type] * hardRatio;
        const nextHard = hard + ((q.difficulty === '◎' ? 1 : 0) - (old.difficulty === '◎' ? 1 : 0)) * units(q);
        const nextDelta = distributionDelta + (Math.abs(nextHard - goal) - Math.abs(hard - goal)) * .2;
        if (nextDelta < delta) { delta = nextDelta; best = {q,old,pos,from,to}; }
      });
    });
    if (!best) break;
    const {q,old,pos,from,to} = best; used.delete(String(old.id)); used.add(String(q.id)); chosen[pos] = q; sectionCounts[from]--; sectionCounts[to]++;
  }
  return chosen;
}
