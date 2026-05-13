// Страница «Мои заказы»: список заказов пользователя (orders + order_items),
// табы по статусу, аккордеоны с составом, кнопка «Повторить заказ».

import { supabase } from '../shared/supabase.js';
import { mountProfileSidebar, requireAuth } from '../shared/profile-sidebar.js';
import { formatPrice, escapeHtml, getErrorMessage, pluralize } from '../shared/utils.js';
import { addToCart } from '../cart/cart.js';

const STATUSES = {
  processing: { label: 'В обработке', color: '#8c7851' },
  shipping: { label: 'В пути', color: '#d5bdaf' },
  delivered: { label: 'Доставлен', color: '#6b8e5a' },
  cancelled: { label: 'Отменён', color: '#c06b5b' },
};

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

let orders = [];
let activeTab = 'all';

async function loadOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_code, status, total, discount, address, payment_method, note, created_at,
      order_items ( id, item_name, quantity, weight_grams, price, tea_id, ingredient_id, recipe_id )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function itemHtml(item) {
  const weight = item.weight_grams ? `, ${item.weight_grams} г` : '';
  const lineTotal = formatPrice(Number(item.price) * item.quantity);
  return `
    <div class="flex gap-4 items-center">
      <div class="w-14 h-14 bg-linen flex items-center justify-center shrink-0">
        <i data-lucide="leaf" class="w-6 h-6 text-almond-silk"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${escapeHtml(item.item_name)}${weight}</div>
        <div class="text-xs text-tea-dark/50">${item.quantity} шт · ${lineTotal}</div>
      </div>
    </div>
  `;
}

// текст под заказом для статусов «в обработке» и «отменён»
function statusNote(order) {
  if (order.status === 'processing') {
    return `<p class="text-sm text-tea-dark/60">Заказ комплектуется на нашем складе.</p>`;
  }
  if (order.status === 'cancelled') {
    const reason = order.note ? escapeHtml(order.note) : 'Возврат произведён на карту.';
    return `<p class="text-sm text-tea-dark/60">Заказ отменён. ${reason}</p>`;
  }
  return '';
}

// кнопку «Повторить заказ» показываем для всех статусов, кроме «в обработке»
function repeatButtonHtml(order) {
  if (order.status === 'processing') return '';
  return `<button class="btn-primary flex-1 text-xs inline-flex items-center justify-center gap-2"
            data-action="repeat" data-order-id="${escapeHtml(order.id)}">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>Повторить заказ
          </button>`;
}

