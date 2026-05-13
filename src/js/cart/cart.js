// Страница корзины и публичный addToCart() — работают только с авторизованным пользователем (RLS).

import { supabase } from '../shared/supabase.js';
import { getCurrentUser } from '../auth/auth-state.js';
import { formatPrice, escapeHtml, getErrorMessage, pluralize } from '../shared/utils.js';
import { notifyCartChanged } from '../shared/cart-counter.js';
import { itemName, itemImage, unitPrice, lineTotal, isOutOfStock } from './cart-item.js';

// кэш-копия корзины для рендера и пересчёта итогов
let cart = [];
let currentUser = null;

// добавляет позицию в корзину через RPC add_to_cart (атомарный upsert quantity, без гонок между устройствами)
// payload: { tea_id | ingredient_id | recipe_id, quantity?, blend_format?, weight_grams? }, возвращает { ok, error? }
export async function addToCart(payload) {
  const user = await getCurrentUser();
  if (!user) {
    redirectToLogin(window.location.pathname + window.location.search);
    return { ok: false, error: 'Требуется вход' };
  }

  const refs = [payload.tea_id, payload.ingredient_id, payload.recipe_id].filter(Boolean);
  if (refs.length !== 1) {
    return { ok: false, error: 'Должна быть указана ровно одна ссылка (чай / ингредиент / рецепт)' };
  }

  const quantity = Math.max(1, Number(payload.quantity ?? 1));
  const weightGrams = clampTeaWeight(payload);

  try {
    if (!(await isAvailable(payload))) {
      return { ok: false, error: 'Товар временно нет в наличии' };
    }
    const { error } = await supabase.rpc('add_to_cart', {
      p_tea_id: payload.tea_id ?? null,
      p_ingredient_id: payload.ingredient_id ?? null,
      p_recipe_id: payload.recipe_id ?? null,
      p_blend_format: payload.blend_format ?? null,
      p_quantity: quantity,
      p_weight_grams: weightGrams,
    });
    if (error) throw error;
    notifyCartChanged();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err, 'addToCart') };
  }
}

// граммовку храним только для чая, клампим в диапазон 5..100, иначе null
function clampTeaWeight({ tea_id, weight_grams }) {
  if (!tea_id || weight_grams == null) return null;
  const w = Math.round(Number(weight_grams));
  return Number.isFinite(w) && w >= 5 && w <= 100 ? w : null;
}

// есть ли товар в наличии (для рецепта достаточно одного чая-основы)
async function isAvailable({ tea_id, ingredient_id, recipe_id }) {
  try {
    if (tea_id) {
      const { data, error } = await supabase.from('teas').select('in_stock').eq('id', tea_id).maybeSingle();
      if (error) throw error;
      return data?.in_stock === true;
    }
    if (ingredient_id) {
      const { data, error } = await supabase.from('ingredients').select('in_stock').eq('id', ingredient_id).maybeSingle();
      if (error) throw error;
      return data?.in_stock === true;
    }
    if (recipe_id) {
      const { data, error } = await supabase
        .from('recipes')
        .select('recipe_teas ( teas ( in_stock ) )')
        .eq('id', recipe_id)
        .maybeSingle();
      if (error) throw error;
      return (data?.recipe_teas ?? []).some((rt) => rt.teas?.in_stock === true);
    }
  } catch (err) {
    console.error('isAvailable:', err);
    return false;
  }
  return false;
}

function redirectToLogin(backPath) {
  const back = encodeURIComponent(backPath);
  window.location.href = `${import.meta.env.BASE_URL}src/pages/login.html?redirect=${back}`;
}

