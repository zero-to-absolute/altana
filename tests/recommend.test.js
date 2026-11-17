import { describe, it, expect } from 'vitest';
import { genreFit, topIngredients } from '../src/js/constructor/recommend.js';

/**
 * Тесты алгоритма подбора рекомендованных ингредиентов конструктора.
 * Учитывает совместимость с уже выбранным составом и соответствие
 * выбранному жанру смеси.
 */

/**
 * Вспомогательная функция: возвращает тестовые characteristics и charData
 * с одной характеристикой «effect:бодрящий» (id = 18), назначенной
 * на указанный ингредиент.
 */
function makeCharFixtures({ ingredientId, charType, charName }) {
  const characteristics = new Map([
    [18, { type: charType, name: charName }],
  ]);
  const charData = {
    tea: new Map(),
    ing: new Map([[ingredientId, [18]]]),
  };
  return { characteristics, charData };
}

describe('constructor/genreFit', () => {
  it('возвращает 1 при отсутствии выбранного жанра', () => {
    const result = genreFit({ type: 'ingredient', id: 5 }, null, { tea: new Map(), ing: new Map() }, new Map());
    expect(result).toBe(1);
  });

  it('возвращает максимум для ингредиента с точной характеристикой жанра', () => {
    const { characteristics, charData } = makeCharFixtures({ ingredientId: 5, charType: 'effect', charName: 'бодрящий' });
    const result = genreFit({ type: 'ingredient', id: 5 }, 'bracing', charData, characteristics);
    expect(result).toBeGreaterThan(0);
  });

  it('возвращает 0 для ингредиента без характеристик жанра', () => {
    const characteristics = new Map([[18, { type: 'taste', name: 'кислый' }]]);
    const charData = { tea: new Map(), ing: new Map([[5, [18]]]) };
    const result = genreFit({ type: 'ingredient', id: 5 }, 'bracing', charData, characteristics);
    expect(result).toBe(0);
  });
});

/**
 * Тесты функции topIngredients — итоговый рейтинг кандидатов
 * по комбинации совместимости и соответствия жанру.
 */
describe('constructor/topIngredients', () => {
  it('возвращает не более count кандидатов', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `ing-${i + 1}`, portion_grams: 5, max_grams: 30 }));
    const result = topIngredients({
      candidates,
      blend: { bases: [], ingredients: [] },
      genre: null,
      compatData: { teaCompat: new Map(), ingCompat: new Map(), teaIngCompat: new Map() },
      charData: { tea: new Map(), ing: new Map() },
      characteristics: new Map(),
      count: 3,
    });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('исключает ингредиенты из excludeIds', () => {
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = topIngredients({
      candidates,
      blend: { bases: [], ingredients: [] },
      genre: null,
      compatData: { teaCompat: new Map(), ingCompat: new Map(), teaIngCompat: new Map() },
      charData: { tea: new Map(), ing: new Map() },
      characteristics: new Map(),
      count: 10,
      excludeIds: [2],
    });
    const ids = result.map((r) => r.ingredient.id);
    expect(ids).not.toContain(2);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
  });

  it('сортирует кандидатов по убыванию finalRank', () => {
    const candidates = [{ id: 1 }, { id: 2 }];
    const compatData = {
      teaCompat: new Map(),
      ingCompat: new Map(),
      teaIngCompat: new Map([
        ['1-1', { score: 5 }],
        ['1-2', { score: 2 }],
      ]),
    };
    const blend = { bases: [{ teaId: 1, grams: 100 }], ingredients: [] };
    const result = topIngredients({
      candidates,
      blend,
      genre: null,
      compatData,
      charData: { tea: new Map(), ing: new Map() },
      characteristics: new Map(),
      count: 10,
    });
    expect(result[0].ingredient.id).toBe(1);
    expect(result[1].ingredient.id).toBe(2);
  });
});
