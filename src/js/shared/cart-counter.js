// Счётчик корзины в шапке: подключается из main.js, слушает событие CART_EVENT и пересчитывает количество.

import { supabase } from './supabase.js';
import { getCurrentUser, onAuthChange } from '../auth/auth-state.js';

export const CART_EVENT = 'cart:changed';

// суммарное количество позиций в корзине пользователя
export async function getCartCount(userId) {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  } catch (err) {
    console.error('getCartCount:', err);
    return 0;
  }
}

// перерисовывает все бейджи корзины (на странице их может быть несколько)
export async function updateCartBadge() {
  const user = await getCurrentUser();
  const count = user ? await getCartCount(user.id) : 0;
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = String(count);
    el.classList.toggle('opacity-50', count === 0);
  });
}

// вызывается после успешного изменения cart_items
export function notifyCartChanged() {
  document.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function initCartCounter() {
  updateCartBadge();
  onAuthChange(() => updateCartBadge());
  document.addEventListener(CART_EVENT, () => updateCartBadge());
}
