// Пропорции смеси: бюджет ингредиентов, диапазоны граммовки, распределение основы.
// Модель: чаи занимают TOTAL_BASE_PCT всей смеси, поэтому ингредиентам остаётся
// (1 - TOTAL_BASE_PCT) / TOTAL_BASE_PCT от массы основы.

export const TOTAL_BASE_PCT = 0.6;
export const MAX_INGREDIENTS = 8;
export const BASE_PRESETS = [50, 100, 200, 300];
const MIN_GRAMS = 1; // минимальная граммовка одного компонента смеси

// бюджет в граммах на все ингредиенты при заданной массе основы (для 100 г основы — 67 г)
export function ingredientsBudget(totalBaseGrams) {
  return Math.round((totalBaseGrams * (1 - TOTAL_BASE_PCT)) / TOTAL_BASE_PCT);
}

// подгоняет граммы ингредиентов под бюджет: если сумма превышает — сжимает пропорционально,
// но не ниже MIN_GRAMS каждому; если уже в пределах — возвращает массив как есть
export function clampIngredientsToBudget(ingredients, totalBaseGrams) {
  if (!ingredients || ingredients.length === 0) return ingredients ?? [];
  const budget = ingredientsBudget(totalBaseGrams);
  const used = ingredients.reduce((sum, i) => sum + i.grams, 0);
  if (used <= budget) return ingredients;

  const scaled = ingredients.map((i) => ({
    ...i,
    grams: Math.max(MIN_GRAMS, Math.floor((i.grams / used) * budget)),
  }));
  // погрешность округления добавляем/убираем у самого крупного, чтобы сумма точно сошлась с бюджетом
  const diff = budget - scaled.reduce((sum, i) => sum + i.grams, 0);
  if (diff !== 0) {
    let idx = 0;
    for (let k = 1; k < scaled.length; k++) {
      if (scaled[k].grams > scaled[idx].grams) idx = k;
    }
    scaled[idx].grams = Math.max(MIN_GRAMS, scaled[idx].grams + diff);
  }
  return scaled;
}

// минимум на один ингредиент при равном делении бюджета на максимум компонентов
export function minIngGrams(totalBaseGrams) {
  return Math.max(MIN_GRAMS, Math.floor(ingredientsBudget(totalBaseGrams) / MAX_INGREDIENTS));
}

// можно ли добавить ингредиент: возвращает { ok, reason?, proposedGrams?, proposedRedistribution? }
export function canAddIngredient({ newIngredient, currentIngredients, totalBaseGrams }) {
  if (currentIngredients.length >= MAX_INGREDIENTS) return { ok: false, reason: 'limit_count' };

  const budget = ingredientsBudget(totalBaseGrams);
  const used = currentIngredients.reduce((sum, c) => sum + c.grams, 0);
  const free = budget - used;
  const desired = Math.min(newIngredient.portion_grams, newIngredient.max_grams);

  if (free >= MIN_GRAMS) {
    const proposedGrams = Math.min(desired, free);
    if (proposedGrams >= MIN_GRAMS) return { ok: true, proposedGrams, proposedRedistribution: [] };
  }

  // свободного места не хватило — пробуем сжать существующие до минимума, оставив новому хотя бы MIN_GRAMS
  const n = currentIngredients.length;
  if (budget - n < MIN_GRAMS) return { ok: false, reason: 'no_space' };

  const target = budget - MIN_GRAMS;
  const totalCurrent = used > 0 ? used : 1;
  const proposedRedistribution = currentIngredients.map((c) => ({
    ingredientId: c.ingredientId,
    newGrams: Math.max(MIN_GRAMS, Math.floor((c.grams / totalCurrent) * target)),
  }));
  const sumNew = proposedRedistribution.reduce((sum, c) => sum + c.newGrams, 0);
  const proposedGrams = budget - sumNew;
  if (proposedGrams >= MIN_GRAMS) return { ok: true, proposedGrams, proposedRedistribution };
  return { ok: false, reason: 'no_space' };
}

// диапазон граммовки ингредиента, если остальные сжаты до минимума
export function ingredientGramsRange({ ingredient, currentIngredients, totalBaseGrams, ingredientId }) {
  const budget = ingredientsBudget(totalBaseGrams);
  const othersMin = currentIngredients.filter((c) => c.ingredientId !== ingredientId).length * MIN_GRAMS;
  return { min: MIN_GRAMS, max: Math.max(MIN_GRAMS, Math.min(ingredient.max_grams, budget - othersMin)) };
}

// можно ли прибавить ингредиенту 1 г прямо сейчас (запас по бюджету и личный лимит max_grams)
export function canIncreaseIngredient({ ingredient, currentIngredients, totalBaseGrams, ingredientId }) {
  const item = currentIngredients.find((i) => i.ingredientId === ingredientId);
  if (!item || item.grams >= ingredient.max_grams) return false;
  const used = currentIngredients.reduce((sum, c) => sum + c.grams, 0);
  return used < ingredientsBudget(totalBaseGrams);
}

// равное распределение основы между чаями, остаток деления раздаём по одному через round-robin
export function distributeBases(totalBaseGrams, baseTeasIds) {
  const n = baseTeasIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalBaseGrams / n);
  const remainder = totalBaseGrams - base * n;
  return baseTeasIds.map((teaId, idx) => ({ teaId, grams: base + (idx < remainder ? 1 : 0) }));
}

// диапазон граммовки чая в основе, если остальные чаи сжаты до минимума
export function teaGramsRange({ totalBaseGrams, currentBases, teaId }) {
  const othersMin = currentBases.filter((b) => b.teaId !== teaId).length * MIN_GRAMS;
  return { min: MIN_GRAMS, max: Math.max(MIN_GRAMS, totalBaseGrams - othersMin) };
}
