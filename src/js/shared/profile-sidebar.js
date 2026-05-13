// profile-sidebar.js — Общий сайдбар личного кабинета
// Используется на страницах: orders, favorites, saved-recipes.
// Загружает имя и аватар пользователя из БД и подсвечивает активный пункт меню.

import { supabase } from './supabase.js';
import { getCurrentUser, logout } from '../auth/auth-state.js';
import { escapeHtml } from './utils.js';

/**
 * Подставляет HTML сайдбара в элемент с id="sidebar-mount".
 * @param {string} active — ключ активного пункта: 'profile' | 'orders' | 'favorites' | 'recipes'
 */
export async function mountProfileSidebar(active) {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;

  const items = [
    { key: 'profile',   label: 'Профиль',             href: 'profile.html' },
    { key: 'orders',    label: 'Мои заказы',          href: 'orders.html' },
    { key: 'favorites', label: 'Избранное',           href: 'favorites.html' },
    { key: 'recipes',   label: 'Сохранённые рецепты', href: 'saved-recipes.html' },
  ];

  // Изначально показываем заглушку
  mount.innerHTML = renderSidebar({
    active,
    items,
    fullName: '',
    avatarUrl: null,
    initials: '—',
    createdAt: null,
  });

  bindLogout();

  try {
    const user = await getCurrentUser();

    // гостя уводим на страницу входа
    if (!user) {
      const loginUrl = import.meta.env.BASE_URL +
        'src/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      window.location.href = loginUrl;
      return;
    }

    // Загружаем профиль
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, created_at')
      .eq('id', user.id)
      .maybeSingle();

    const fullName = profile?.full_name || user.email;
    const initials = makeInitials(fullName);
    const avatarPublicUrl = profile?.avatar_url
      ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
      : null;

    mount.innerHTML = renderSidebar({
      active,
      items,
      fullName,
      avatarUrl: avatarPublicUrl,
      initials,
      createdAt: profile?.created_at,
    });

    bindLogout();

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('mountProfileSidebar:', err);
  }
}

/**
 * Возвращает true, если пользователь авторизован, иначе делает редирект и возвращает false.
 * Используется страницами личного кабинета как guard.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = import.meta.env.BASE_URL +
      'src/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    window.location.href = loginUrl;
    return null;
  }
  return user;
}

function bindLogout() {
  const btn = document.getElementById('sidebar-logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await logout();
    window.location.href = import.meta.env.BASE_URL;
  });
}

function makeInitials(name) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '—';
}

function formatJoinedAt(iso) {
  if (!iso) return '';
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const d = new Date(iso);
  return `Участник с ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderSidebar({ active, items, fullName, avatarUrl, initials, createdAt }) {
  const navHtml = items.map((it) => {
    const on = it.key === active;
    const classes = on
      ? 'block w-full px-8 py-4 text-left text-xs font-bold uppercase tracking-widest bg-parchment border-l-4 border-almond-silk text-tea-dark'
      : 'block w-full px-8 py-4 text-left text-xs font-bold uppercase tracking-widest text-tea-dark/40 hover:bg-parchment hover:text-tea-dark transition-all';
    return `<a href="${it.href}" class="${classes}">${it.label}</a>`;
  }).join('');

  const avatarBlock = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="Аватар" class="w-full h-full object-cover">`
    : `<span class="font-serif text-3xl text-tea-dark/70">${escapeHtml(initials)}</span>`;

  return `
    <aside class="space-y-8 lg:sticky lg:top-28 self-start">
      <div class="bg-white border border-bone p-8 text-center space-y-4">
        <div class="w-28 h-28 mx-auto bg-linen rounded-full flex items-center justify-center text-almond-silk border-2 border-bone overflow-hidden">
          ${avatarBlock}
        </div>
        <div>
          <h2 class="text-xl font-serif text-tea-dark">${escapeHtml(fullName || 'Загрузка...')}</h2>
          <p class="text-[10px] text-tea-dark/40 uppercase tracking-widest mt-1">${escapeHtml(formatJoinedAt(createdAt))}</p>
        </div>
      </div>
      <nav class="bg-white border border-bone overflow-hidden">
        ${navHtml}
        <button id="sidebar-logout-btn" class="w-full px-8 py-4 text-left text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-50 transition-all">Выйти</button>
      </nav>
    </aside>
  `;
}
