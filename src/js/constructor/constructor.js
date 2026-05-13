// Оркестратор конструктора: переключение шагов, загрузка данных, ленивый монтаж UI шагов.

import { initData } from './data.js';
import { supabase } from '../shared/supabase.js';
import { getState, loadFromSession, subscribe, update, reset, loadFromRecipe } from './state.js';
import { mountStep0 } from './render-step0.js';
import { mountStep1 } from './render-step1.js';
import { mountStep2 } from './render-step2.js';
import { mountStep3 } from './render-step3.js';
import { escapeHtml } from '../shared/utils.js';

const LAST_STEP = 3;
const STEP_MOUNTERS = { 0: mountStep0, 1: mountStep1, 2: mountStep2, 3: mountStep3 };

const stepSections = [
  document.getElementById('step-0'),
  document.getElementById('step-1'),
  document.getElementById('step-2'),
  document.getElementById('step-3'),
];
const stepperItems = document.querySelectorAll('#stepper li');

const mountedSteps = new Set();

// шаг 1 доступен всегда; шаг 2 — при хотя бы одной основе; шаг 3 — при ингредиентах или двух основах
function maxAllowedStep(state) {
  if (!state.bases || state.bases.length === 0) return 1;
  return state.ingredients.length > 0 || state.bases.length >= 2 ? 3 : 2;
}

function parseStep(value) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 && n <= LAST_STEP ? n : null;
}

function mountStep(step, data) {
  if (mountedSteps.has(step)) return;
  const container = document.getElementById(`step-${step}`);
  if (!container) return;
  STEP_MOUNTERS[step]({ container, data });
  mountedSteps.add(step);
}

function showDataError(message) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div class="flex flex-col items-center justify-center py-32 text-center gap-6">
      <div class="w-16 h-16 bg-linen rounded-full flex items-center justify-center">
        <i data-lucide="alert-triangle" size="32" class="text-almond-silk"></i>
      </div>
      <h2 class="text-2xl font-serif text-tea-dark">Не удалось загрузить данные</h2>
      <p class="text-tea-dark/60 max-w-sm leading-relaxed">${escapeHtml(message)}</p>
      <button class="btn-primary mt-4" data-action="reload">Попробовать снова</button>
    </div>
  `;
  main.querySelector('[data-action="reload"]')?.addEventListener('click', () => window.location.reload());
  window.lucide?.createIcons();
}

function syncStepUI(step) {
  stepSections.forEach((section, i) => section?.classList.toggle('hidden', i !== step));

  const max = maxAllowedStep(getState());
  stepperItems.forEach((li) => {
    const liStep = parseInt(li.dataset.step, 10);
    const isActive = liStep === step;
    const isAllowed = liStep <= max;
    li.classList.toggle('step-active', isActive);
    li.classList.toggle('step-disabled', !isAllowed);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', isAllowed ? '0' : '-1');
    li.setAttribute('aria-disabled', String(!isAllowed));
    li.style.cursor = isAllowed && !isActive ? 'pointer' : 'default';
  });
  window.lucide?.createIcons();
}

function pushStepToUrl(step, replace) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('step') === String(step)) return;
  url.searchParams.set('step', String(step));
  window.history[replace ? 'replaceState' : 'pushState']({ step }, '', url.toString());
}

// грузит рецепт по ?edit=<id> в state поверх черновика (mode=recipe перезаписывает рецепт, иначе клон)
async function loadRecipeForEdit(recipeId, { cartItemId, mode }) {
  try {
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, name, description, genre, blend_format, total_grams, recipe_teas(tea_id, grams), recipe_ingredients(ingredient_id, grams)')
      .eq('id', recipeId)
      .maybeSingle();
    if (error) throw error;
    if (!recipe) return;
    reset();
    loadFromRecipe(recipe); // выставляет шаг 2, основы и ингредиенты
    update({ cartItemId: cartItemId || null, editRecipeId: mode === 'recipe' ? recipe.id : null });
  } catch (err) {
    console.error('loadRecipeForEdit:', err);
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const editRecipeId = params.get('edit');

  if (!editRecipeId) loadFromSession();

  // ?step=N применяем до подписки, чтобы первый рендер сразу знал нужный шаг
  const startStep = parseStep(params.get('step'));
  if (startStep !== null) update({ step: startStep });

  let data;
  try {
    data = await initData();
  } catch (err) {
    showDataError(err.message || 'Произошла ошибка при загрузке каталога.');
    return;
  }

  if (editRecipeId) {
    await loadRecipeForEdit(editRecipeId, { cartItemId: params.get('cartItem'), mode: params.get('mode') });
  }

  // шаг меняется только через update({ step }), а подписчик монтирует и показывает нужную секцию
  let lastStep = null;
  subscribe((state) => {
    const step = state.step ?? 0;
    mountStep(step, data);
    syncStepUI(step);
    pushStepToUrl(step, lastStep === null);
    lastStep = step;
  });

  bindStepper();
  bindBackButton(() => { lastStep = getState().step; });

  update({}); // первый рендер: подписчик смонтирует и покажет шаг 0

  // вернулись с auth-страницы по ?autoCheckout=1 — дожимаем «Сохранить + в корзину»
  if (params.get('autoCheckout') === '1') {
    queueMicrotask(() => document.querySelector('#step-3 [data-action="save-cart"]')?.click());
  }

  window.lucide?.createIcons();
}

function goToStep(target) {
  if (target == null || target > maxAllowedStep(getState())) return;
  update({ step: target });
}

function bindStepper() {
  const stepper = document.getElementById('stepper');
  if (!stepper) return;
  const stepFromEvent = (e) => parseStep(e.target.closest('li[data-step]')?.dataset.step);
  stepper.addEventListener('click', (e) => goToStep(stepFromEvent(e)));
  stepper.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    goToStep(stepFromEvent(e));
  });
}

// кнопка «Назад» браузера: берём шаг из URL, но не выше разблокированного
function bindBackButton(onApply) {
  window.addEventListener('popstate', () => {
    const fromUrl = parseStep(new URLSearchParams(window.location.search).get('step')) ?? 0;
    const target = Math.min(fromUrl, maxAllowedStep(getState()));
    if (target === getState().step) return;
    onApply();
    update({ step: target });
  });
}

init();
