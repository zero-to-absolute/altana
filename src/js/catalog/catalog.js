// Каталог чаёв: загрузка из Supabase, рендер карточек, фильтры по категориям и характеристикам,
// пагинация, избранное и быстрое добавление в корзину.

import { supabase } from '../shared/supabase.js';
import { getCurrentUser } from '../auth/auth-state.js';
import { formatPrice, calculatePrice, getErrorMessage, escapeHtml } from '../shared/utils.js';
import { addToCart } from '../cart/cart.js';

const PAGE_SIZE = 9;
const ADDED_FEEDBACK_MS = 1500;
const CHAR_TYPE_LABELS = { taste: 'Вкус', aroma: 'Аромат', effect: 'Эффект' };
const CHAR_TYPE_ORDER = ['taste', 'aroma', 'effect'];

let currentPage = 1;
let totalCount = 0;
const activeCats = new Set();
const activeChars = new Set();

let currentUser = null;
const favIds = new Set();

async function loadCategories() {
  try {
    const { data, error } = await supabase.from('categories').select('id, name, slug').order('id');
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('loadCategories:', err);
    return [];
  }
}

async function loadCharacteristics() {
  try {
    const { data, error } = await supabase.from('characteristics').select('id, name, type').order('type').order('name');
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('loadCharacteristics:', err);
    return [];
  }
}

// id чаёв, у которых есть все выбранные характеристики (или null, если фильтр не задан)
async function teaIdsWithAllChars(charIds) {
  if (!charIds || charIds.size === 0) return null;
  const { data, error } = await supabase.from('tea_characteristics').select('tea_id').in('characteristic_id', [...charIds]);
  if (error) throw error;

  const hitsByTea = new Map();
  for (const { tea_id } of data ?? []) hitsByTea.set(tea_id, (hitsByTea.get(tea_id) ?? 0) + 1);
  return [...hitsByTea.entries()].filter(([, hits]) => hits === charIds.size).map(([id]) => id);
}

async function loadTeas(page, categoryIds, charIds) {
  try {
    const teaIdFilter = await teaIdsWithAllChars(charIds);
    if (teaIdFilter && teaIdFilter.length === 0) return { data: [], count: 0 };

    let query = supabase
      .from('teas')
      .select('*, categories(name, slug)', { count: 'exact' })
      .eq('in_stock', true)
      .order('name', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (categoryIds && categoryIds.size > 0) query = query.in('category_id', [...categoryIds]);
    if (teaIdFilter) query = query.in('id', teaIdFilter);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data ?? [], count: count ?? 0 };
  } catch (err) {
    console.error('loadTeas:', err);
    return { data: [], count: 0 };
  }
}

async function loadFavIds(userId) {
  try {
    const { data, error } = await supabase.from('favorites').select('tea_id').eq('user_id', userId);
    if (error) throw error;
    favIds.clear();
    for (const { tea_id } of data ?? []) favIds.add(tea_id);
  } catch (err) {
    console.error('loadFavIds:', err);
  }
}

function updateHeart(btn, active) {
  const svg = btn?.querySelector('svg');
  if (!svg) return;
  svg.classList.toggle('fill-rose-400', active);
  svg.classList.toggle('stroke-rose-400', active);
  svg.classList.toggle('fill-none', !active);
  svg.classList.toggle('stroke-current', !active);
}

