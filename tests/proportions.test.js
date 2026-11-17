import { describe, it, expect } from 'vitest';
import {
  ingredientsBudget,
  clampIngredientsToBudget,
  minIngGrams,
  canAddIngredient,
  ingredientGramsRange,
  canIncreaseIngredient,
  distributeBases,
  teaGramsRange,
  MAX_INGREDIENTS,
  TOTAL_BASE_PCT,
} from '../src/js/constructor/proportions.js';

/**
 * Тесты модуля распределения массы компонентов смеси.
 * Модель: чаи занимают 60 процентов всей смеси (TOTAL_BASE_PCT),
 * остаток в 40 процентов отдаётся ингредиентам.
 */
describe('constructor/ingredientsBudget', () => {
  it('возвращает 67 г бюджета ингредиентов при 100 г основы', () => {
    expect(ingredientsBudget(100)).toBe(67);
  });

  it('возвращает 33 г бюджета при 50 г основы', () => {
    expect(ingredientsBudget(50)).toBe(33);
  });
});

describe('constructor/minIngGrams', () => {
  it('возвращает минимум на ингредиент при равном делении бюджета', () => {
    expect(minIngGrams(100)).toBe(Math.floor(67 / MAX_INGREDIENTS));
  });
});

/**
 * Тесты функции canAddIngredient — проверка возможности добавления
 * нового ингредиента в смесь с учётом бюджета и ограничений.
 */
describe('constructor/canAddIngredient', () => {
  const newIngredient = { portion_grams: 5, max_grams: 30 };

  it('разрешает добавление при пустом составе', () => {
    const result = canAddIngredient({ newIngredient, currentIngredients: [], totalBaseGrams: 100 });
    expect(result.ok).toBe(true);
    expect(result.proposedGrams).toBe(5);
  });

  it('блокирует добавление при достижении лимита по количеству', () => {
    const currentIngredients = Array.from({ length: MAX_INGREDIENTS }, (_, i) => ({ ingredientId: i + 1, grams: 1 }));
    const result = canAddIngredient({ newIngredient, currentIngredients, totalBaseGrams: 100 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('limit_count');
  });

  it('возвращает свободный остаток как proposedGrams при ограниченном месте', () => {
    const currentIngredients = [{ ingredientId: 1, grams: 65 }];
    const result = canAddIngredient({ newIngredient, currentIngredients, totalBaseGrams: 100 });
    expect(result.ok).toBe(true);
    expect(result.proposedGrams).toBe(2);
  });
});

/**
 * Тесты функции clampIngredientsToBudget — подгонка масс
 * ингредиентов под имеющийся бюджет.
 */
describe('constructor/clampIngredientsToBudget', () => {
  it('возвращает исходный массив, если сумма в пределах бюджета', () => {
    const input = [{ ingredientId: 1, grams: 30 }, { ingredientId: 2, grams: 20 }];
    expect(clampIngredientsToBudget(input, 100)).toEqual(input);
  });

  it('сжимает массы пропорционально при превышении бюджета', () => {
    const input = [{ ingredientId: 1, grams: 60 }, { ingredientId: 2, grams: 40 }];
    const result = clampIngredientsToBudget(input, 100);
    const total = result.reduce((sum, i) => sum + i.grams, 0);
    expect(total).toBe(67);
  });

  it('возвращает пустой массив на пустом входе', () => {
    expect(clampIngredientsToBudget([], 100)).toEqual([]);
  });
});

/**
 * Тесты функции distributeBases — равномерное распределение
 * массы основы между несколькими чаями.
 */
describe('constructor/distributeBases', () => {
  it('распределяет 100 г поровну между двумя чаями', () => {
    expect(distributeBases(100, [1, 2])).toEqual([
      { teaId: 1, grams: 50 },
      { teaId: 2, grams: 50 },
    ]);
  });

  it('добавляет остаток деления через round-robin', () => {
    expect(distributeBases(100, [1, 2, 3])).toEqual([
      { teaId: 1, grams: 34 },
      { teaId: 2, grams: 33 },
      { teaId: 3, grams: 33 },
    ]);
  });

  it('возвращает пустой массив при отсутствии чаёв', () => {
    expect(distributeBases(100, [])).toEqual([]);
  });
});

/**
 * Тесты функции canIncreaseIngredient — проверка возможности
 * прибавить 1 г существующему ингредиенту.
 */
describe('constructor/canIncreaseIngredient', () => {
  it('разрешает увеличение при наличии свободного бюджета', () => {
    const ingredient = { max_grams: 30 };
    const currentIngredients = [{ ingredientId: 1, grams: 5 }];
    expect(canIncreaseIngredient({ ingredient, currentIngredients, totalBaseGrams: 100, ingredientId: 1 })).toBe(true);
  });

  it('блокирует увеличение при достижении max_grams ингредиента', () => {
    const ingredient = { max_grams: 5 };
    const currentIngredients = [{ ingredientId: 1, grams: 5 }];
    expect(canIncreaseIngredient({ ingredient, currentIngredients, totalBaseGrams: 100, ingredientId: 1 })).toBe(false);
  });
});

describe('constructor/teaGramsRange', () => {
  it('возвращает диапазон от 1 до totalBaseGrams при единственном чае', () => {
    expect(teaGramsRange({ totalBaseGrams: 100, currentBases: [{ teaId: 1 }], teaId: 1 })).toEqual({ min: 1, max: 100 });
  });
});

describe('constructor/TOTAL_BASE_PCT', () => {
  it('значение константы соответствует модели 60 процентов', () => {
    expect(TOTAL_BASE_PCT).toBe(0.6);
  });
});
