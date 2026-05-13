// Загрузка справочников конструктора из Supabase с кешем в памяти модуля; запросы пробрасывают понятные ошибки.

import { supabase } from '../shared/supabase.js';

let cache = null;

// чаи с категорией, только in_stock=true — выключенные с витрины не должны попадать в конструктор
// (иначе можно собрать смесь из недоступного компонента, и триггер БД отвалит уже на checkout)
export async function loadTeas() {
  try {
    const { data, error } = await supabase
      .from('teas')
      .select(
        'id, name, slug, description, category_id, price_per_gram, weight_grams, in_stock, blend_suitability, categories(id, name, slug)'
      )
      .eq('in_stock', true)
      .order('id');
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new Error(`Не удалось загрузить чаи: ${error.message || error}`);
  }
}

// ингредиенты, только in_stock=true (по той же причине, что и у чаёв)
export async function loadIngredients() {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select(
        'id, name, slug, description, price_per_gram, weight_grams, in_stock, category, portion_grams, max_grams, role_hint'
      )
      .eq('in_stock', true)
      .order('id');
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new Error(`Не удалось загрузить ингредиенты: ${error.message || error}`);
  }
}

// карта характеристик по id, значение — { type, name }
export async function loadCharacteristics() {
  try {
    const { data, error } = await supabase
      .from('characteristics')
      .select('id, type, name');
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      map.set(row.id, { type: row.type, name: row.name });
    }
    return map;
  } catch (error) {
    throw new Error(`Не удалось загрузить характеристики: ${error.message || error}`);
  }
}

// для каждого чая — массив id его характеристик
export async function loadTeaCharacteristics() {
  try {
    const { data, error } = await supabase
      .from('tea_characteristics')
      .select('tea_id, characteristic_id');
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      const arr = map.get(row.tea_id) || [];
      arr.push(row.characteristic_id);
      map.set(row.tea_id, arr);
    }
    return map;
  } catch (error) {
    throw new Error(`Не удалось загрузить характеристики чаёв: ${error.message || error}`);
  }
}

// для каждого ингредиента — массив id его характеристик
export async function loadIngredientCharacteristics() {
  try {
    const { data, error } = await supabase
      .from('ingredient_characteristics')
      .select('ingredient_id, characteristic_id');
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) {
      const arr = map.get(row.ingredient_id) || [];
      arr.push(row.characteristic_id);
      map.set(row.ingredient_id, arr);
    }
    return map;
  } catch (error) {
    throw new Error(`Не удалось загрузить характеристики ингредиентов: ${error.message || error}`);
  }
}

// три таблицы совместимости одним параллельным запросом
export async function loadAllCompat() {
  try {
    const [teaCompatRes, teaIngRes, ingRes] = await Promise.all([
      supabase.from('tea_compat').select('tea_a_id, tea_b_id, score'),
      supabase.from('tea_ingredient_compat').select('tea_id, ingredient_id, score, is_canonical_boost'),
      supabase.from('ingredient_compat').select('ingredient_a_id, ingredient_b_id, score'),
    ]);
    if (teaCompatRes.error) throw teaCompatRes.error;
    if (teaIngRes.error) throw teaIngRes.error;
    if (ingRes.error) throw ingRes.error;

    const teaCompat = new Map();
    for (const row of teaCompatRes.data || []) {
      const a = Math.min(row.tea_a_id, row.tea_b_id);
      const b = Math.max(row.tea_a_id, row.tea_b_id);
      teaCompat.set(`${a}-${b}`, row.score);
    }
    const teaIngCompat = new Map();
    for (const row of teaIngRes.data || []) {
      teaIngCompat.set(`${row.tea_id}-${row.ingredient_id}`, {
        score: row.score,
        isCanonicalBoost: row.is_canonical_boost,
      });
    }
    const ingCompat = new Map();
    for (const row of ingRes.data || []) {
      const a = Math.min(row.ingredient_a_id, row.ingredient_b_id);
      const b = Math.max(row.ingredient_a_id, row.ingredient_b_id);
      ingCompat.set(`${a}-${b}`, row.score);
    }
    return { teaCompat, teaIngCompat, ingCompat };
  } catch (error) {
    throw new Error(`Не удалось загрузить данные совместимости: ${error.message || error}`);
  }
}

// публичные рецепты для галереи готовых смесей
export async function loadPublicRecipes() {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(
        'id, name, description, genre, blend_format, total_grams, is_public, recipe_teas(tea_id, grams), recipe_ingredients(ingredient_id, grams)'
      )
      .eq('is_public', true);
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new Error(`Не удалось загрузить публичные рецепты: ${error.message || error}`);
  }
}

// грузит все справочники один раз параллельно и кеширует результат в модуле
export async function initData() {
  if (cache) return cache;
  const [teas, ingredients, characteristics, teaChars, ingChars, compat, publicRecipes] = await Promise.all([
    loadTeas(),
    loadIngredients(),
    loadCharacteristics(),
    loadTeaCharacteristics(),
    loadIngredientCharacteristics(),
    loadAllCompat(),
    loadPublicRecipes(),
  ]);

  cache = {
    teas,
    teasBySlug: new Map(teas.map((t) => [t.slug, t])),
    teasById: new Map(teas.map((t) => [t.id, t])),
    ingredients,
    ingredientsBySlug: new Map(ingredients.map((i) => [i.slug, i])),
    ingredientsById: new Map(ingredients.map((i) => [i.id, i])),
    characteristics,
    teaChars,
    ingChars,
    teaCompat: compat.teaCompat,
    teaIngCompat: compat.teaIngCompat,
    ingCompat: compat.ingCompat,
    publicRecipes,
    recipesById: new Map(publicRecipes.map((r) => [r.id, r])),
  };
  return cache;
}
