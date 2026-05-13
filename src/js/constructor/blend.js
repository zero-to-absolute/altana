// Помощники для собранной смеси: цена, вес, иконка ингредиента, картинка чашки.

import { roundKopecks } from '../shared/utils.js';

// иконки Lucide по категории ингредиента
export const INGREDIENT_ICONS = {
  herb: 'sprout',
  flower: 'flower-2',
  spice: 'flame',
  citrus: 'citrus',
  dried_fruit: 'apple',
  sweetener: 'candy',
  other: 'package',
};

export function ingredientIcon(category) {
  return INGREDIENT_ICONS[category] || 'package';
}

const CUP_SLUGS = new Set(['black-tea', 'green-tea', 'oolong', 'puerh', 'white-tea', 'herbal', 'rooibos']);

// цвет заливки чашки по типу чая (контур — currentColor от tea-dark)
const CUP_COLORS = {
  'black-tea': '#5a3a26',
  'green-tea': '#4a7a3a',
  'oolong': '#c17f24',
  'puerh': '#6b4226',
  'white-tea': '#9e8e7a',
  'herbal': '#5c8c64',
  'rooibos': '#b05c2e',
  'default': '#6b5c50',
};

export function resolveCupSlug(slug) {
  return CUP_SLUGS.has(slug) ? slug : 'default';
}

// чай с наибольшим grams среди основ
function dominantTea(bases, teasById) {
  if (!bases || bases.length === 0) return null;
  const top = bases.reduce((acc, b) => (b.grams > acc.grams ? b : acc), bases[0]);
  return teasById.get(top.teaId) || null;
}

// чашка по доминирующему чаю основы
export function cupSlug(bases, teasById) {
  const tea = dominantTea(bases, teasById);
  return resolveCupSlug(tea?.category_slug || tea?.categories?.slug || '');
}

// автоимя смеси, когда пользователь не вписал своё
export function defaultRecipeName(bases, teasById) {
  const tea = dominantTea(bases, teasById);
  return tea?.name ? `Смесь с ${tea.name}` : 'Авторская смесь';
}

// inline-SVG чашки: корпус — fill цветом чая, стенки/ручка/пар — обводка по currentColor
export function cupIconHtml(slug, size = 64) {
  const color = CUP_COLORS[CUP_SLUGS.has(slug) ? slug : 'default'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block">
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" fill="${color}"/>
    <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <line x1="6" x2="6" y1="2" y2="4"/>
    <line x1="10" x2="10" y1="2" y2="4"/>
    <line x1="14" x2="14" y1="2" y2="4"/>
  </svg>`;
}

// на GitHub Pages base = '/altana/', поэтому путь строим через BASE_URL
export function cupUrl(slug) {
  return `${import.meta.env.BASE_URL}cups/${slug}.png`;
}

function priceOf(product, grams) {
  return product && typeof product.price_per_gram === 'number' ? product.price_per_gram * grams : 0;
}

// сумма стоимостей основ и ингредиентов
export function blendPrice(state, data) {
  let total = 0;
  for (const b of state.bases) total += priceOf(data.teasById.get(b.teaId), b.grams);
  for (const i of state.ingredients) total += priceOf(data.ingredientsById.get(i.ingredientId), i.grams);
  return roundKopecks(total);
}

export function blendGrams(state) {
  return state.bases.reduce((sum, b) => sum + b.grams, 0)
       + state.ingredients.reduce((sum, i) => sum + i.grams, 0);
}
