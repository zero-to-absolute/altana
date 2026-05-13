// Состояние конструктора: singleton с подпиской и автосохранением в sessionStorage.

import { clampIngredientsToBudget } from './proportions.js';

const SESSION_KEY = 'teashop.constructor.draft';

export const DEFAULT_STATE = {
  step: 0,
  genre: null,
  bases: [],
  totalBaseGrams: 100,
  ingredients: [],
  blendFormat: 'blend',
  recipeName: '',
  cartItemId: null,   // если пришли из корзины — id строки cart_items для удаления после сохранения
  editRecipeId: null, // если пришли из профиля — id рецепта для перезаписи в БД
};

let current = { ...DEFAULT_STATE };
const listeners = new Set();

// копия текущего состояния, чтобы внешний код не мутировал внутреннее
export function getState() {
  return { ...current };
}

// подписка на изменения, возвращает функцию-отписчик
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(prev) {
  for (const fn of listeners) {
    try {
      fn(current, prev);
    } catch (e) {
      console.error('state subscriber failed', e);
    }
  }
}

// мерж патча, сохранение в session, уведомление подписчиков; после любого update сумма
// ingredients не превышает бюджет — иначе сжимаем clamp-ом, чтобы «свободно» не уходило в минус
export function update(patch) {
  const prev = { ...current };
  current = { ...current, ...patch };
  if (Array.isArray(current.ingredients) && current.ingredients.length > 0) {
    current.ingredients = clampIngredientsToBudget(current.ingredients, current.totalBaseGrams);
  }
  saveToSession();
  notify(prev);
}

// сброс к дефолту и очистка session
export function reset() {
  const prev = { ...current };
  current = { ...DEFAULT_STATE };
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage может быть недоступен (приватный режим и т.п.)
  }
  notify(prev);
}

export function saveToSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(current));
  } catch {
    // sessionStorage может быть недоступен — это не критично
  }
}

// восстановление из session с проверкой формы объекта
export function loadFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return getState();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return getState();
    if (!('step' in parsed) || !Array.isArray(parsed.bases) || !Array.isArray(parsed.ingredients)) return getState();
    current = { ...DEFAULT_STATE, ...parsed };
    return getState();
  } catch {
    return getState();
  }
}

// загрузка состояния из публичного рецепта (кнопка «взять за основу»)
export function loadFromRecipe(recipe) {
  const bases = (recipe.recipe_teas || []).map((t) => ({ teaId: t.tea_id, grams: t.grams }));
  const rawIngredients = (recipe.recipe_ingredients || []).map((i) => ({ ingredientId: i.ingredient_id, grams: i.grams }));
  // totalBaseGrams берём как фактическую сумму основ; recipes.total_grams включает и ингредиенты,
  // поэтому от него бюджет ингредиентов уходил в минус
  const totalBaseGrams = bases.reduce((sum, b) => sum + b.grams, 0) || 100;
  update({
    step: 2,
    genre: recipe.genre || null,
    bases,
    totalBaseGrams,
    ingredients: clampIngredientsToBudget(rawIngredients, totalBaseGrams),
    blendFormat: recipe.blend_format || 'blend',
    recipeName: recipe.name || '',
  });
}