async function toggleFavorite(teaId, btn) {
  if (!currentUser) {
    window.location.href = `${import.meta.env.BASE_URL}src/pages/login.html`;
    return;
  }

  const adding = !favIds.has(teaId);
  if (btn) btn.disabled = true;
  // оптимистично переключаем UI, откатываем при ошибке
  if (adding) favIds.add(teaId); else favIds.delete(teaId);
  updateHeart(btn, adding);

  try {
    const { error } = adding
      ? await supabase.from('favorites').insert({ user_id: currentUser.id, tea_id: teaId })
      : await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('tea_id', teaId);
    if (error) throw error;
  } catch (err) {
    if (adding) favIds.delete(teaId); else favIds.add(teaId);
    updateHeart(btn, !adding);
    alert(getErrorMessage(err, 'toggleFavorite'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderFilters(categories, characteristics) {
  const categoryBox = document.getElementById('category-filter');
  if (categoryBox && categories.length > 0) {
    categoryBox.innerHTML = '';
    renderFilterSection(categoryBox, 'Категория', categories, 'category', activeCats);
  }

  const charBox = document.getElementById('characteristic-filter');
  if (!charBox) return;
  charBox.innerHTML = '';

  const byType = {};
  for (const char of characteristics ?? []) (byType[char.type] ??= []).push(char);
  for (const type of CHAR_TYPE_ORDER) {
    const items = byType[type];
    if (items?.length) renderFilterSection(charBox, CHAR_TYPE_LABELS[type] ?? type, items, 'characteristic', activeChars);
  }

  const resetBtn = document.createElement('button');
  resetBtn.id = 'char-reset-btn';
  resetBtn.className = 'text-[10px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600 transition-colors mt-8 w-full text-left';
  resetBtn.hidden = true;
  resetBtn.textContent = 'Сбросить фильтры';
  charBox.appendChild(resetBtn);
}

// одна секция фильтра — аккордеон с чекбоксами, изначально раскрыт
function renderFilterSection(container, title, items, type, selectedSet) {
  const section = document.createElement('div');
  section.className = 'border-b border-bone pb-6';

  const checkboxes = items.map((item) => `
    <div class="flex items-center gap-3">
      <input type="checkbox" id="${type}-${item.id}" class="custom-checkbox ${type}-check" value="${item.id}" ${selectedSet.has(Number(item.id)) ? 'checked' : ''}>
      <label for="${type}-${item.id}" class="text-sm text-tea-dark/60 cursor-pointer hover:text-tea-dark transition-colors">${escapeHtml(item.name)}</label>
    </div>
  `).join('');

  section.innerHTML = `
    <button class="accordion-header flex justify-between items-center w-full text-left group open">
      <span class="text-[10px] uppercase tracking-widest font-bold text-almond-silk group-hover:text-tea-dark transition-colors">${escapeHtml(title)}</span>
      <i data-lucide="chevron-down" size="14" class="text-bone group-hover:text-tea-dark"></i>
    </button>
    <div class="accordion-content open"><div class="space-y-3">${checkboxes}</div></div>
  `;
  container.appendChild(section);

  const header = section.querySelector('.accordion-header');
  const content = section.querySelector('.accordion-content');
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    content.classList.toggle('open');
  });
  window.lucide?.createIcons();
}

function teaCardHtml(tea) {
  const price = formatPrice(calculatePrice(tea.price_per_gram, tea.weight_grams));
  const heartClass = favIds.has(tea.id) ? 'fill-rose-400 stroke-rose-400' : 'fill-none stroke-current';
  return `
    <div class="mb-8 overflow-hidden relative aspect-square bg-linen">
      <img src="${escapeHtml(tea.image_url)}" alt="${escapeHtml(tea.name)}"
           class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" onerror="this.onerror=null;this.src='${import.meta.env.BASE_URL}no-image.png'">
      <div class="absolute inset-0 bg-tea-dark/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-4">
        <button class="heart-btn w-12 h-12 bg-white rounded-full flex items-center justify-center text-tea-dark hover:bg-almond-silk hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-500" data-fav-id="${tea.id}" title="В избранное">
          <i data-lucide="heart" size="20" class="w-5 h-5 ${heartClass}"></i>
        </button>
      </div>
      <div class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest">${escapeHtml(String(tea.weight_grams ?? ''))} г</div>
    </div>
    <div class="space-y-4">
      <div>
        <span class="text-[10px] uppercase tracking-widest font-bold text-almond-silk mb-2 block">${escapeHtml(tea.categories?.name ?? '')}</span>
        <h4 class="text-2xl font-serif text-tea-dark group-hover:text-almond-silk transition-colors">${escapeHtml(tea.name)}</h4>
      </div>
      <p class="text-sm text-tea-dark/50 leading-relaxed line-clamp-2">${escapeHtml(tea.description ?? '')}</p>
      <div class="pt-6 flex items-center justify-between border-t border-bone/50">
        <p class="text-lg font-serif text-tea-dark">${price}</p>
        <button class="add-to-cart-btn flex items-center gap-2 px-4 py-2 bg-tea-dark text-white text-[10px] font-bold uppercase tracking-widest hover:bg-almond-silk transition-all transform group-hover:scale-105" data-add-to-cart="${tea.id}">
          <i data-lucide="shopping-bag" size="14"></i>В корзину
        </button>
      </div>
    </div>
  `;
}

function renderCards(teas) {
  document.getElementById('loading')?.setAttribute('hidden', '');
  const grid = document.getElementById('tea-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  if (teas.length === 0) {
    grid.hidden = true;
    if (emptyState) emptyState.hidden = false;
    return;
  }
  grid.hidden = false;
  if (emptyState) emptyState.hidden = true;

  grid.innerHTML = '';
  for (const tea of teas) {
    const card = document.createElement('div');
    card.className = 'bg-white p-8 border border-bone group cursor-pointer hover:-translate-y-2 transition-all duration-500 shadow-sm hover:shadow-xl relative';
    card.dataset.teaSlug = tea.slug ?? '';
    if (tea.weight_grams != null) card.dataset.teaWeight = String(tea.weight_grams);
    card.innerHTML = teaCardHtml(tea);
    grid.appendChild(card);
  }
  window.lucide?.createIcons();
}

function renderPagination(total, page) {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return;

  const arrowClass = 'w-10 h-10 flex items-center justify-center text-xs font-bold border border-bone hover:border-tea-dark text-tea-dark/40 hover:text-tea-dark transition-all';
  const addBtn = (text, pageKey, disabled, extraClass = '') => {
    const btn = document.createElement('button');
    btn.className = extraClass || arrowClass;
    if (disabled) btn.classList.add('opacity-30', 'cursor-not-allowed');
    btn.dataset.page = pageKey;
    btn.textContent = text;
    btn.disabled = disabled;
    container.appendChild(btn);
  };

  addBtn('←', 'prev', page === 1);
  for (let n = 1; n <= totalPages; n++) {
    const active = n === page;
    const cls = 'w-10 h-10 flex items-center justify-center text-xs font-bold border transition-all ' +
      (active ? 'bg-tea-dark text-white border-tea-dark' : 'border-bone hover:border-tea-dark text-tea-dark/40 hover:text-tea-dark');
    addBtn(String(n), String(n), active, cls);
  }
  addBtn('→', 'next', page === totalPages);
}

function showError(message) {
  document.getElementById('loading')?.setAttribute('hidden', '');
  const grid = document.getElementById('tea-grid');
  if (grid) grid.hidden = true;
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    emptyState.innerHTML = `<p class="text-red-400">${escapeHtml(message)}</p>`;
    emptyState.hidden = false;
  }
}

function updateResetBtn() {
  const btn = document.getElementById('char-reset-btn');
  if (btn) btn.hidden = activeChars.size === 0 && activeCats.size === 0;
}

// загружает и показывает страницу каталога с текущими фильтрами
async function showPage(page, { scrollToGrid = false } = {}) {
  currentPage = page;
  document.getElementById('loading')?.removeAttribute('hidden');
  try {
    const { data, count } = await loadTeas(page, activeCats, activeChars);
    totalCount = count;
    renderCards(data);
    renderPagination(totalCount, currentPage);
    if (scrollToGrid) document.getElementById('tea-grid')?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showError(getErrorMessage(err, 'showPage'));
  }
}

function pageFromButton(btn) {
  if (btn.dataset.page === 'prev') return currentPage - 1;
  if (btn.dataset.page === 'next') return currentPage + 1;
  return Number(btn.dataset.page);
}

async function addTeaToCart(btn) {
  const teaId = Number(btn.dataset.addToCart);
  if (!Number.isFinite(teaId)) return;
  const weight = Number(btn.closest('[data-tea-slug]')?.dataset.teaWeight);

  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Добавляем...</span>';
  const result = await addToCart({
    tea_id: teaId,
    quantity: 1,
    weight_grams: Number.isFinite(weight) ? weight : undefined,
  });
  btn.disabled = false;
  if (result.ok) {
    btn.innerHTML = '<span>✓ В корзине</span>';
    setTimeout(() => { btn.innerHTML = original; window.lucide?.createIcons(); }, ADDED_FEEDBACK_MS);
  } else {
    btn.innerHTML = original;
    window.lucide?.createIcons();
    alert(result.error || 'Не удалось добавить в корзину');
  }
}

function onGridClick(event) {
  const heartBtn = event.target.closest('.heart-btn[data-fav-id]');
  if (heartBtn) {
    event.stopPropagation();
    toggleFavorite(Number(heartBtn.dataset.favId), heartBtn);
    return;
  }
  const cartBtn = event.target.closest('.add-to-cart-btn[data-add-to-cart]');
  if (cartBtn) {
    event.stopPropagation();
    event.preventDefault();
    addTeaToCart(cartBtn);
    return;
  }
  const card = event.target.closest('[data-tea-slug]');
  if (card?.dataset.teaSlug) {
    window.location.href = `${import.meta.env.BASE_URL}src/pages/tea.html?slug=${encodeURIComponent(card.dataset.teaSlug)}`;
  }
}

function onFilterChange(event) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  const id = Number(checkbox.value);
  if (checkbox.classList.contains('category-check')) {
    checkbox.checked ? activeCats.add(id) : activeCats.delete(id);
  } else if (checkbox.classList.contains('characteristic-check')) {
    checkbox.checked ? activeChars.add(id) : activeChars.delete(id);
  }
  updateResetBtn();
  showPage(1);
}

