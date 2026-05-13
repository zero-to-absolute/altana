// Страница оформления заказа: создаёт orders + order_items, чистит cart_items, ведёт на orders.html.

import { supabase } from '../shared/supabase.js';
import { STORE_ADDRESS } from '../shared/config.js';
import { getCurrentUser } from '../auth/auth-state.js';
import { formatPrice, escapeHtml, getErrorMessage } from '../shared/utils.js';
import { notifyCartChanged } from '../shared/cart-counter.js';
import { itemName, itemWeight, unitPrice, lineTotal, isOutOfStock } from './cart-item.js';

let currentUser = null;
let cart = [];

async function loadCart(userId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, blend_format, weight_grams,
      tea_id, ingredient_id, recipe_id,
      teas        ( id, name, price_per_gram, weight_grams, image_url, in_stock ),
      ingredients ( id, name, price_per_gram, weight_grams, image_url, in_stock ),
      recipes (
        id, name, image_url, total_grams,
        recipe_teas        ( grams, teas        ( id, name, price_per_gram, in_stock ) ),
        recipe_ingredients ( grams, ingredients ( id, name, price_per_gram, in_stock ) )
      )
    `)
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + lineTotal(item), 0);
}

function renderSummary() {
  const itemsEl = document.getElementById('checkout-items');
  if (!itemsEl) return;

  itemsEl.innerHTML = cart.map((item) => {
    const weight = itemWeight(item);
    const weightLine = weight ? `<div class="text-xs text-tea-dark/50">${weight} г</div>` : '';
    return `
      <div class="flex gap-3 items-start text-sm">
        <span class="w-8 h-8 bg-linen flex items-center justify-center shrink-0 text-xs font-bold tabular-nums">${item.quantity}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">${escapeHtml(itemName(item))}</div>
          ${weightLine}
        </div>
        <div class="text-tea-dark tabular-nums shrink-0">${formatPrice(lineTotal(item))}</div>
      </div>
    `;
  }).join('');

  const total = formatPrice(cartTotal());
  const subtotalEl = document.getElementById('checkout-subtotal');
  const totalEl = document.getElementById('checkout-total');
  if (subtotalEl) subtotalEl.textContent = total;
  if (totalEl) totalEl.textContent = total;
}

// создаём заказ, его позиции и чистим корзину; если позиции не вставились — откатываем заказ
async function createOrder({ payment, note }) {
  const unavailable = cart.filter(isOutOfStock);
  if (unavailable.length > 0) {
    throw new Error(`Нет в наличии: ${unavailable.map(itemName).join(', ')}. Удалите эти товары из корзины.`);
  }

  // order_code генерируется DEFAULT-ом в БД (миграция 006)
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: currentUser.id,
      status: 'processing',
      total: cartTotal(),
      discount: 0,
      address: STORE_ADDRESS,
      payment_method: payment,
      note: note || null,
    })
    .select('id, order_code')
    .single();
  if (orderErr) throw orderErr;

  const itemRows = cart.map((item) => ({
    order_id: order.id,
    tea_id: item.tea_id ?? null,
    ingredient_id: item.ingredient_id ?? null,
    recipe_id: item.recipe_id ?? null,
    item_name: itemName(item),
    quantity: item.quantity,
    weight_grams: itemWeight(item),
    price: unitPrice(item),
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
  if (itemsErr) {
    await rollbackOrder(order.id);
    throw itemsErr;
  }

  const { error: clearErr } = await supabase.from('cart_items').delete().eq('user_id', currentUser.id);
  if (clearErr) console.error('clearCart after order:', clearErr); // заказ уже создан — не критично

  notifyCartChanged();
  return order;
}

async function rollbackOrder(orderId) {
  try {
    await supabase.from('orders').delete().eq('id', orderId);
  } catch (err) {
    // если сам откат не удался — заказ останется пустым, эту ошибку только логируем
    console.error('rollbackOrder:', err);
  }
}

function showError(text) {
  const el = document.getElementById('checkout-error');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
}

function setSubmitting(submitting) {
  const btn = document.getElementById('checkout-submit');
  if (!btn) return;
  btn.disabled = submitting;
  btn.classList.toggle('opacity-60', submitting);
  btn.classList.toggle('pointer-events-none', submitting);
  btn.innerHTML = submitting
    ? '<span>Создаём заказ...</span>'
    : '<span>Подтвердить заказ</span><i data-lucide="check" class="w-4 h-4"></i>';
  window.lucide?.createIcons();
}

async function handleSubmit(event) {
  event.preventDefault();
  document.getElementById('checkout-error')?.classList.add('hidden');

  const form = event.currentTarget;
  const payment = form.payment.value;
  if (!payment) return showError('Выберите способ оплаты');
  if (cart.length === 0) return showError('Корзина пуста');

  setSubmitting(true);
  try {
    const order = await createOrder({ payment, note: form.note.value.trim() });
    sessionStorage.setItem('lastOrderCode', order.order_code);
    window.location.href = 'orders.html';
  } catch (err) {
    showError(getErrorMessage(err, 'createOrder'));
    setSubmitting(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    const back = encodeURIComponent(window.location.pathname);
    window.location.href = `${import.meta.env.BASE_URL}src/pages/login.html?redirect=${back}`;
    return;
  }

  const loading = document.getElementById('checkout-loading');
  const content = document.getElementById('checkout-content');
  const empty = document.getElementById('checkout-empty');

  try {
    cart = await loadCart(currentUser.id);
  } catch (err) {
    loading?.classList.add('hidden');
    showError(getErrorMessage(err, 'loadCart'));
    return;
  }

  loading?.classList.add('hidden');
  if (cart.length === 0) {
    empty?.classList.remove('hidden');
    window.lucide?.createIcons();
    return;
  }

  content?.classList.remove('hidden');
  renderSummary();
  document.getElementById('checkout-form')?.addEventListener('submit', handleSubmit);
  window.lucide?.createIcons();
});