// один JOIN-запрос покрывает все три типа позиции
async function loadCart(userId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, blend_format, added_at, weight_grams,
      tea_id, ingredient_id, recipe_id,
      teas        ( id, name, price_per_gram, weight_grams, image_url, in_stock,
                    categories ( name ) ),
      ingredients ( id, name, price_per_gram, weight_grams, image_url, in_stock ),
      recipes (
        id, name, image_url, total_grams,
        recipe_teas        ( grams, teas        ( id, name, price_per_gram, in_stock ) ),
        recipe_ingredients ( grams, ingredients ( id, name, price_per_gram, in_stock ) )
      )
    `)
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function updateQuantity(itemId, quantity) {
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: Math.max(1, Number(quantity)) })
    .eq('id', itemId);
  if (error) throw error;
  notifyCartChanged();
}

async function removeFromCart(itemId) {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
  notifyCartChanged();
}

function subtitle(item) {
  if (item.teas) {
    const grams = item.weight_grams ?? item.teas.weight_grams;
    return [item.teas.categories?.name, grams ? `${grams} г` : ''].filter(Boolean).join(' · ');
  }
  if (item.ingredients) {
    return ['Ингредиент', item.ingredients.weight_grams ? `${item.ingredients.weight_grams} г` : ''].filter(Boolean).join(' · ');
  }
  if (item.recipes) {
    return ['Авторская смесь', item.blend_format === 'blend' ? 'Смесью' : 'Раздельно'].join(' · ');
  }
  return '';
}

function itemHtml(item) {
  const img = itemImage(item);
  const title = itemName(item);
  const oos = isOutOfStock(item);

  const imageBlock = img
    ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${import.meta.env.BASE_URL}no-image.png'">`
    : `<div class="w-full h-full flex items-center justify-center"><i data-lucide="leaf" class="w-8 h-8 text-almond-silk"></i></div>`;

  const oosBadge = oos
    ? `<span class="inline-block mt-1 text-[10px] uppercase tracking-widest font-bold text-red-400">Нет в наличии</span>`
    : '';

  // карандаш «Редактировать» — только для авторских смесей
  const editBtn = item.recipe_id
    ? `<button data-edit class="p-2 text-tea-dark/40 hover:text-almond-silk transition-colors" title="Редактировать в конструкторе" aria-label="Редактировать">
         <i data-lucide="pencil" class="w-5 h-5"></i>
       </button>`
    : '';

  return `
    <article class="cart-item bg-white border border-bone p-6 flex gap-6 items-center" data-item-id="${escapeHtml(item.id)}">
      <div class="w-24 h-24 bg-linen flex items-center justify-center shrink-0 overflow-hidden">
        ${imageBlock}
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-serif text-tea-dark truncate">${escapeHtml(title)}</h3>
        <p class="text-xs text-tea-dark/50 mt-1">${escapeHtml(subtitle(item))}</p>
        <p class="text-xs text-tea-dark/40 mt-1">${formatPrice(unitPrice(item))} за шт.</p>
        ${oosBadge}
      </div>

      <div class="flex items-center gap-2 border border-bone">
        <button data-qty-dec class="w-8 h-8 flex items-center justify-center text-tea-dark hover:bg-bone transition-colors" aria-label="Уменьшить">−</button>
        <span data-qty-display class="w-8 text-center text-sm font-medium tabular-nums">${item.quantity}</span>
        <button data-qty-inc class="w-8 h-8 flex items-center justify-center text-tea-dark hover:bg-bone transition-colors" aria-label="Увеличить">+</button>
      </div>

      <div class="text-right min-w-[110px]">
        <p data-line-total class="text-lg font-serif text-tea-dark tabular-nums">${formatPrice(lineTotal(item))}</p>
      </div>

      ${editBtn}
      <button data-remove class="p-2 text-tea-dark/40 hover:text-red-400 transition-colors" aria-label="Удалить">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </article>
  `;
}

function render() {
  document.getElementById('cart-loading')?.classList.add('hidden');

  const content = document.getElementById('cart-content');
  const empty = document.getElementById('cart-empty');
  const counter = document.getElementById('cart-counter');

  if (cart.length === 0) {
    content?.classList.add('hidden');
    empty?.classList.remove('hidden');
    if (counter) counter.textContent = '';
    window.lucide?.createIcons();
    return;
  }

  empty?.classList.add('hidden');
  content?.classList.remove('hidden');

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  if (counter) counter.textContent = `· ${totalItems} ${pluralize(totalItems, ['товар', 'товара', 'товаров'])}`;

  const itemsContainer = document.getElementById('cart-items');
  if (itemsContainer) itemsContainer.innerHTML = cart.map(itemHtml).join('');

  const subtotal = cart.reduce((sum, i) => sum + lineTotal(i), 0);
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (totalEl) totalEl.textContent = formatPrice(subtotal);

  // если вся корзина — товары не в наличии, «Оформить» блокируем
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    const allOos = cart.every(isOutOfStock);
    checkoutBtn.classList.toggle('opacity-50', allOos);
    checkoutBtn.classList.toggle('pointer-events-none', allOos);
    checkoutBtn.toggleAttribute('aria-disabled', allOos);
  }

  window.lucide?.createIcons();
}

function showError(text) {
  const el = document.getElementById('cart-error');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
}

async function onItemClick(event) {
  const article = event.target.closest('.cart-item');
  if (!article) return;
  const id = article.dataset.itemId;
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  if (event.target.closest('[data-edit]') && item.recipe_id) {
    const params = new URLSearchParams({ edit: item.recipe_id, cartItem: item.id });
    window.location.href = `${import.meta.env.BASE_URL}src/pages/constructor.html?${params}`;
    return;
  }

  const inc = event.target.closest('[data-qty-inc]');
  const dec = event.target.closest('[data-qty-dec]');
  const rm = event.target.closest('[data-remove]');
  if (!inc && !dec && !rm) return;

  try {
    const removing = rm || (dec && item.quantity === 1);
    if (removing) {
      await removeFromCart(item.id);
      cart = cart.filter((i) => i.id !== id);
    } else {
      item.quantity += inc ? 1 : -1;
      await updateQuantity(item.id, item.quantity);
    }
    render();
  } catch (err) {
    showError(getErrorMessage(err, 'cartItemAction'));
    // вернуть состояние из БД, чтобы UI не расходился с фактом
    try {
      cart = await loadCart(currentUser.id);
      render();
    } catch (reloadErr) {
      console.error('reloadCart:', reloadErr);
    }
  }
}

async function init() {
  // если элементов корзины нет — мы не на cart.html (модуль могли импортнуть только ради addToCart)
  if (!document.getElementById('cart-loading')) return;

  currentUser = await getCurrentUser();
  if (!currentUser) {
    redirectToLogin(window.location.pathname);
    return;
  }

  try {
    cart = await loadCart(currentUser.id);
  } catch (err) {
    document.getElementById('cart-loading')?.classList.add('hidden');
    showError(getErrorMessage(err, 'loadCart'));
    return;
  }

  render();
  document.getElementById('cart-items')?.addEventListener('click', onItemClick);
}

document.addEventListener('DOMContentLoaded', init);