function resetFilters() {
  document.querySelectorAll('.custom-checkbox').forEach((cb) => { cb.checked = false; });
  activeChars.clear();
  activeCats.clear();
  updateResetBtn();
  showPage(1);
}

function bindEvents() {
  const filtersToggle = document.getElementById('toggle-filters');
  filtersToggle?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar');
    const hidden = sidebar?.classList.toggle('hidden-sidebar');
    filtersToggle.setAttribute('aria-expanded', String(!hidden));
  });

  document.getElementById('tea-grid')?.addEventListener('click', onGridClick);
  document.getElementById('category-filter')?.addEventListener('change', onFilterChange);
  document.getElementById('characteristic-filter')?.addEventListener('change', onFilterChange);
  document.getElementById('characteristic-filter')?.addEventListener('click', (event) => {
    if (event.target.closest('#char-reset-btn')) resetFilters();
  });
  document.getElementById('pagination')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    const page = pageFromButton(btn);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (page !== currentPage && page >= 1 && page <= totalPages) showPage(page, { scrollToGrid: true });
  });
}

async function init() {
  document.getElementById('loading')?.removeAttribute('hidden');

  currentUser = await getCurrentUser();
  if (currentUser) await loadFavIds(currentUser.id);

  try {
    const [categories, characteristics, firstPage] = await Promise.all([
      loadCategories(),
      loadCharacteristics(),
      loadTeas(1, new Set(), new Set()),
    ]);
    totalCount = firstPage.count;
    renderFilters(categories, characteristics);
    renderCards(firstPage.data);
    renderPagination(totalCount, currentPage);
  } catch (err) {
    showError(getErrorMessage(err, 'init'));
  }

  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