function orderHtml(order) {
  const status = STATUSES[order.status] ?? { label: order.status, color: '#999' };
  const cancelled = order.status === 'cancelled';
  const itemsHtml = (order.order_items ?? []).map(itemHtml).join('');

  const note = statusNote(order);
  const repeatBtn = repeatButtonHtml(order);
  const actions = (note || repeatBtn)
    ? `<div class="space-y-3 pt-2">${note}${repeatBtn ? `<div class="flex gap-3">${repeatBtn}</div>` : ''}</div>`
    : '';

  return `
    <article class="order bg-white border border-bone overflow-hidden${cancelled ? ' opacity-70' : ''}" data-status="${order.status}">
      <button class="acc-header w-full flex items-center gap-6 p-6 md:p-8 text-left hover:bg-parchment/50 transition-colors">
        <div class="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
          <div>
            <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-1">Код заказа</div>
            <div class="font-serif text-lg text-tea-dark tabular-nums">${escapeHtml(order.order_code)}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-1">Дата</div>
            <div class="text-sm font-medium">${formatDate(order.created_at)}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-1">Статус</div>
            <div class="flex items-center gap-2 text-sm font-medium">
              <span class="status-dot" style="background:${status.color}"></span>${escapeHtml(status.label)}
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-1">Сумма</div>
            <div class="font-serif text-xl text-tea-dark tabular-nums${cancelled ? ' line-through' : ''}">${formatPrice(Number(order.total))}</div>
          </div>
        </div>
        <i data-lucide="chevron-down" class="w-5 h-5 text-tea-dark/40 acc-chevron"></i>
      </button>
      <div class="acc-body">
        <div class="px-6 md:px-8 pb-8 border-t border-bone pt-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8">
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-2">Состав заказа</div>
              ${itemsHtml || '<div class="text-sm text-tea-dark/40">Позиции не найдены.</div>'}
            </div>
            <div class="space-y-5 text-sm">
              <div>
                <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-2">Способ получения</div>
                <p class="text-tea-dark/70 leading-relaxed">${escapeHtml(order.address)}</p>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest font-bold text-tea-dark/40 mb-2">Способ оплаты</div>
                <p class="text-tea-dark/70">${escapeHtml(order.payment_method)}</p>
              </div>
              ${actions}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function updateTabCounters() {
  const counts = { all: orders.length };
  for (const key of Object.keys(STATUSES)) counts[key] = 0;
  for (const o of orders) {
    if (counts[o.status] !== undefined) counts[o.status]++;
  }

  document.querySelectorAll('#orders-tabs .tab').forEach((tab) => {
    const counter = tab.querySelector('.counter');
    if (counter) counter.textContent = String(counts[tab.dataset.tab] ?? 0);
  });

  const totalEl = document.getElementById('orders-total');
  if (totalEl) totalEl.textContent = `Всего ${counts.all} ${pluralize(counts.all, ['заказ', 'заказа', 'заказов'])}`;
}

function renderList() {
  const listEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  const filtered = activeTab === 'all' ? orders : orders.filter((o) => o.status === activeTab);

  if (filtered.length === 0) {
    listEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');
    window.lucide?.createIcons();
    return;
  }

  emptyEl?.classList.add('hidden');
  listEl?.classList.remove('hidden');
  if (!listEl) return;

  listEl.innerHTML = filtered.map(orderHtml).join('');
  listEl.querySelector('.order')?.classList.add('acc-open'); // первый раскрыт по умолчанию
  listEl.querySelectorAll('.order').forEach((article) => {
    article.querySelector('.acc-header')?.addEventListener('click', () => article.classList.toggle('acc-open'));
  });
  window.lucide?.createIcons();
}

// ссылка на товар не должна быть пустой (товар мог быть удалён из каталога)
function canReorder(item) {
  return [item.tea_id, item.ingredient_id, item.recipe_id].some((v) => v != null);
}

function itemToCartPayload(item) {
  const payload = {
    tea_id: item.tea_id ?? undefined,
    ingredient_id: item.ingredient_id ?? undefined,
    recipe_id: item.recipe_id ?? undefined,
    quantity: item.quantity,
  };
  if (item.recipe_id) payload.blend_format = 'blend'; // формат смеси в заказе не хранится — берём blend
  return payload;
}

// добавляет позиции заказа в корзину, возвращает { added, skipped }
async function reorder(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Заказ не найден');
  const items = order.order_items ?? [];
  if (items.length === 0) throw new Error('В заказе нет позиций');

  const skipped = [];
  let added = 0;
  for (const item of items) {
    if (!canReorder(item)) {
      skipped.push(item.item_name);
      continue;
    }
    const res = await addToCart(itemToCartPayload(item));
    if (res.ok) added += 1;
    else skipped.push(item.item_name);
  }
  return { added, skipped };
}

function reorderMessage(added, skipped) {
  const skippedLine = skipped.length
    ? `\nПропущено (нет в наличии или товар удалён):\n• ${skipped.join('\n• ')}`
    : '';
  if (added === 0) return `Не удалось добавить позиции в корзину.${skippedLine}`;
  if (skipped.length) return `Добавлено в корзину: ${added}.${skippedLine}`;
  return '';
}

function bindRepeatHandler() {
  document.getElementById('orders-list')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="repeat"]');
    if (!btn) return;
    event.stopPropagation();
    const orderId = btn.dataset.orderId;
    if (!orderId) return;

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Добавляем...</span>';

    const restoreButton = () => {
      btn.innerHTML = original;
      btn.disabled = false;
      window.lucide?.createIcons();
    };

    try {
      const { added, skipped } = await reorder(orderId);
      const message = reorderMessage(added, skipped);
      if (message) alert(message);
      if (added === 0) {
        restoreButton();
        return;
      }
      window.location.href = 'cart.html';
    } catch (err) {
      restoreButton();
      alert(getErrorMessage(err, 'reorder'));
    }
  });
}

function bindTabs() {
  const tabs = document.querySelectorAll('#orders-tabs .tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('border-almond-silk', active);
        t.classList.toggle('text-tea-dark', active);
        t.classList.toggle('border-transparent', !active);
        t.classList.toggle('text-tea-dark/50', !active);
      });
      renderList();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  await mountProfileSidebar('orders');

  const loadingEl = document.getElementById('orders-loading');
  try {
    orders = await loadOrders(user.id);
  } catch (err) {
    loadingEl?.classList.add('hidden');
    const errorEl = document.getElementById('orders-error');
    if (errorEl) {
      errorEl.textContent = getErrorMessage(err, 'loadOrders');
      errorEl.classList.remove('hidden');
    }
    return;
  }

  loadingEl?.classList.add('hidden');
  updateTabCounters();
  renderList();
  bindTabs();
  bindRepeatHandler();
});
