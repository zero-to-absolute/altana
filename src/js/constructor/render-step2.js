// Шаг 2 конструктора: выбор и настройка ингредиентов.
// Слева 2/3 — каталог ингредиентов, справа 1/3 sticky — превью смеси.
// На < 1024px правая колонка превращается в нижний bottom-sheet с модалкой.

import { getState, subscribe, update } from './state.js';
import { compatScore, bucket } from './compatibility.js';
import { topIngredients, genreFit } from './recommend.js';
import { canAddIngredient, ingredientsBudget } from './proportions.js';
import { mountPreview } from './render-preview.js';
import { mountHints } from './render-hints.js';
import { showToast } from '../shared/toast.js';
import { GENRE_TAGS } from './genres.js';
import { ingredientIcon, blendPrice } from './blend.js';

// порог genreFit, ниже которого бейдж жанра на pill не показываем
const GENRE_BADGE_MIN = 0.35;
const SCORE_TOP = 4; // нижняя граница для фильтра «только лучшее»
const SCORE_WEAK = 2; // верхняя граница для фильтра «скрыть несочетаемые»

const CATEGORY_LABELS = {
  herb: 'Травы',
  flower: 'Цветы',
  spice: 'Специи',
  citrus: 'Цитрусы',
  dried_fruit: 'Сухофрукты',
  sweetener: 'Подсластители',
  other: 'Прочее',
};
const CATEGORY_ORDER = ['herb', 'flower', 'spice', 'citrus', 'dried_fruit', 'sweetener', 'other'];

function blendOf(state) {
  return { bases: state.bases, ingredients: state.ingredients };
}

function compatDataOf(data) {
  return {
    teaCompat: data.teaCompat ?? new Map(),
    teaIngCompat: data.teaIngCompat ?? new Map(),
    ingCompat: data.ingCompat ?? new Map(),
  };
}

// короткое слово-метка жанра для ингредиента, либо null
function genreTagFor(ing, state, data) {
  if (!state.genre) return null;
  const fit = genreFit(
    { type: 'ingredient', id: ing.id },
    state.genre,
    { tea: data.teaChars, ing: data.ingChars },
    data.characteristics,
  );
  return fit >= GENRE_BADGE_MIN ? (GENRE_TAGS[state.genre] || null) : null;
}

function addChild(parent, tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  parent.appendChild(el);
  return el;
}

// button-pill ингредиента: оценка совместимости, бейдж жанра, иконка, название, цена
function ingredientPill(ing, { isSelected, isRecommended, score, genreTag }) {
  const b = bucket(score);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = ['ing-pill', isRecommended ? 'recommended' : '', isSelected ? 'selected' : '', `compat-${b.level}`]
    .filter(Boolean).join(' ');
  btn.dataset.ingredientId = String(ing.id);
  btn.dataset.ingredientSlug = ing.slug;
  btn.setAttribute('aria-pressed', String(isSelected));
  btn.setAttribute('aria-label', `${ing.name} — ${b.label}${isSelected ? ', выбран' : ''}`);
  btn.title = `${ing.name} · ${b.label}`;

  addChild(btn, 'span', 'ing-pill-rating', `★ ${score.toFixed(1)}`);
  if (genreTag) addChild(btn, 'span', 'ing-pill-genre', genreTag);

  const icon = addChild(btn, 'i');
  icon.setAttribute('data-lucide', ingredientIcon(ing.category));
  icon.setAttribute('width', '14');
  icon.setAttribute('height', '14');

  addChild(btn, 'span', null, ing.name);
  if (typeof ing.price_per_gram === 'number') addChild(btn, 'small', 'ing-pill-price', `${ing.price_per_gram} ₽/г`);
  return btn;
}

