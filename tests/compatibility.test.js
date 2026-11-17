import { describe, it, expect } from 'vitest';
import { compat, suitabilityScore, compatScore, bucket } from '../src/js/constructor/compatibility.js';

/**
 * Вспомогательная функция для создания mock-структуры compatData.
 * compatData содержит три Map-а: teaCompat, ingCompat, teaIngCompat.
 */
function makeCompatData({ teaCompat = [], ingCompat = [], teaIngCompat = [] } = {}) {
  return {
    teaCompat: new Map(teaCompat),
    ingCompat: new Map(ingCompat),
    teaIngCompat: new Map(teaIngCompat),
  };
}

/**
 * Тесты функции compat — оценка одной пары компонентов
 * (чай-чай, ингредиент-ингредиент или чай-ингредиент).
 */
describe('constructor/compat', () => {
  it('возвращает нейтральное значение 3, если compatData отсутствует', () => {
    expect(compat({ type: 'tea', id: 1 }, { type: 'tea', id: 2 }, null)).toBe(3);
  });

  it('возвращает значение из teaIngCompat для пары чай и ингредиент', () => {
    const data = makeCompatData({ teaIngCompat: [['1-5', { score: 5 }]] });
    expect(compat({ type: 'tea', id: 1 }, { type: 'ingredient', id: 5 }, data)).toBe(5);
  });

  it('возвращает 3 для пары без явной оценки', () => {
    const data = makeCompatData();
    expect(compat({ type: 'tea', id: 1 }, { type: 'ingredient', id: 5 }, data)).toBe(3);
  });
});

/**
 * Тесты функции suitabilityScore — базовый рейтинг чая
 * по полю blend_suitability.
 */
describe('constructor/suitabilityScore', () => {
  it('возвращает значение поля blend_suitability чая', () => {
    expect(suitabilityScore({ blend_suitability: 4 })).toBe(4);
  });

  it('возвращает 3 при отсутствии поля', () => {
    expect(suitabilityScore({})).toBe(3);
  });
});

/**
 * Тесты функции compatScore — итоговый рейтинг кандидата
 * для текущего состава смеси. Возвращает объект
 * { score, worst, worstWith, pairs }.
 */
describe('constructor/compatScore', () => {
  it('возвращает базовый suitabilityScore чая при пустом составе', () => {
    const result = compatScore({ type: 'tea', id: 1, blend_suitability: 4 }, { bases: [], ingredients: [] }, null);
    expect(result.score).toBe(4);
  });

  it('возвращает максимум при идеальной совместимости всех пар', () => {
    const data = makeCompatData({ teaIngCompat: [['1-5', { score: 5 }]] });
    const blend = { bases: [{ teaId: 1, grams: 100 }], ingredients: [] };
    const result = compatScore({ type: 'ingredient', id: 5 }, blend, data);
    expect(result.score).toBe(5);
  });

  it('ограничивает итог худшей парой, если она не выше 2', () => {
    const data = makeCompatData({
      teaIngCompat: [
        ['1-5', { score: 5 }],
        ['2-5', { score: 1 }],
      ],
    });
    const blend = { bases: [{ teaId: 1, grams: 50 }, { teaId: 2, grams: 50 }], ingredients: [] };
    const result = compatScore({ type: 'ingredient', id: 5 }, blend, data);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.worst).toBe(1);
  });
});

/**
 * Тесты функции bucket — преобразование числового score
 * в визуальный уровень с цветом и подписью.
 */
describe('constructor/bucket', () => {
  it('возвращает уровень emerald (Идеально) для score 4.8', () => {
    expect(bucket(4.8).level).toBe('emerald');
    expect(bucket(4.8).label).toBe('Идеально');
  });

  it('возвращает уровень clay-red (Не сочетается) для score 1.2', () => {
    expect(bucket(1.2).level).toBe('clay-red');
    expect(bucket(1.2).label).toBe('Не сочетается');
  });

  it('возвращает уровень sage (Отлично) для score 4.0', () => {
    expect(bucket(4.0).level).toBe('sage');
  });

  it('возвращает уровень amber (Сбалансировано) для score 3.0', () => {
    expect(bucket(3.0).level).toBe('amber');
  });
});
