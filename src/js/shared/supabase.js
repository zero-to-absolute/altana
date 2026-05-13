// Единственный экземпляр Supabase-клиента, SDK подключается тегом <script> в HTML.
// Если SDK не загрузился — подставляем заглушку, которая на любой запрос отдаёт ошибку и пишет в консоль.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

function createUnavailableClient() {
  const error = {
    message: 'Supabase SDK не загрузился. Проверьте подключение к интернету и тег <script> с supabase-js.',
  };
  let warned = false;
  function warnOnce() {
    if (warned) return;
    warned = true;
    console.error('[supabase]', error.message);
  }

  // прокси, который умеет всё: любой метод возвращает такой же прокси (для цепочек .from().select()...),
  // а await на нём даёт { data: null, error }
  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        warnOnce();
        // data: [] — чтобы код, делающий data.map(...) без проверки error, не падал
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

export const supabase = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createUnavailableClient();
