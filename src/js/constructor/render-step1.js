// Шаг 1 конструктора: выбор чайной основы (1–3 чая) и массы основы.

import { getState, subscribe, update } from './state.js';
import { distributeBases, BASE_PRESETS, clampIngredientsToBudget } from './proportions.js';
import { compatScore, suitabilityScore } from './compatibility.js';
import { genreFit } from './recommend.js';
import { renderScale, updateScale } from '../shared/scale-component.js';
import { escapeHtml } from '../shared/utils.js';
import { showToast } from '../shared/toast.js';
import { GENRE_TAGS } from './genres.js';

const GENRE_BADGE_MIN = 0.35; // порог genreFit для бейджа жанра на карточке
const MAX_BASES = 3;
const LOW_SUITABILITY = 2; // blend_suitability не выше этого — спрашиваем подтверждение перед выбором
const DESCRIPTION_LIMIT = 100;

// модалка-предупреждение для чая, который обычно пьют в чистом виде
function openLowSuitabilityModal(tea, onConfirm) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="low-suit-title">
      <h3 id="low-suit-title">«${escapeHtml(tea.name ?? 'Этот чай')}» ценится за чистоту вкуса</h3>
      <p>Этот чай обычно пьют в чистом виде — смешивание может исказить его тонкий аромат. Всё равно хотите добавить его в основу?</p>
      <div class="modal-actions">
        <button type="button" class="btn-ghost" data-action="cancel">Передумать</button>
        <button type="button" class="btn-primary" data-action="confirm">Всё равно выбрать</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKeydown);
  };
  const onKeydown = (e) => { if (e.key === 'Escape') close(); };

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => { close(); onConfirm(); });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKeydown);
  backdrop.querySelector('[data-action="cancel"]').focus();
}

const SKELETON_HTML = `
  <h2 class="text-4xl md:text-5xl font-serif text-tea-dark mb-3 leading-tight">Выберите чайную основу</h2>
  <p class="text-tea-dark/60 mb-8 text-sm leading-relaxed">
    Добавьте от 1 до 3 чаёв — они составят основу вашей смеси. Система покажет, насколько хорошо они сочетаются.
  </p>
  <div class="relative mb-4">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-tea-dark/40 pointer-events-none"><i data-lucide="search" width="16" height="16"></i></span>
    <input type="search" id="tea-search" placeholder="Поиск по названию…" class="input-field w-full pr-4 py-2.5 text-sm" style="padding-left: 2.75rem;" aria-label="Поиск чаёв">
  </div>
  <div class="flex flex-wrap gap-2 mb-6" id="tea-category-chips" role="group" aria-label="Фильтр по категориям"></div>
  <div class="flex flex-wrap gap-2 mb-8" id="tea-mass-chips" role="radiogroup" aria-label="Масса основы"></div>
  <div class="tea-card-grid" id="tea-pick-grid"></div>
  <div class="sticky-bar">
    <div class="summary" id="tea-summary"></div>
    <div class="actions">
      <button type="button" class="btn-ghost" data-action="back">← Назад</button>
      <button type="button" class="btn-primary" data-action="next">Далее →</button>
    </div>
  </div>
`;