const LAYOUT_HTML = `
  <div class="step2-layout" id="step2-inner">
    <div class="step2-left" id="step2-left">
      <h2 class="text-3xl md:text-4xl font-serif text-tea-dark mb-2 leading-tight">Подбираем ингредиенты</h2>
      <p class="text-tea-dark/60 mb-6 text-sm leading-relaxed">
        Добавьте специи, травы, цветы и сухофрукты — они дополнят вашу основу.
        Система подсветит, насколько каждый ингредиент подходит к вашей смеси.
      </p>

      <div class="step2-section">
        <div class="step2-section-title">Топ-5 для вашей смеси</div>
        <div class="step2-pills-row" id="top5-pills" role="group" aria-label="Рекомендованные ингредиенты"></div>
      </div>

      <div class="step2-section mt-4">
        <button type="button" id="toggle-full-list" class="step2-accordion-btn" aria-expanded="false" aria-controls="full-list-panel">
          <i data-lucide="list" width="16" height="16"></i>
          <span id="toggle-full-list-label">Показать все ингредиенты</span>
          <i data-lucide="chevron-down" width="16" height="16" class="step2-acc-chevron"></i>
        </button>

        <div id="full-list-panel" class="step2-full-panel" hidden>
          <div class="relative mb-3 mt-3">
            <input type="search" id="ing-search" placeholder="Поиск по названию…" class="input-field w-full pr-4 py-2 text-sm"
                   style="padding-left: 2.75rem;" aria-label="Поиск ингредиентов">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-tea-dark/40 pointer-events-none">
              <i data-lucide="search" width="15" height="15"></i>
            </span>
          </div>

          <div class="step2-filters" role="group" aria-label="Фильтры">
            <label class="step2-filter-label"><input type="checkbox" id="filter-top" class="custom-checkbox"> Только лучшее ≥ 4</label>
            <label class="step2-filter-label"><input type="checkbox" id="filter-hide-weak" class="custom-checkbox"> Скрыть несочетаемые ≤ 2</label>
          </div>

          <div id="full-ing-list" role="list" aria-label="Все ингредиенты"></div>
        </div>
      </div>

      <div class="step2-hints-block" id="hints-block" aria-live="polite" aria-label="Памятка об ингредиенте"></div>
    </div>

    <aside class="preview-panel" id="preview-panel" aria-label="Превью смеси">
      <div id="preview-container"></div>
    </aside>
  </div>

  <div class="step2-bottom-sheet" id="step2-bottom-sheet" aria-label="Сводка смеси">
    <div class="step2-bottom-summary" id="bottom-summary"></div>
    <button type="button" class="btn-primary step2-bottom-open-btn" id="open-preview-btn">Открыть смесь</button>
  </div>

  <div class="modal-backdrop step2-preview-modal" id="preview-modal" hidden role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
    <div class="step2-preview-modal-inner">
      <div class="step2-preview-modal-header">
        <span id="preview-modal-title" class="font-serif text-lg text-tea-dark">Ваша смесь</span>
        <button type="button" id="close-preview-btn" class="btn-ghost" aria-label="Закрыть превью"><i data-lucide="x" width="18" height="18"></i></button>
      </div>
      <div id="preview-modal-container" class="step2-preview-modal-body"></div>
    </div>
  </div>
`;

