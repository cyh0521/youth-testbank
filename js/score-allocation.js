export const AUTO_SCORE_WEIGHTS = Object.freeze({T1:1,T2:1,T3:1,T4:1,T5:3,T6:3});

/** 優先湊足總分，再盡量採用整數、貼近參考權重；各題型可有不同分數。 */
export function allocateTypeScores(typeCounts, weights = AUTO_SCORE_WEIGHTS, target = 100, step = 0.5) {
  const types = typeCounts.filter(type => Number.isSafeInteger(type.cnt) && type.cnt > 0);
  if (!types.length) return {};
  const limit = Math.floor(target / step);
  const count = types.reduce((sum,type) => sum + type.cnt, 0);
  if (count > limit) return Object.fromEntries(types.map(type => [type.code,step]));
  const weightSum = types.reduce((sum,type) => sum + type.cnt * (weights[type.code] || 1), 0);
  let states = new Map([[0,{fractional:0,cost:0,scores:[]}]]);
  for (const type of types) {
    const ideal = target * (weights[type.code] || 1) / (weightSum * step);
    const maxUnits = Math.floor(limit / type.cnt);
    const next = new Map();
    for (const [total,state] of states) {
      for (let units = 1; units <= maxUnits && total + type.cnt * units <= limit; units++) {
        const nextTotal = total + type.cnt * units;
        const fractional = state.fractional + (Number.isInteger(units * step) ? 0 : 1);
        const cost = state.cost + type.cnt * (units - ideal) ** 2;
        const previous = next.get(nextTotal);
        if (!previous || fractional < previous.fractional ||
          (fractional === previous.fractional && cost < previous.cost)) {
          next.set(nextTotal,{fractional,cost,scores:[...state.scores,units]});
        }
      }
    }
    states = next;
  }
  const best = states.get(Math.max(...states.keys()));
  return Object.fromEntries(types.map((type,index) => [type.code,best.scores[index] * step]));
}
