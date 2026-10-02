/** 優先湊足總分，再減少小數配分的題型，最後貼近各題型權重。 */
function allocateBaseScores(typeCounts, weights, target = 100, step = 0.5) {
  if (!typeCounts.length) return {};
  const targetUnits = Math.floor(target / step);
  const questionCount = typeCounts.reduce((sum, type) => sum + type.cnt, 0);
  if (questionCount > targetUnits) {
    return Object.fromEntries(typeCounts.map(type => [type.code, step]));
  }

  const weightSum = typeCounts.reduce((sum, type) => sum + type.cnt * (weights[type.code] || 1), 0);
  let states = new Map([[0, { fractional:0, cost:0, scores:[] }]]);
  for (const type of typeCounts) {
    const idealUnits = target * (weights[type.code] || 1) / (weightSum * step);
    const maxUnits = Math.floor(targetUnits / type.cnt);
    const next = new Map();
    for (const [total, state] of states) {
      for (let units = 1; units <= maxUnits && total + type.cnt * units <= targetUnits; units++) {
        const newTotal = total + type.cnt * units;
        const cost = state.cost + type.cnt * (units - idealUnits) ** 2;
        const fractional = state.fractional + (Number.isInteger(units * step) ? 0 : 1);
        const previous = next.get(newTotal);
        if (!previous || fractional < previous.fractional || (fractional === previous.fractional && cost < previous.cost)) {
          next.set(newTotal, { fractional, cost, scores:[...state.scores, units] });
        }
      }
    }
    states = next;
  }

  const bestTotal = Math.max(...states.keys());
  const best = states.get(bestTotal);
  return Object.fromEntries(typeCounts.map((type, index) => [type.code, best.scores[index] * step]));
}

/** 優先湊足總分、採用整數，再讓是非與選擇同分；配合、問答較高。 */
export function allocateTypeScores(typeCounts, weights, target = 100, step = 0.5) {
  const base = allocateBaseScores(typeCounts, weights, target, step);
  const scores = findWeightedScores(typeCounts, base, weights, target, step)?.scores || base;
  const trueFalse = typeCounts.find(t => t.code === 'T1');
  const choice = typeCounts.find(t => t.code === 'T2');
  if (!trueFalse || !choice || scores.T1 === scores.T2) return scores;
  // Treat the two types as one scoring group, then compare without sacrificing total or integer preference.
  const grouped = typeCounts.filter(t => t.code !== 'T2').map(t => t.code === 'T1' ? { ...t, cnt:t.cnt + choice.cnt } : t);
  const groupedBase = allocateBaseScores(grouped, weights, target, step);
  const groupedScores = findWeightedScores(grouped, groupedBase, weights, target, step)?.scores || groupedBase;
  const equalScores = { ...groupedScores, T2:groupedScores.T1 };
  const respectsWeight = values => typeCounts.filter(t => t.code === 'T5' || t.code === 'T6').every(t =>
    typeCounts.filter(other => other.code !== 'T5' && other.code !== 'T6').every(other => values[t.code] > values[other.code]));
  if (respectsWeight(scores) && !respectsWeight(equalScores)) return scores;
  const total = values => typeCounts.reduce((sum, t) => sum + t.cnt * values[t.code], 0);
  const fractions = values => typeCounts.filter(t => !Number.isInteger(values[t.code])).length;
  if (total(equalScores) > total(scores) || (total(equalScores) === total(scores) && fractions(equalScores) <= fractions(scores))) {
    return equalScores;
  }
  return scores;
}

function findWeightedScores(typeCounts, currentScores, weights, target = 100, step = 0.5) {
  if (!typeCounts.length) return null;
  const limit = Math.floor(target / step);
  const heavy = type => type.code === 'T5' || type.code === 'T6';
  const heavyCount = typeCounts.filter(heavy).reduce((sum, t) => sum + t.cnt, 0);
  const otherCount = typeCounts.filter(t => !heavy(t)).reduce((sum, t) => sum + t.cnt, 0);
  const weightSum = typeCounts.reduce((sum, t) => sum + t.cnt * (weights[t.code] || 1), 0);
  // A shared boundary ensures both heavier types exceed every other per-unit score.
  const boundaries = heavyCount && otherCount
    ? Array.from({ length: Math.max(0, Math.floor((limit - otherCount) / heavyCount) - 1) }, (_, i) => i + 1)
    : [null];
  let best = null;
  for (const boundary of boundaries) {
    let costs = new Float64Array(limit + 1).fill(Infinity);
    costs[0] = 0;
    let fractions = new Uint8Array(limit + 1).fill(255);
    fractions[0] = 0;
    const choices = [];
    for (const type of typeCounts) {
      const min = boundary !== null && heavy(type) ? boundary + 1 : 1;
      const max = boundary !== null && !heavy(type) ? boundary : Math.floor(limit / type.cnt);
      const next = new Float64Array(limit + 1).fill(Infinity);
      const nextFractions = new Uint8Array(limit + 1).fill(255);
      const pickedUnits = new Int16Array(limit + 1);
      const ideal = target * (weights[type.code] || 1) / (weightSum * step);
      const current = Number(currentScores[type.code]) / step;
      const unitCosts = Array.from({ length:max + 1 }, (_, units) => type.cnt * ((units - current) ** 2 * 1000 + (units - ideal) ** 2));
      for (let sum = 0; sum <= limit; sum++) {
        if (!Number.isFinite(costs[sum])) continue;
        for (let units = min; units <= max && sum + type.cnt * units <= limit; units++) {
          const total = sum + type.cnt * units;
          const cost = costs[sum] + unitCosts[units];
          const fractional = fractions[sum] + (Number.isInteger(units * step) ? 0 : 1);
          if (fractional < nextFractions[total] || (fractional === nextFractions[total] && cost < next[total])) {
            next[total] = cost;
            nextFractions[total] = fractional;
            pickedUnits[total] = units;
          }
        }
      }
      costs = next;
      fractions = nextFractions;
      choices.push(pickedUnits);
    }
    for (let total = limit; total > 0; total--) {
      if (!Number.isFinite(costs[total])) continue;
      if (!best || total > best.total / step || (total === best.total / step &&
        (fractions[total] < best.fractional || (fractions[total] === best.fractional && costs[total] < best.cost)))) {
        const scores = {};
        let remaining = total;
        for (let i = typeCounts.length - 1; i >= 0; i--) {
          const units = choices[i][remaining];
          scores[typeCounts[i].code] = units * step;
          remaining -= typeCounts[i].cnt * units;
        }
        best = { total:total * step, fractional:fractions[total], cost:costs[total], scores };
      }
      break;
    }
  }
  return best;
}
