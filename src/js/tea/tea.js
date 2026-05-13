// Страница чая: по ?slug=... грузит чай, показывает описание, выбор граммовки 5..100 г, цену и заказ.

import { supabase } from '../shared/supabase.js';
import { formatPrice, calculatePrice, getErrorMessage } from '../shared/utils.js';
import { showToast } from '../shared/toast.js';
import { addToCart } from '../cart/cart.js';

const MIN_GRAMS = 5;
const MAX_GRAMS = 100;
const STEP_GRAMS = 5;
const DEFAULT_GRAMS = 50;

const TEA_FIELDS = 'id, slug, name, description, price_per_gram, weight_grams, image_url, in_stock, categories(name, slug), inventory(stock_grams)';

// чай и выбранная пользователем граммовка — единственное мутабельное состояние страницы
let currentTea = null;
let weight = DEFAULT_GRAMS;

async function loadTeaBySlug(slug) {
  const { data, error } = await supabase.from('teas').select(TEA_FIELDS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

// остаток на складе — inventory приходит массивом (один-ко-многим по FK), хотя реально там одна строка
function stockGrams(tea) {
  const row = Array.isArray(tea?.inventory) ? tea.inventory[0] : tea?.inventory;
  return Number(row?.stock_grams ?? 0);
}

function isAvailable(tea) {
  return tea?.in_stock !== false && stockGrams(tea) > 0;
}

function clampWeight(value) {
  const stepped = Math.round(Number(value) / STEP_GRAMS) * STEP_GRAMS;
  if (!Number.isFinite(stepped)) return DEFAULT_GRAMS;
  return Math.max(MIN_GRAMS, Math.min(MAX_GRAMS, stepped));
}

function showNotFound() {
  document.getElementById('tea-loading')?.setAttribute('hidden', '');
  document.getElementById('tea-content')?.setAttribute('hidden', '');
  document.getElementById('tea-not-found')?.removeAttribute('hidden');
  const breadcrumb = document.getElementById('breadcrumb-name');
  if (breadcrumb) breadcrumb.textContent = 'Не найден';
  document.title = 'Чай не найден — Альтана';
}

function fillImage(tea) {
  const img = document.getElementById('tea-image');
  const fallback = document.getElementById('tea-image-fallback');
  if (!img) return;
  if (!tea.image_url) {
    img.classList.add('hidden');
    fallback?.classList.remove('hidden');
    return;
  }
  img.src = tea.image_url;
  img.alt = tea.name ?? '';
  img.classList.remove('hidden');
  fallback?.classList.add('hidden');
  img.onerror = () => {
    img.classList.add('hidden');
    fallback?.classList.remove('hidden');
    window.lucide?.createIcons();
  };
}

function fillContent(tea) {
  document.getElementById('tea-loading')?.setAttribute('hidden', '');
  document.getElementById('tea-not-found')?.setAttribute('hidden', '');
  const content = document.getElementById('tea-content');
  if (!content) return;
  content.removeAttribute('hidden');

  document.title = `${tea.name} — Альтана`;
  const breadcrumb = document.getElementById('breadcrumb-name');
  if (breadcrumb) breadcrumb.textContent = tea.name ?? '';

  fillImage(tea);
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('tea-category', tea.categories?.name ?? '');
  setText('tea-name', tea.name ?? '');
  setText('tea-description', tea.description ?? 'Описание отсутствует.');

  updateAvailabilityUI(tea);
  window.lucide?.createIcons();
}

function updateAvailabilityUI(tea) {
  const available = isAvailable(tea);

  // в Tailwind v4 утилита `hidden` и `inline-block` одной специфичности, и `inline-block`
  // объявлена позже — поэтому видимостью бейджа управляем inline-стилем, он точно перебьёт классы
  const badge = document.getElementById('tea-stock-badge');
  if (badge) badge.style.display = available ? 'none' : '';

  const orderBtn = document.getElementById('order-btn');
  if (!orderBtn) return;
  orderBtn.disabled = !available;
  if (!available) orderBtn.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4"></i> Нет в наличии';
}

function updatePriceUI() {
  const display = document.getElementById('weight-display');
  if (display) display.textContent = String(weight);

  const priceEl = document.getElementById('tea-price');
  if (priceEl && currentTea) priceEl.textContent = formatPrice(calculatePrice(Number(currentTea.price_per_gram), weight));

  document.querySelectorAll('.weight-chip').forEach((chip) => {
    const active = Number(chip.dataset.weight) === weight;
    chip.classList.toggle('border-tea-dark', active);
    chip.classList.toggle('bg-tea-dark', active);
    chip.classList.toggle('text-white', active);
    chip.classList.toggle('border-bone', !active);
  });
}

function setWeight(value) {
  weight = clampWeight(value);
  const slider = document.getElementById('weight-slider');
  if (slider) slider.value = String(weight);
  updatePriceUI();
}

// после заказа подтягиваем свежий остаток — за время на странице кто-то мог его выкупить
async function refreshAvailability() {
  try {
    const fresh = await loadTeaBySlug(currentTea.slug);
    if (fresh) currentTea = fresh;
  } catch (err) {
    console.error('tea:refreshAvailability', err);
  }
  updateAvailabilityUI(currentTea);
  window.lucide?.createIcons();
}

async function order() {
  const orderBtn = document.getElementById('order-btn');
  if (!currentTea || !orderBtn || orderBtn.disabled) return;

  orderBtn.disabled = true;
  try {
    const res = await addToCart({ tea_id: currentTea.id, quantity: 1, weight_grams: weight });
    if (res.ok) showToast(`«${currentTea.name}» (${weight} г) добавлен в корзину`);
    else if (res.error) showToast(res.error, { error: true });
  } catch (err) {
    showToast(getErrorMessage(err, 'tea:addToCart'), { error: true });
  } finally {
    await refreshAvailability();
  }
}

function bindHandlers() {
  document.getElementById('weight-slider')?.addEventListener('input', (e) => setWeight(e.target.value));
  document.querySelectorAll('.weight-chip').forEach((chip) => {
    chip.addEventListener('click', () => setWeight(chip.dataset.weight));
  });
  document.getElementById('order-btn')?.addEventListener('click', order);
}

async function init() {
  // если ключевых элементов нет — модуль импортирован зря (не на tea.html)
  if (!document.getElementById('tea-content')) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    showNotFound();
    return;
  }

  try {
    const tea = await loadTeaBySlug(slug);
    if (!tea) {
      showNotFound();
      return;
    }
    currentTea = tea;

    // стартовая граммовка — стандартная фасовка, если она в [5..100], иначе середина диапазона
    setWeight(Number.isFinite(Number(tea.weight_grams)) ? tea.weight_grams : DEFAULT_GRAMS);
    fillContent(tea);
    bindHandlers();
  } catch (err) {
    console.error('tea:init', err);
    showToast(getErrorMessage(err, 'loadTea'), { error: true });
    showNotFound();
  }
}

document.addEventListener('DOMContentLoaded', init);
