// Sticky-превью смеси (правая колонка Шага 2): чашка, свободный бюджет, список основ и
// ингредиентов с кнопками плюс-минус, шкалы совместимости, кольца вкуса, формат, переход к шагу 3.

import { getState, subscribe, update } from './state.js';
import { compatScore } from './compatibility.js';
import { renderScale } from '../shared/scale-component.js';
import { ingredientsBudget, canIncreaseIngredient } from './proportions.js';
import { escapeHtml, formatPrice } from '../shared/utils.js';
import { cupSlug, cupIconHtml, ingredientIcon, blendPrice } from './blend.js';

// ниже этого compatScore ингредиент в смеси подсвечивается красной рамкой
const LOW_COMPAT_THRESHOLD = 1.4;

function cupImgHtml(slug) {
  return cupIconHtml(slug, 72);
}

// доля уникальных характеристик нужного типа среди всех компонентов, max при 4 и больше
function tasteRings(state, data) {
  const byType = { taste: new Set(), aroma: new Set(), effect: new Set() };
  const collect = (charMap, id) => {
    for (const charId of charMap?.get(id) ?? []) {
      const ch = data.characteristics.get(charId);
      if (ch && byType[ch.type]) byType[ch.type].add(ch.name);
    }
  };
  for (const b of state.bases) collect(data.teaChars, b.teaId);
  for (const i of state.ingredients) collect(data.ingChars, i.ingredientId);
  return {
    taste: Math.min(1, byType.taste.size / 4),
    aroma: Math.min(1, byType.aroma.size / 4),
    effect: Math.min(1, byType.effect.size / 4),
  };
}

// SVG-кольцо с прогрессом: радиус 22, толщина 5
function ringHtml(pct, color, label) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const percent = Math.round(pct * 100);
  return `
    <div class="taste-ring-item" title="${escapeHtml(label)}: ${percent}%">
      <svg width="54" height="54" viewBox="0 0 54 54" aria-label="${escapeHtml(label)}">
        <circle cx="27" cy="27" r="${r}" fill="none" stroke="#e7e5e4" stroke-width="5"/>
        <circle cx="27" cy="27" r="${r}" fill="none" stroke="${escapeHtml(color)}" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" transform="rotate(-90 27 27)"/>
        <text x="27" y="31" text-anchor="middle" font-size="10" fill="#4a3f35" font-weight="600">${percent}%</text>
      </svg>
      <span class="taste-ring-label">${escapeHtml(label)}</span>
    </div>
  `;
}

// compatScore ингредиента относительно смеси БЕЗ него самого — для шкалы в превью
function ingScoreInBlend(ingredientId, state, compatData) {
  const blendWithout = {
    bases: state.bases,
    ingredients: state.ingredients.filter((i) => i.ingredientId !== ingredientId),
  };
  return compatScore({ type: 'ingredient', id: ingredientId }, blendWithout, compatData).score;
}

function canIncrease(ing, state, ingredientId) {
  return canIncreaseIngredient({
    ingredient: ing,
    currentIngredients: state.ingredients,
    totalBaseGrams: state.totalBaseGrams,
    ingredientId,
  });
}

