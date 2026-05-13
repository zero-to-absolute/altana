// Страница «Сохранённые рецепты»: купажи пользователя (recipes.author_id = user.id) и их состав.
// Inline-переименование, удаление с подтверждением, заказ рецепта, переход в конструктор.

import { supabase } from '../shared/supabase.js';
import { mountProfileSidebar, requireAuth } from '../shared/profile-sidebar.js';
import { escapeHtml, getErrorMessage, pluralize } from '../shared/utils.js';
import { addToCart } from '../cart/cart.js';
import { resolveCupSlug, cupIconHtml } from '../constructor/blend.js';

const REMOVE_ANIMATION_MS = 450;

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

let recipes = [];

async function loadRecipes(userId) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      id, name, description, image_url, created_at,
      recipe_teas ( grams, teas ( id, name, categories ( name, slug ) ) ),
      recipe_ingredients ( ingredients ( id, name ) )
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function renameRecipe(recipeId, newName) {
  const { error } = await supabase.from('recipes').update({ name: newName }).eq('id', recipeId);
  if (error) throw error;
}

async function deleteRecipe(recipeId) {
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
  if (error) throw error;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// основной чай рецепта — с наибольшим количеством граммов
function primaryTea(recipe) {
  const top = (recipe.recipe_teas ?? []).reduce((best, rt) => (!best || rt.grams > best.grams ? rt : best), null);
  return top?.teas ?? null;
}

function recipeTags(recipe) {
  const teaName = primaryTea(recipe)?.name;
  const ingredientNames = (recipe.recipe_ingredients ?? []).map((ri) => ri.ingredients?.name);
  return [teaName, ...ingredientNames].filter(Boolean);
}

function recipeCardHtml(recipe) {
  const slug = resolveCupSlug(primaryTea(recipe)?.categories?.slug ?? '');
  const tagsHtml = recipeTags(recipe).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
  return `
    <article class="recipe-card bg-white border border-bone p-6 flex flex-col" data-recipe-id="${recipe.id}">
      <div class="aspect-[4/3] bg-linen mb-5 flex items-center justify-center relative overflow-hidden">
        ${cupIconHtml(slug, 80)}
      </div>
      <h4 class="text-xl font-serif text-tea-dark mb-2 rec-name cursor-text" title="Нажмите, чтобы переименовать">${escapeHtml(recipe.name)}</h4>
      <div class="flex flex-wrap gap-1.5 mb-4">${tagsHtml}</div>
      <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-5">Создан ${formatDate(recipe.created_at)}</div>
      <div class="mt-auto flex items-center gap-2">
        <button class="btn-primary flex-1 text-xs inline-flex items-center justify-center gap-2" data-action="cart">
          <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>Заказать
        </button>
        <button class="btn-ghost rec-edit" style="padding:0.65rem 1rem" data-action="edit" title="Редактировать рецепт" aria-label="Редактировать">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button class="btn-ghost rec-delete" style="padding:0.65rem 1rem" data-action="delete" title="Удалить рецепт" aria-label="Удалить">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </article>
  `;
}

function createCardHtml() {
  return `
    <a href="constructor.html" class="dashed-card flex flex-col items-center justify-center text-center py-16 px-6 min-h-[420px] group">
      <div class="w-16 h-16 rounded-full bg-white border border-bone flex items-center justify-center mb-5 group-hover:border-almond-silk group-hover:bg-almond-silk group-hover:text-white transition-all">
        <i data-lucide="plus" class="w-7 h-7"></i>
      </div>
      <h4 class="text-xl font-serif text-tea-dark mb-2">Создать рецепт</h4>
      <p class="text-xs text-tea-dark/50 max-w-[200px] leading-relaxed">Соберите новый купаж в конструкторе смесей</p>
    </a>
  `;
}

function renderGrid() {
  const grid = document.getElementById('recipes-grid');
  if (grid) {
    grid.innerHTML = createCardHtml() + recipes.map(recipeCardHtml).join('');
    grid.classList.remove('hidden');
  }
  const counter = document.getElementById('recipes-counter');
  if (counter) {
    counter.textContent = recipes.length === 0
      ? 'Пока нет авторских купажей'
      : `${recipes.length} ${pluralize(recipes.length, ['авторский купаж', 'авторских купажа', 'авторских купажей'])}`;
  }
  window.lucide?.createIcons();
}

// заменяет заголовок на input, по Enter/blur сохраняет, по Escape отменяет
function startRename(card, nameEl) {
  const recipeId = card.dataset.recipeId;
  const original = nameEl.textContent.trim();

  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = original;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;

    const typed = input.value.trim();
    const heading = document.createElement('h4');
    heading.className = 'text-xl font-serif text-tea-dark mb-2 rec-name cursor-text';
    heading.title = 'Нажмите, чтобы переименовать';
    heading.textContent = typed || original;
    input.replaceWith(heading);

    if (!typed || typed === original) return;
    try {
      await renameRecipe(recipeId, typed);
      const target = recipes.find((r) => r.id === recipeId);
      if (target) target.name = typed;
    } catch (err) {
      heading.textContent = original;
      alert(getErrorMessage(err, 'renameRecipe'));
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  });
}

async function handleDelete(card, btn) {
  const recipeId = card.dataset.recipeId;
  const name = card.querySelector('.rec-name')?.textContent.trim() || 'этот рецепт';
  if (!confirm(`Удалить «${name}»?`)) return;

  btn.disabled = true;
  try {
    await deleteRecipe(recipeId);
    card.classList.add('removing');
    setTimeout(() => {
      recipes = recipes.filter((r) => r.id !== recipeId);
      renderGrid();
    }, REMOVE_ANIMATION_MS);
  } catch (err) {
    btn.disabled = false;
    alert(getErrorMessage(err, 'deleteRecipe'));
  }
}

async function handleAddToCart(card, btn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Добавляем…';
  try {
    const res = await addToCart({ recipe_id: card.dataset.recipeId, quantity: 1, blend_format: 'blend' });
    if (!res.ok) throw new Error(res.error || 'Не удалось добавить в корзину');
    window.location.href = 'cart.html';
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    window.lucide?.createIcons();
    alert(getErrorMessage(err, 'addToCart'));
  }
}

function onGridClick(event) {
  const nameEl = event.target.closest('.rec-name');
  if (nameEl) {
    startRename(nameEl.closest('.recipe-card'), nameEl);
    return;
  }
  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;
  event.stopPropagation();
  const card = actionBtn.closest('.recipe-card');
  if (!card) return;

  const action = actionBtn.dataset.action;
  if (action === 'delete') handleDelete(card, actionBtn);
  else if (action === 'cart') handleAddToCart(card, actionBtn);
  else if (action === 'edit') {
    window.location.href = `${import.meta.env.BASE_URL}src/pages/constructor.html?edit=${card.dataset.recipeId}&mode=recipe`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  await mountProfileSidebar('recipes');

  const loadingEl = document.getElementById('recipes-loading');
  try {
    recipes = await loadRecipes(user.id);
  } catch (err) {
    loadingEl?.classList.add('hidden');
    const errorEl = document.getElementById('recipes-error');
    if (errorEl) {
      errorEl.textContent = getErrorMessage(err, 'loadRecipes');
      errorEl.classList.remove('hidden');
    }
    return;
  }

  loadingEl?.classList.add('hidden');
  renderGrid();
  document.getElementById('recipes-grid')?.addEventListener('click', onGridClick);
});
