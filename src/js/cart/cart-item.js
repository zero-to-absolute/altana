// Помощники для строк корзины: позиция — это чай, ингредиент, авторский рецепт или удалённый
// из каталога товар, и у всех одинаковая форма после JOIN-запроса.

import { calculatePrice, roundKopecks } from '../shared/utils.js';

export function itemName(item) {
  if (item.teas) return item.teas.name ?? 'Чай';
  if (item.ingredients) return item.ingredients.name ?? 'Ингредиент';
  if (item.recipes) return item.recipes.name ?? 'Авторская смесь';
  return 'Удалённая позиция';
}

// граммовка одной единицы (для чая выбор пользователя приоритетнее стандартной фасовки)
export function itemWeight(item) {
  if (item.teas) return item.weight_grams ?? item.teas.weight_grams ?? null;
  if (item.ingredients) return item.ingredients.weight_grams ?? null;
  return null;
}

export function itemImage(item) {
  return item.teas?.image_url ?? item.ingredients?.image_url ?? item.recipes?.image_url ?? '';
}

// сумма стоимостей компонентов рецепта (rows — recipe_teas либо recipe_ingredients)
function componentsCost(rows, productKey) {
  return (rows ?? []).reduce((sum, row) => {
    const product = row[productKey];
    if (!product) return sum;
    return sum + calculatePrice(Number(product.price_per_gram), Number(row.grams ?? 0));
  }, 0);
}

// цена одной единицы позиции, без учёта quantity
export function unitPrice(item) {
  if (item.teas) {
    const grams = item.weight_grams ?? item.teas.weight_grams ?? 0;
    return calculatePrice(Number(item.teas.price_per_gram), grams);
  }
  if (item.ingredients) {
    return calculatePrice(Number(item.ingredients.price_per_gram), item.ingredients.weight_grams ?? 0);
  }
  if (item.recipes) {
    const bases = componentsCost(item.recipes.recipe_teas, 'teas');
    const extras = componentsCost(item.recipes.recipe_ingredients, 'ingredients');
    return roundKopecks(bases + extras);
  }
  return 0;
}

export function lineTotal(item) {
  return roundKopecks(unitPrice(item) * item.quantity);
}

// чай и ингредиент проверяем по in_stock, рецепт недоступен только если недоступны все его чаи-основы
export function isOutOfStock(item) {
  if (item.teas) return item.teas.in_stock === false;
  if (item.ingredients) return item.ingredients.in_stock === false;
  if (item.recipes) {
    const bases = (item.recipes.recipe_teas ?? []).map((rt) => rt.teas).filter(Boolean);
    if (bases.length === 0) return false;
    return bases.every((tea) => tea.in_stock === false);
  }
  return false;
}
