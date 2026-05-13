// Страница «Избранное»: чаи из таблицы favorites (+ teas/categories), удаление с анимацией,
// быстрое добавление в корзину.

import { supabase } from '../shared/supabase.js';
import { mountProfileSidebar, requireAuth } from '../shared/profile-sidebar.js';
import { formatPrice, calculatePrice, escapeHtml, getErrorMessage } from '../shared/utils.js';
import { addToCart } from '../cart/cart.js';

const REMOVE_ANIMATION_MS = 450;
const ADDED_FEEDBACK_MS = 1500;

let favorites = [];
let currentUser = null;

async function loadFavorites(userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select(`
      tea_id, added_at,
      teas ( id, name, slug, description, price_per_gram, weight_grams, image_url, categories ( name ) )
    `)
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((row) => row.teas);
}

async function removeFavorite(userId, teaId) {
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('tea_id', teaId);
  if (error) throw error;
}

function cardHtml(row) {
  const tea = row.teas;
  const price = formatPrice(calculatePrice(Number(tea.price_per_gram), tea.weight_grams));
  const imageBlock = tea.image_url
    ? `<img src="${escapeHtml(tea.image_url)}" alt="${escapeHtml(tea.name)}"
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onerror="this.onerror=null;this.src='${import.meta.env.BASE_URL}no-image.png'">`
    : `<div class="w-full h-full flex items-center justify-center"><i data-lucide="leaf" class="w-16 h-16 text-almond-silk"></i></div>`;

  return `
    <article class="fav-card bg-white border border-bone group relative overflow-hidden cursor-pointer" data-tea-id="${tea.id}" data-tea-slug="${escapeHtml(tea.slug ?? '')}" data-tea-weight="${escapeHtml(String(tea.weight_grams ?? ''))}">
      <button class="heart-pulse absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors z-10" data-remove title="Убрать из избранного">
        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-rose-400 stroke-rose-400" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <div class="aspect-[4/3] overflow-hidden relative">
        ${imageBlock}
      </div>
      <div class="p-6">
        <span class="text-[10px] uppercase tracking-widest font-bold text-almond-silk">${escapeHtml(tea.categories?.name ?? '')}</span>
        <h4 class="text-xl font-serif text-tea-dark mt-2">${escapeHtml(tea.name)}</h4>
        <div class="flex items-baseline justify-between mt-4">
          <p class="text-sm font-bold text-tea-dark/70 tabular-nums">от ${price}</p>
          <button class="add-to-cart-btn text-[10px] uppercase tracking-widest font-bold text-tea-dark/50 hover:text-almond-silk transition-colors" data-add-to-cart="${tea.id}">В корзину →</button>
        </div>
      </div>
    </article>
  `;
}

function renderGrid() {
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  const count = document.getElementById('fav-count');
  if (count) count.textContent = `· ${favorites.length}`;

  if (favorites.length === 0) {
    grid?.classList.add('hidden');
    empty?.classList.remove('hidden');
    window.lucide?.createIcons();
    return;
  }

  empty?.classList.add('hidden');
  grid?.classList.remove('hidden');
  if (grid) grid.innerHTML = favorites.map(cardHtml).join('');
  window.lucide?.createIcons();
}

function showError(text) {
  const el = document.getElementById('fav-error');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
}

function openTeaPage(slug) {
  window.location.href = `${import.meta.env.BASE_URL}src/pages/tea.html?slug=${encodeURIComponent(slug)}`;
}

async function handleRemove(card, btn) {
  const teaId = Number(card.dataset.teaId);
  btn.disabled = true;
  try {
    await removeFavorite(currentUser.id, teaId);
    card.classList.add('removing');
    setTimeout(() => {
      favorites = favorites.filter((row) => row.tea_id !== teaId);
      renderGrid();
    }, REMOVE_ANIMATION_MS);
  } catch (err) {
    btn.disabled = false;
    showError(getErrorMessage(err, 'removeFavorite'));
  }
}

async function handleAddToCart(card, btn) {
  const teaId = Number(btn.dataset.addToCart);
  if (!Number.isFinite(teaId)) return;
  const weight = Number(card?.dataset.teaWeight);

  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Добавляем...';
  const result = await addToCart({
    tea_id: teaId,
    quantity: 1,
    weight_grams: Number.isFinite(weight) ? weight : undefined,
  });
  btn.disabled = false;
  if (result.ok) {
    btn.innerHTML = '✓ В корзине';
    setTimeout(() => { btn.innerHTML = original; }, ADDED_FEEDBACK_MS);
  } else {
    btn.innerHTML = original;
    alert(result.error || 'Не удалось добавить в корзину');
  }
}

function onGridClick(event) {
  const removeBtn = event.target.closest('[data-remove]');
  if (removeBtn) {
    const card = removeBtn.closest('.fav-card');
    if (card) handleRemove(card, removeBtn);
    return;
  }
  const addBtn = event.target.closest('.add-to-cart-btn[data-add-to-cart]');
  if (addBtn) {
    event.stopPropagation();
    event.preventDefault();
    handleAddToCart(addBtn.closest('[data-tea-slug]'), addBtn);
    return;
  }
  const card = event.target.closest('[data-tea-slug]');
  if (card?.dataset.teaSlug) openTeaPage(card.dataset.teaSlug);
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  await mountProfileSidebar('favorites');

  const loadingEl = document.getElementById('fav-loading');
  try {
    favorites = await loadFavorites(currentUser.id);
  } catch (err) {
    loadingEl?.classList.add('hidden');
    showError(getErrorMessage(err, 'loadFavorites'));
    return;
  }

  loadingEl?.classList.add('hidden');
  renderGrid();
  document.getElementById('fav-grid')?.addEventListener('click', onGridClick);
});