export function mountStep2({ container, data }) {
  const ingredients = data?.ingredients ?? [];
  const compatData = compatDataOf(data);

  let searchQuery = '';
  let onlyTop = false; // фильтр «только лучшее»
  let hideWeak = false; // фильтр «скрыть несочетаемые»
  let fullListOpen = false;
  let fullListRendered = false;

  container.innerHTML = LAYOUT_HTML;

  const top5Row = container.querySelector('#top5-pills');
  const toggleFullBtn = container.querySelector('#toggle-full-list');
  const fullPanel = container.querySelector('#full-list-panel');
  const fullLabel = container.querySelector('#toggle-full-list-label');
  const fullList = container.querySelector('#full-ing-list');
  const searchInput = container.querySelector('#ing-search');
  const onlyTopCheck = container.querySelector('#filter-top');
  const hideWeakCheck = container.querySelector('#filter-hide-weak');
  const bottomSummary = container.querySelector('#bottom-summary');
  const openPreviewBtn = container.querySelector('#open-preview-btn');
  const previewModal = container.querySelector('#preview-modal');
  const closePreviewBtn = container.querySelector('#close-preview-btn');
  const step2Left = container.querySelector('#step2-left');

  mountPreview({ container: container.querySelector('#preview-container'), data });
  mountPreview({ container: container.querySelector('#preview-modal-container'), data }); // отдельный экземпляр для мобильной модалки
  mountHints({
    container: container.querySelector('#hints-block'),
    pillsParent: step2Left,
    data,
    getBlend: () => blendOf(getState()),
  });

  // совместимость ингредиента со смесью, для уже выбранного — без него самого,
  // иначе пара одного и того же ингредиента даёт нейтральную тройку и проседает средняя оценка
  function ingredientScore(ing, state, blend) {
    const effBlend = state.ingredients.some((i) => i.ingredientId === ing.id)
      ? { bases: blend.bases, ingredients: blend.ingredients.filter((i) => i.ingredientId !== ing.id) }
      : blend;
    return compatScore({ type: 'ingredient', id: ing.id }, effBlend, compatData).score;
  }

  function appendPill(row, ing, state, { isRecommended, score }) {
    row.appendChild(ingredientPill(ing, {
      isSelected: state.ingredients.some((i) => i.ingredientId === ing.id),
      isRecommended,
      score,
      genreTag: genreTagFor(ing, state, data),
    }));
  }

  function renderTop5() {
    const state = getState();
    const top5 = topIngredients({
      candidates: ingredients,
      blend: blendOf(state),
      genre: state.genre,
      compatData,
      charData: { tea: data.teaChars, ing: data.ingChars },
      characteristics: data.characteristics,
      count: 5,
      excludeIds: state.ingredients.map((i) => i.ingredientId),
    });

    top5Row.innerHTML = '';
    if (top5.length === 0) {
      addChild(top5Row, 'p', 'text-sm text-tea-dark/50 italic', 'Нет рекомендаций для текущей основы');
      return;
    }
    for (const { ingredient, compat } of top5) appendPill(top5Row, ingredient, state, { isRecommended: true, score: compat.score });
    window.lucide?.createIcons();
  }

  function passesFilters(ing, score) {
    if (onlyTop && score < SCORE_TOP) return false;
    if (hideWeak && score <= SCORE_WEAK) return false;
    if (searchQuery && !(ing.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }

  function renderFullList() {
    const state = getState();
    const blend = blendOf(state);

    const visible = ingredients
      .map((ing) => ({ ing, score: ingredientScore(ing, state, blend) }))
      .filter(({ ing, score }) => passesFilters(ing, score))
      .sort((a, b) => b.score - a.score);

    const byCategory = new Map(CATEGORY_ORDER.map((cat) => [cat, []]));
    for (const item of visible) {
      const cat = byCategory.has(item.ing.category) ? item.ing.category : 'other';
      byCategory.get(cat).push(item);
    }

    fullList.innerHTML = '';
    let rendered = false;
    for (const cat of CATEGORY_ORDER) {
      const items = byCategory.get(cat);
      if (items.length === 0) continue;
      rendered = true;

      const group = addChild(fullList, 'div', 'ing-group');
      addChild(group, 'div', 'ing-group-title', CATEGORY_LABELS[cat] || cat);
      const row = addChild(group, 'div', 'step2-pills-row');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', CATEGORY_LABELS[cat] || cat);
      for (const { ing, score } of items) appendPill(row, ing, state, { isRecommended: false, score });
    }
    if (!rendered) addChild(fullList, 'p', 'text-sm text-tea-dark/50 italic py-4 text-center', 'Ничего не найдено');
    window.lucide?.createIcons();
  }

  function renderBottomSummary() {
    const state = getState();
    const budget = ingredientsBudget(state.totalBaseGrams);
    const used = state.ingredients.reduce((sum, i) => sum + i.grams, 0);
    bottomSummary.textContent =
      `${state.ingredients.length} ингр. · ${budget - used} г / ${budget} г · ${Math.round(blendPrice(state, data))} ₽`;
  }

  // обновляет все списки и сводку — оценки соседних ингредиентов меняются при любом изменении состава
  function refresh() {
    renderTop5();
    if (fullListOpen) renderFullList();
    renderBottomSummary();
  }

  // добавляет/убирает ингредиент по клику на pill
  function togglePill(pillEl) {
    const ingId = parseInt(pillEl.dataset.ingredientId, 10);
    if (Number.isNaN(ingId)) return;
    const state = getState();

    if (state.ingredients.some((i) => i.ingredientId === ingId)) {
      update({ ingredients: state.ingredients.filter((i) => i.ingredientId !== ingId) });
      return;
    }

    const ing = data.ingredientsById.get(ingId);
    if (!ing) return;
    const result = canAddIngredient({
      newIngredient: ing,
      currentIngredients: state.ingredients,
      totalBaseGrams: state.totalBaseGrams,
    });
    if (!result.ok) {
      if (result.reason === 'limit_count') showToast('Максимум 8 компонентов');
      else if (result.reason === 'no_space') showToast('Нет места — увеличьте основу или удалите компонент');
      return;
    }

    // применяем перераспределение граммов и добавляем новый ингредиент
    const redistribution = result.proposedRedistribution || [];
    const ingredients = state.ingredients.map((i) => {
      const change = redistribution.find((r) => r.ingredientId === i.ingredientId);
      return change ? { ...i, grams: change.newGrams } : i;
    });
    ingredients.push({ ingredientId: ingId, grams: result.proposedGrams });
    update({ ingredients });
  }

  function toggleFullList() {
    if (!fullListRendered) {
      renderFullList();
      fullListRendered = true;
    }
    fullListOpen = !fullListOpen;
    fullPanel.hidden = !fullListOpen;
    toggleFullBtn.setAttribute('aria-expanded', String(fullListOpen));
    toggleFullBtn.classList.toggle('open', fullListOpen);
    fullLabel.textContent = fullListOpen ? 'Скрыть полный список' : 'Показать все ингредиенты';
    if (fullListOpen) window.lucide?.createIcons();
  }

  function openPreviewModal() {
    previewModal.hidden = false;
    document.body.classList.add('preview-modal-open');
    closePreviewBtn.focus();
    window.lucide?.createIcons();
  }

  function closePreviewModal() {
    previewModal.hidden = true;
    document.body.classList.remove('preview-modal-open');
    openPreviewBtn.focus();
  }

  step2Left.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-ingredient-id]');
    if (pill) togglePill(pill);
  });
  toggleFullBtn.addEventListener('click', toggleFullList);
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim(); renderFullList(); });
  onlyTopCheck.addEventListener('change', () => { onlyTop = onlyTopCheck.checked; renderFullList(); });
  hideWeakCheck.addEventListener('change', () => { hideWeak = hideWeakCheck.checked; renderFullList(); });
  openPreviewBtn.addEventListener('click', openPreviewModal);
  closePreviewBtn.addEventListener('click', closePreviewModal);
  previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closePreviewModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !previewModal.hidden) closePreviewModal(); });

  subscribe(refresh);
  refresh();
  window.lucide?.createIcons();
}
