// Единственная точка работы с состоянием авторизации.
// Все модули берут пользователя и подписку отсюда, а не из supabase.auth напрямую.

import { supabase } from '../shared/supabase.js';

const noop = () => {};

// текущий пользователь из активной сессии или null
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('getSession:', error.message);
      return null;
    }
    return data.session?.user ?? null;
  } catch (err) {
    console.error('getCurrentUser:', err);
    return null;
  }
}

// подписка на вход, выход и обновление токена, возвращает { unsubscribe }
export function onAuthChange(callback) {
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    const sub = data?.subscription;
    return { unsubscribe: sub ? () => sub.unsubscribe() : noop };
  } catch (err) {
    console.error('onAuthChange:', err);
    return { unsubscribe: noop };
  }
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('signOut:', error.message);
  } catch (err) {
    console.error('logout:', err);
  }
}

// куда вести пользователя после входа/регистрации.
// Особый случай ?redirect=constructor — открыть конструктор на нужном шаге.
// Внешние (http://, //) адреса игнорируем, чтобы не было open redirect.
export function postAuthRedirectUrl() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('redirect');
  if (target === 'constructor') {
    const step = params.get('step') ?? '0';
    const auto = params.get('autoCheckout') === '1' ? '&autoCheckout=1' : '';
    return `${import.meta.env.BASE_URL}src/pages/constructor.html?step=${step}${auto}`;
  }
  if (target && target.startsWith('/') && !target.startsWith('//')) return target;
  return import.meta.env.BASE_URL;
}
