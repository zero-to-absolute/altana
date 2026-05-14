// Единственный экземпляр Supabase-клиента. SDK импортируется из npm (бандлится Vite),
// поэтому CDN-блокировки jsdelivr/unpkg больше не валят сайт.
// Заглушка остаётся на случай, если недоступен сам домен Supabase (это уже бэкенд, не SDK).

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

function createUnavailableClient(reason) {
  const error = { message: reason };
  let warned = false;
  function warnOnce() {
    if (warned) return;
    warned = true;
    console.error('[supabase]', error.message);
  }

  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        warnOnce();
        return (resolve) => resolve({ data: [], error });
      }
      return new Proxy(target, handler);
    },
    apply() {
      return new Proxy(noop, handler);
    },
  };
  function noop() {}
  return new Proxy(noop, handler);
}

let client;
try {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('[supabase] не удалось создать клиента', err);
  client = createUnavailableClient('Supabase-клиент не инициализирован: ' + (err?.message || 'unknown error'));
}

export const supabase = client;
