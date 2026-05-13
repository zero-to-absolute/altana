// Подбор кандидатов: соответствие жанру + рейтинг совместимости.

import { GENRES, maxWeightForGenre } from './genres.js';
import { compatScore } from './compatibility.js';

// нижняя граница множителя жанра — слабое соответствие штрафует ранг, но не обнуляет совместимость
const GENRE_FLOOR = 0.5;

// соответствие компонента выбранному жанру в диапазоне [0,1]; при genre === null штрафа нет (возвращаем 1).
// charData — { tea: Map<teaId, charId[]>, ing: Map<ingId, charId[]> }, characteristics — Map<charId, {type,name}>
export function genreFit(component, genre, charData, characteristics) {
  if (genre === null || genre === undefined) return 1;
  const def = GENRES[genre];
  if (!def) return 1;

  const map = component.type === 'tea' ? charData.tea : charData.ing;
  const charIds = (map && map.get(component.id)) || [];
  let weightSum = 0;
  for (const charId of charIds) {
    const ch = characteristics.get(charId);
    if (ch) weightSum += def.weights[`${ch.type}:${ch.name}`] ?? 0;
  }

  const max = maxWeightForGenre(genre);
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, weightSum / max));
}

// топ-N ингредиентов-кандидатов для текущей смеси и жанра; элемент — { ingredient, finalRank, compat, genreFit }
export function topIngredients({ candidates, blend, genre, compatData, charData, characteristics, count = 5, excludeIds = [] }) {
  const exclude = new Set(excludeIds);
  const ranked = [];
  for (const candidate of candidates) {
    if (exclude.has(candidate.id)) continue;
    const compat = compatScore({ type: 'ingredient', id: candidate.id }, blend, compatData);
    const fit = genreFit({ type: 'ingredient', id: candidate.id }, genre, charData, characteristics);
    const finalRank = compat.score * (GENRE_FLOOR + (1 - GENRE_FLOOR) * fit);
    ranked.push({ ingredient: candidate, finalRank, compat, genreFit: fit });
  }
  ranked.sort((a, b) => b.finalRank - a.finalRank);
  return ranked.slice(0, count);
}
