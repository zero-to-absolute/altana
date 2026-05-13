// Шаг 0 конструктора: выбор настроения (жанра) и готовые рецепты.

import { GENRES } from './genres.js';
import { update, loadFromRecipe, reset } from './state.js';
import { escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/toast.js';

function genreTileHtml(code, genre) {
  return `
    <button class="genre-tile rounded-sm" data-genre="${escapeHtml(code)}" type="button" aria-label="${escapeHtml(genre.label)}">
      <i data-lucide="${escapeHtml(genre.icon)}" size="32"></i>
      <span>${escapeHtml(genre.label)}</span>
    </button>
  `;
}

const SKIP_TILE_HTML = `
  <button class="genre-tile rounded-sm" data-genre="skip" type="button" aria-label="Пропустить выбор жанра">
    <i data-lucide="dice-5" size="32"></i>
    <span>Пропустить</span>
  </button>
`;

function presetCardHtml(recipe) {
  return `
    <div class="preset-card rounded-sm" data-recipe-id="${escapeHtml(String(recipe.id))}" role="button" tabindex="0"
         aria-label="Взять рецепт: ${escapeHtml(recipe.name ?? '')}">
      <p class="preset-name">${escapeHtml(recipe.name ?? 'Без названия')}</p>
      <p class="preset-meta">${escapeHtml(recipe.description ?? '')}</p>
    </div>
  `;
}

function presetsHtml(recipes) {
  if (recipes.length === 0) return `<p class="text-tea-dark/50 text-sm mt-4">Готовых рецептов пока нет</p>`;
  return `<div class="preset-row mt-4">${recipes.map(presetCardHtml).join('')}</div>`;
}

export function mountStep0({ container, data }) {
  const publicRecipes = data?.publicRecipes ?? [];
  const genreTiles = Object.entries(GENRES).map(([code, genre]) => genreTileHtml(code, genre)).join('');

  container.innerHTML = `
    <div class="max-w-3xl">
      <h2 class="text-4xl md:text-5xl font-serif text-tea-dark mb-3 leading-tight">С чего начнём?</h2>
      <p class="text-tea-dark/60 mb-10 text-sm leading-relaxed">
        Выберите настроение будущей смеси — система подберёт подходящие чаи и ингредиенты.<br>
        Или возьмите за основу один из готовых рецептов.
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-14" id="genre-grid">
        ${genreTiles}
        ${SKIP_TILE_HTML}
      </div>

      <div class="mb-14">
        <button id="start-from-scratch" class="btn-ghost" type="button">Собрать с нуля</button>
      </div>

      <div>
        <h3 class="text-xl font-serif text-tea-dark mb-2">Готовые рецепты</h3>
        <p class="text-tea-dark/50 text-sm mb-4">Возьмите проверенный рецепт за основу и доработайте под себя.</p>
        ${presetsHtml(publicRecipes)}
      </div>
    </div>
  `;

  container.querySelector('#genre-grid')?.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-genre]');
    if (!tile) return;
    const code = tile.dataset.genre;
    update({ genre: code === 'skip' ? null : code, step: 1 });
  });

  container.querySelector('#start-from-scratch')?.addEventListener('click', () => {
    reset();
    update({ step: 1 });
  });

  const presetRow = container.querySelector('.preset-row');
  if (presetRow) {
    const pickRecipe = (card) => {
      // у публичных рецептов id — uuid (строка), не число
      const recipe = publicRecipes.find((r) => String(r.id) === card.dataset.recipeId);
      if (!recipe) return;
      loadFromRecipe(recipe);
      showToast(`Рецепт «${recipe.name ?? 'выбран'}» загружен`);
    };
    presetRow.addEventListener('click', (e) => {
      const card = e.target.closest('[data-recipe-id]');
      if (card) pickRecipe(card);
    });
    presetRow.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-recipe-id]');
      if (!card) return;
      e.preventDefault();
      pickRecipe(card);
    });
  }

  window.lucide?.createIcons();
}
