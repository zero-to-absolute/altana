// Навигация в шапке: кнопки входа/выхода по состоянию авторизации, счётчик корзины,
// подборка чаёв на главной. Подключается на страницах с полной навигацией.

import './shared/icons.js';
import { getCurrentUser, onAuthChange, logout } from './auth/auth-state.js';
import { initCartCounter } from './shared/cart-counter.js';
import { supabase } from './shared/supabase.js';
import { formatPrice, calculatePrice, escapeHtml } from './shared/utils.js';

// перерисовывает #auth-buttons под текущего пользователя
function updateAuthUI(user) {
  const authButtons = document.getElementById('auth-buttons');
  if (!authButtons) return;

  if (user) {
    authButtons.innerHTML = `
      <div class="flex items-center gap-4">
        <a href="${import.meta.env.BASE_URL}src/pages/profile.html" class="p-2.5 rounded-full hover:bg-bone text-tea-dark transition-colors">
          <i data-lucide="user" size="24"></i>
        </a>
        <button id="logout-btn" class="hidden sm:flex items-center gap-3 px-6 py-3 bg-tea-dark text-parchment rounded-sm text-sm font-bold uppercase tracking-widest hover:bg-almond-silk transition-all">
          <i data-lucide="log-out" size="16"></i>
          <span>Выйти</span>
        </button>
      </div>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await logout();
      window.location.href = import.meta.env.BASE_URL;
    });
  } else {
    authButtons.innerHTML = `
      <a href="${import.meta.env.BASE_URL}src/pages/login.html" class="hidden sm:flex items-center gap-3 px-6 py-3 bg-tea-dark text-parchment rounded-sm text-sm font-bold uppercase tracking-widest hover:bg-almond-silk transition-all">
        <i data-lucide="log-in" size="16"></i>
        <span>Войти</span>
      </a>
    `;
  }
  window.lucide?.createIcons();
}

// четыре чая для блока #spring-grid на главной (на других страницах элемента нет — функция выходит)
async function loadSpringCollection() {
  const grid = document.getElementById('spring-grid');
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('teas')
      .select('id, name, slug, price_per_gram, weight_grams, image_url, categories(name)')
      .eq('in_stock', true)
      .order('id', { ascending: true })
      .limit(4);
    if (error) throw error;

    const teas = data ?? [];
    if (teas.length === 0) {
      grid.innerHTML = '<p class="text-tea-dark/40 col-span-full text-center">Каталог пока пуст.</p>';
      return;
    }

    grid.innerHTML = teas.map((tea) => {
      const price = formatPrice(calculatePrice(Number(tea.price_per_gram), tea.weight_grams));
      const slug = tea.slug ?? '';
      const imageBlock = tea.image_url
        ? `<img src="${escapeHtml(tea.image_url)}" alt="${escapeHtml(tea.name)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" onerror="this.onerror=null;this.src='${import.meta.env.BASE_URL}no-image.png'">`
        : `<i data-lucide="leaf" size="48" class="text-almond-silk group-hover:scale-110 transition-transform duration-300"></i>`;
      return `
        <a href="${import.meta.env.BASE_URL}src/pages/tea.html?slug=${encodeURIComponent(slug)}"
           class="bg-white p-6 border border-bone group cursor-pointer hover:-translate-y-2 transition-transform duration-300">
          <div class="aspect-square bg-linen mb-6 flex items-center justify-center overflow-hidden">
            ${imageBlock}
          </div>
          <span class="text-[10px] uppercase tracking-widest font-bold text-almond-silk mb-2 block">${escapeHtml(tea.categories?.name ?? '')}</span>
          <h4 class="text-xl font-serif text-tea-dark mb-2">${escapeHtml(tea.name)}</h4>
          <p class="text-sm font-bold text-tea-dark/60">от ${price}</p>
        </a>
      `;
    }).join('');
    window.lucide?.createIcons();
  } catch (err) {
    console.error('loadSpringCollection:', err);
    grid.innerHTML = '<p class="text-tea-dark/40 col-span-full text-center">Не удалось загрузить коллекцию.</p>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  updateAuthUI(await getCurrentUser());
  onAuthChange(updateAuthUI);
  initCartCounter();
  loadSpringCollection();
});