export function mountPreview({ container, data }) {
  const compatData = {
    teaCompat: data.teaCompat ?? new Map(),
    teaIngCompat: data.teaIngCompat ?? new Map(),
    ingCompat: data.ingCompat ?? new Map(),
  };

  function basesSectionHtml(state) {
    if (state.bases.length === 0) return '';
    const rows = state.bases.map((b) => {
      const tea = data.teasById.get(b.teaId);
      const name = tea ? escapeHtml(tea.name) : `#${b.teaId}`;
      return `<div class="preview-base-row"><span class="preview-component-name">${name}</span><span class="preview-grams">${b.grams} г</span></div>`;
    }).join('');
    return `<div class="preview-section"><div class="preview-section-label">Основа</div>${rows}</div>`;
  }

  function ingRowHtml(item, state) {
    const ing = data.ingredientsById.get(item.ingredientId);
    if (!ing) return '';
    const lowCompat = ingScoreInBlend(item.ingredientId, state, compatData) <= LOW_COMPAT_THRESHOLD;
    const canDec = item.grams > 1;
    const canInc = canIncrease(ing, state, item.ingredientId);
    const lowTitle = lowCompat ? 'Плохо сочетается с текущей основой — возможно стоит убрать' : '';
    return `
      <div class="preview-ing-row${lowCompat ? ' preview-ing-low' : ''}" data-ing-row="${item.ingredientId}" title="${lowTitle}">
        <span class="preview-ing-icon"><i data-lucide="${escapeHtml(ingredientIcon(ing.category))}" width="14" height="14"></i></span>
        <span class="preview-component-name">${escapeHtml(ing.name)}</span>
        <div class="preview-ing-controls">
          <button type="button" class="preview-grams-btn" data-ing-dec="${item.ingredientId}" ${canDec ? '' : 'disabled'}
                  aria-label="Уменьшить граммовку ${escapeHtml(ing.name)}">−</button>
          <span class="preview-grams" data-grams-val="${item.ingredientId}">${item.grams} г</span>
          <button type="button" class="preview-grams-btn" data-ing-inc="${item.ingredientId}" ${canInc ? '' : 'disabled'}
                  aria-label="Увеличить граммовку ${escapeHtml(ing.name)}">+</button>
        </div>
        <div class="preview-ing-scale" data-scale="${item.ingredientId}"></div>
      </div>
    `;
  }

  function ingsSectionHtml(state) {
    if (state.ingredients.length === 0) {
      return `<div class="preview-empty-ings"><i data-lucide="plus-circle" width="20" height="20"></i><span>Добавьте ингредиенты слева</span></div>`;
    }
    const rows = state.ingredients.map((item) => ingRowHtml(item, state)).join('');
    return `<div class="preview-section" id="preview-ings-list"><div class="preview-section-label">Ингредиенты</div>${rows}</div>`;
  }

  function ringsSectionHtml(state) {
    const rings = tasteRings(state, data);
    return `
      <div class="preview-section">
        <div class="preview-section-label">Профиль смеси</div>
        <div class="taste-rings">
          ${ringHtml(rings.taste, '#8aa27c', 'Вкус')}
          ${ringHtml(rings.aroma, '#b89060', 'Аромат')}
          ${ringHtml(rings.effect, '#c4885f', 'Эффект')}
        </div>
      </div>
    `;
  }

  function canFinish(state) {
    return state.ingredients.length > 0 || state.bases.length >= 2;
  }

  function renderPreview() {
    const state = getState();
    const budget = ingredientsBudget(state.totalBaseGrams);
    const usedGrams = state.ingredients.reduce((sum, i) => sum + i.grams, 0);
    const fillPct = budget > 0 ? Math.min(100, Math.round((usedGrams / budget) * 100)) : 0;
    const isBlend = state.blendFormat !== 'separate';
    const finishDisabled = !canFinish(state);

    container.innerHTML = `
      <div class="preview-inner">
        <div class="preview-cup-row">
          <div class="preview-cup">${cupImgHtml(cupSlug(state.bases, data.teasById))}</div>
          <div class="preview-budget">
            <div class="preview-budget-text">Свободно: <strong>${budget - usedGrams} г</strong> / ${budget} г</div>
            <div class="preview-budget-bar"><div class="preview-budget-fill" style="width: ${fillPct}%"></div></div>
          </div>
        </div>

        ${basesSectionHtml(state)}
        ${ingsSectionHtml(state)}

        <div class="line-sep my-3"></div>
        ${ringsSectionHtml(state)}
        <div class="line-sep my-3"></div>

        <div class="preview-format-toggle">
          <button type="button" class="preview-format-btn${isBlend ? ' active' : ''}" data-format="blend">Готовый купаж</button>
          <button type="button" class="preview-format-btn${isBlend ? '' : ' active'}" data-format="separate">Раздельный набор</button>
        </div>

        <button type="button" class="preview-finish-btn btn-primary w-full mt-4${finishDisabled ? ' opacity-50 cursor-not-allowed' : ''}"
                data-action="finish" ${finishDisabled ? 'disabled' : ''} aria-disabled="${finishDisabled}">
          К завершению → <span class="preview-price">${formatPrice(blendPrice(state, data))}</span>
        </button>
        <button type="button" class="preview-back-btn btn-ghost w-full mt-2" data-action="back-to-step1">← Назад к основе</button>
      </div>
    `;

    window.lucide?.createIcons();
    mountScales(state);
    bindControls();
  }

  // шкалы совместимости рисуем через renderScale, а не innerHTML
  function mountScales(state) {
    for (const item of state.ingredients) {
      const slot = container.querySelector(`[data-scale="${item.ingredientId}"]`);
      if (!slot) continue;
      slot.appendChild(renderScale({ score: ingScoreInBlend(item.ingredientId, state, compatData), size: 'sm' }));
    }
  }

  function bindControls() {
    container.querySelectorAll('[data-ing-dec]').forEach((btn) => {
      btn.addEventListener('click', () => changeIngGrams(parseInt(btn.dataset.ingDec, 10), -1));
    });
    container.querySelectorAll('[data-ing-inc]').forEach((btn) => {
      btn.addEventListener('click', () => changeIngGrams(parseInt(btn.dataset.ingInc, 10), +1));
    });
    container.querySelectorAll('[data-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.format === 'blend' || btn.dataset.format === 'separate') update({ blendFormat: btn.dataset.format });
      });
    });
    container.querySelector('[data-action="finish"]')?.addEventListener('click', () => {
      if (canFinish(getState())) update({ step: 3 });
    });
    container.querySelector('[data-action="back-to-step1"]')?.addEventListener('click', () => update({ step: 1 }));
  }

  // меняет граммовку ингредиента на 1, в пределах бюджета и личного max_grams, но не ниже 1 г
  function changeIngGrams(ingredientId, delta) {
    if (!Number.isInteger(ingredientId)) return;
    const state = getState();
    const ing = data.ingredientsById.get(ingredientId);
    const item = state.ingredients.find((i) => i.ingredientId === ingredientId);
    if (!ing || !item) return;
    if (delta > 0 && !canIncrease(ing, state, ingredientId)) return;
    if (delta < 0 && item.grams <= 1) return;

    const ingredients = state.ingredients.map((i) =>
      i.ingredientId === ingredientId ? { ...i, grams: i.grams + delta } : i
    );
    update({ ingredients });
  }

  renderPreview();
  subscribe(() => {
    if (container.isConnected) renderPreview();
  });
}
