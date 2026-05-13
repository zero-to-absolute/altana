// Pure-функции расчёта совместимости компонентов смеси: на вход данные, на выход число или объект.

const NEUTRAL = 3;          // дефолт, когда пара компонентов не найдена в таблицах
const WORST_WEIGHT = 0.6;   // вклад самой слабой пары в итоговый score
const AVG_WEIGHT = 0.4;     // вклад средней совместимости
const POOR_PAIR = 2;        // пара со score не выше этого считается откровенно плохой

// канонический ключ пары — меньший id первым
function pairKey(idA, idB) {
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
}

// score одной пары компонентов в шкале 1..5; a, b — { type: 'tea'|'ingredient', id }; compatData — Map-ы
export function compat(a, b, compatData) {
  if (!a || !b || !compatData) return NEUTRAL;
  if (a.type === 'tea' && b.type === 'tea') return compatData.teaCompat.get(pairKey(a.id, b.id)) ?? NEUTRAL;
  if (a.type === 'ingredient' && b.type === 'ingredient') return compatData.ingCompat.get(pairKey(a.id, b.id)) ?? NEUTRAL;
  // пара «чай — ингредиент»: ключ всегда «teaId-ingredientId»
  const teaId = a.type === 'tea' ? a.id : b.id;
  const ingId = a.type === 'ingredient' ? a.id : b.id;
  const entry = compatData.teaIngCompat.get(`${teaId}-${ingId}`);
  return entry ? entry.score : NEUTRAL;
}

// базовый рейтинг чая для пустой смеси — blend_suitability (или нейтраль)
export function suitabilityScore(tea) {
  return tea && typeof tea.blend_suitability === 'number' ? tea.blend_suitability : NEUTRAL;
}

function isEmptyBlend(blend) {
  return !blend
    || ((!blend.bases || blend.bases.length === 0) && (!blend.ingredients || blend.ingredients.length === 0));
}

function blendComponents(blend) {
  const components = [];
  if (blend && Array.isArray(blend.bases)) {
    for (const b of blend.bases) components.push({ type: 'tea', id: b.teaId });
  }
  if (blend && Array.isArray(blend.ingredients)) {
    for (const i of blend.ingredients) components.push({ type: 'ingredient', id: i.ingredientId });
  }
  return components;
}

// рейтинг кандидата для текущей смеси; blend — { bases: [{teaId, grams}], ingredients: [{ingredientId, grams}] }
// возвращает { score, worst, worstWith, pairs }
export function compatScore(candidate, blend, compatData) {
  if (isEmptyBlend(blend) && candidate.type === 'tea') {
    const s = suitabilityScore(candidate);
    return { score: s, worst: s, worstWith: null, pairs: [] };
  }

  const components = blendComponents(blend);
  if (components.length === 0) return { score: NEUTRAL, worst: NEUTRAL, worstWith: null, pairs: [] };

  const pairs = [];
  let worst = Infinity;
  let worstWith = null;
  let sum = 0;
  for (const comp of components) {
    const s = compat(candidate, comp, compatData);
    pairs.push({ with: comp, score: s });
    sum += s;
    if (s < worst) {
      worst = s;
      worstWith = comp;
    }
  }

  let score = WORST_WEIGHT * worst + AVG_WEIGHT * (sum / components.length);
  // одна откровенно плохая пара тянет весь итог вниз — не выше неё
  if (worst <= POOR_PAIR) score = Math.min(score, worst);
  return { score, worst, worstWith, pairs };
}

// числовой score в визуальный bucket из 5 уровней
export function bucket(score) {
  if (score >= 4.5) return { level: 'emerald', color: '#1e7a3b', fillPct: 100, label: 'Идеально' };
  if (score >= 3.7) return { level: 'sage', color: '#5b9b4a', fillPct: 80, label: 'Отлично' };
  if (score >= 2.7) return { level: 'amber', color: '#d49a2a', fillPct: 60, label: 'Сбалансировано' };
  if (score >= 1.7) return { level: 'terracotta', color: '#c66a32', fillPct: 40, label: 'Сомнительно' };
  return { level: 'clay-red', color: '#a93226', fillPct: 20, label: 'Не сочетается' };
}