export function mountStep1({ container, data }) {
  const teas = data?.teas ?? [];
  const teasById = data?.teasById ?? new Map();
  const compatData = {
    teaCompat: data?.teaCompat ?? new Map(),
    teaIngCompat: data?.teaIngCompat ?? new Map(),
    ingCompat: data?.ingCompat ?? new Map(),
  };

  // [[id, name], ...] уникальных категорий из массива чаёв
  const categories = [...new Map(teas
    .filter((t) => t.categories && t.category_id)
    .map((t) => [t.category_id, t.categories.name ?? `Категория ${t.category_id}`]))];

  let activeCategory = null; // null = «Все»
  let searchQuery = '';

  container.innerHTML = SKELETON_HTML;
  const searchInput = container.querySelector('#tea-search');
  const categoryRow = container.querySelector('#tea-category-chips');
  const massRow = container.querySelector('#tea-mass-chips');
  const grid = container.querySelector('#tea-pick-grid');
  const summaryEl = container.querySelector('#tea-summary');
  const nextBtn = container.querySelector('[data-action="next"]');

  // teaId: { cardEl, scaleEl }
  const cardRefs = new Map();

  // оценка для шкалы: при пустой основе берём blend_suitability чая, для выбранного чая —
  // совместимость с остальными выбранными (или его suitability, если он один), иначе compatScore против смеси
  function teaScore(tea, state) {
    if (state.bases.length === 0) return suitabilityScore(tea);
    const isSelected = state.bases.some((b) => b.teaId === tea.id);
    if (isSelected) {
      const otherBases = state.bases.filter((b) => b.teaId !== tea.id);
      if (otherBases.length === 0) return suitabilityScore(tea);
      return compatScore({ type: 'tea', id: tea.id }, { bases: otherBases, ingredients: state.ingredients }, compatData).score;
    }
    return compatScore({ type: 'tea', id: tea.id }, { bases: state.bases, ingredients: state.ingredients }, compatData).score;
  }

  function genreBadgeTag(teaId) {
    const state = getState();
    if (!state.genre) return null;
    const fit = genreFit({ type: 'tea', id: teaId }, state.genre, { tea: data.teaChars, ing: data.ingChars }, data.characteristics);
    return fit >= GENRE_BADGE_MIN ? GENRE_TAGS[state.genre] : null;
  }

  // бейдж жанра кладём первым ребёнком карточки, создаём или убираем по genreFit
  function applyGenreBadge(cardEl, teaId) {
    const tag = genreBadgeTag(teaId);
    let badge = cardEl.querySelector('[data-genre-badge]');
    if (!tag) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'genre-tag genre-tag-card';
      badge.dataset.genreBadge = '1';
      cardEl.insertBefore(badge, cardEl.firstChild);
    }
    badge.textContent = tag;
  }

  function shortDescription(text) {
    const raw = text ?? '';
    return raw.length > DESCRIPTION_LIMIT ? `${raw.slice(0, DESCRIPTION_LIMIT)}…` : raw;
  }

  function buildTeaCard(tea, state) {
    const isSelected = state.bases.some((b) => b.teaId === tea.id);
    const card = document.createElement('div');
    card.className = `tea-pick-card rounded-sm${isSelected ? ' selected' : ''}`;
    card.dataset.teaId = String(tea.id);
    card.dataset.catId = String(tea.category_id ?? '');
    card.dataset.name = (tea.name ?? '').toLowerCase();

    const priceLine = typeof tea.price_per_gram === 'number' ? `${tea.price_per_gram} ₽/г` : '';
    card.innerHTML = `
      <span class="text-[10px] uppercase tracking-widest font-bold text-almond-silk">${escapeHtml(tea.categories?.name ?? '')}</span>
      <h3>${escapeHtml(tea.name ?? '')}</h3>
      <p>${escapeHtml(shortDescription(tea.description))}</p>
      ${priceLine ? `<p class="text-xs text-tea-dark/60 mt-1 mb-1">${priceLine}</p>` : ''}
    `;

    const scaleEl = renderScale({ score: teaScore(tea, state), size: 'sm' });
    scaleEl.dataset.role = 'suit-scale';
    card.appendChild(scaleEl);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = 'toggle-base';
    btn.className = isSelected ? 'btn-ghost text-xs' : 'btn-primary text-xs';
    btn.textContent = isSelected ? 'Убрать из основы' : 'Выбрать как основу';
    card.appendChild(btn);

    applyGenreBadge(card, tea.id);
    return { cardEl: card, scaleEl };
  }

  function buildTeaCards() {
    const state = getState();
    grid.innerHTML = '';
    cardRefs.clear();
    for (const tea of teas) {
      const ref = buildTeaCard(tea, state);
      grid.appendChild(ref.cardEl);
      cardRefs.set(tea.id, ref);
    }
    applyFilters();
  }

  // прячем/показываем карточки по категории и поиску — без пересоздания DOM
  function applyFilters() {
    for (const tea of teas) {
      const ref = cardRefs.get(tea.id);
      if (!ref) continue;
      const matchCat = activeCategory === null || tea.category_id === activeCategory;
      const matchSearch = searchQuery === '' || (tea.name ?? '').toLowerCase().includes(searchQuery);
      ref.cardEl.style.display = matchCat && matchSearch ? '' : 'none';
    }
  }

  function buildCategoryChips() {
    const chip = (label, value, active) =>
      `<button type="button" class="chip${active ? ' active' : ''}" data-cat-id="${value}">${escapeHtml(label)}</button>`;
    categoryRow.innerHTML =
      chip('Все', '', activeCategory === null) +
      categories.map(([id, name]) => chip(name, String(id), activeCategory === id)).join('');
  }

  function buildMassChips() {
    const total = getState().totalBaseGrams;
    const chips = BASE_PRESETS.map((grams) =>
      `<button type="button" role="radio" aria-checked="${total === grams}" class="chip${total === grams ? ' active' : ''}" data-grams="${grams}">${grams} г</button>`
    ).join('');
    massRow.innerHTML =
      `<span class="text-xs uppercase tracking-widest font-bold text-tea-dark/50 self-center mr-2 whitespace-nowrap">Масса основы:</span>${chips}`;
  }

  function updateStickyBar() {
    const state = getState();
    if (state.bases.length === 0) {
      summaryEl.innerHTML = '<strong>Основа не выбрана</strong> — добавьте 1–3 чая';
    } else {
      const items = state.bases.map((b) => {
        const tea = teasById.get(b.teaId);
        const name = tea ? escapeHtml(tea.name) : `#${b.teaId}`;
        return `${name} · <strong>${b.grams} г</strong>`;
      }).join(', ');
      summaryEl.innerHTML = `<strong>Основа:</strong> ${items} <span class="text-tea-dark/50">(всего ${state.totalBaseGrams} г)</span>`;
    }
    const empty = state.bases.length === 0;
    nextBtn.disabled = empty;
    nextBtn.classList.toggle('opacity-50', empty);
    nextBtn.classList.toggle('cursor-not-allowed', empty);
  }

  function setBaseIds(ids) {
    update({ bases: distributeBases(getState().totalBaseGrams, ids) });
  }

  function addBase(tea) {
    const ids = getState().bases.map((b) => b.teaId);
    if (ids.includes(tea.id)) return;
    setBaseIds([...ids, tea.id]);
  }

  function removeBase(teaId) {
    setBaseIds(getState().bases.map((b) => b.teaId).filter((id) => id !== teaId));
  }

  function pickTea(teaId) {
    const state = getState();
    if (state.bases.some((b) => b.teaId === teaId)) {
      removeBase(teaId);
      return;
    }
    if (state.bases.length >= MAX_BASES) {
      showToast(`Максимум ${MAX_BASES} чая в основе`);
      return;
    }
    const tea = teasById.get(teaId);
    if (!tea) return;
    if (typeof tea.blend_suitability === 'number' && tea.blend_suitability <= LOW_SUITABILITY) {
      openLowSuitabilityModal(tea, () => addBase(tea));
    } else {
      addBase(tea);
    }
  }

  buildCategoryChips();
  buildMassChips();
  buildTeaCards();
  updateStickyBar();

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    applyFilters();
  });
  categoryRow.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat-id]');
    if (!chip) return;
    activeCategory = chip.dataset.catId === '' ? null : parseInt(chip.dataset.catId, 10);
    buildCategoryChips();
    applyFilters();
  });
  massRow.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-grams]');
    if (!chip) return;
    const grams = parseInt(chip.dataset.grams, 10);
    if (Number.isNaN(grams)) return;
    const state = getState();
    update({
      totalBaseGrams: grams,
      bases: distributeBases(grams, state.bases.map((b) => b.teaId)),
      ingredients: clampIngredientsToBudget(state.ingredients, grams),
    });
  });
  grid.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-base"]')) return;
    const card = e.target.closest('[data-tea-id]');
    const teaId = parseInt(card?.dataset.teaId ?? '', 10);
    if (!Number.isNaN(teaId)) pickTea(teaId);
  });
  container.querySelector('[data-action="back"]').addEventListener('click', () => update({ step: 0 }));
  nextBtn.addEventListener('click', () => {
    if (getState().bases.length > 0) update({ step: 2 });
  });

  subscribe((state) => {
    buildMassChips();
    for (const tea of teas) {
      const ref = cardRefs.get(tea.id);
      if (!ref) continue;
      const isSelected = state.bases.some((b) => b.teaId === tea.id);
      ref.cardEl.classList.toggle('selected', isSelected);
      const btn = ref.cardEl.querySelector('[data-action="toggle-base"]');
      if (btn) {
        btn.textContent = isSelected ? 'Убрать из основы' : 'Выбрать как основу';
        btn.className = isSelected ? 'btn-ghost text-xs' : 'btn-primary text-xs';
      }
      updateScale(ref.scaleEl, teaScore(tea, state));
      applyGenreBadge(ref.cardEl, tea.id); // жанр мог измениться при возврате на шаг 0
    }
    updateStickyBar();
  });

  window.lucide?.createIcons();
}
