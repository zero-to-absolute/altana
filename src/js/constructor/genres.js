// Конфиг 5 жанров конструктора: метка, иконка Lucide и веса характеристик в формате "type:name".

// главный effect жанра весит больше всего — это не даёт чаю получить противоположные бейджи
// (бодрящий и успокаивающий сразу), а без основного эффекта компонент в жанр не попадает (genreFit >= 0.35)
export const GENRES = {
  bracing: { label: 'Бодрящий', icon: 'zap', weights: { 'effect:бодрящий': 5, 'effect:тонизирующий': 4, 'taste:терпкий': 1, 'aroma:дымный': 1 } },
  sweet: { label: 'Сладкий', icon: 'cookie', weights: { 'taste:сладкий': 2, 'taste:медовый': 2, 'taste:карамельный': 2, 'taste:сливочный': 1, 'aroma:ванильный': 2 } },
  calming: { label: 'Успокаивающий', icon: 'moon', weights: { 'effect:расслабляющий': 5, 'aroma:цветочный': 1, 'aroma:травяной': 1, 'taste:сливочный': 1 } },
  refreshing: { label: 'Освежающий', icon: 'wind', weights: { 'effect:освежающий': 4, 'aroma:свежий': 2, 'taste:цитрусовый': 1, 'aroma:хвойный': 1 } },
  spicy: { label: 'Пряный', icon: 'flame', weights: { 'aroma:пряный': 4, 'effect:согревающий': 2, 'taste:терпкий': 1, 'aroma:дымный': 1 } },
};

// короткие теги жанра для маленькой плашки над списками
export const GENRE_TAGS = {
  bracing: 'бодрит',
  sweet: 'сладкий',
  calming: 'успокаивает',
  refreshing: 'освежает',
  spicy: 'пряный',
};

// сумма весов жанра — для нормализации genreFit в диапазон [0,1]
export function maxWeightForGenre(genreCode) {
  const g = GENRES[genreCode];
  if (!g) return 0;
  let sum = 0;
  for (const key in g.weights) sum += g.weights[key];
  return sum;
}
