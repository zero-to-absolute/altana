// Общие утилиты проекта, без зависимостей от supabase.js и config.js.

const PRICE_PLACEHOLDER = '— ₽';
const GENERIC_ERROR = 'Произошла ошибка. Попробуйте позже';

// форматирует рубли: целое — без копеек, дробное — с двумя знаками и запятой
export function formatPrice(price) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return PRICE_PLACEHOLDER;
  if (price % 1 === 0) return `${price} ₽`;
  return `${price.toFixed(2).replace('.', ',')} ₽`;
}

// цена за грамм, например "6,88 ₽/г"
export function formatPricePerGram(pricePerGram) {
  if (typeof pricePerGram !== 'number' || !Number.isFinite(pricePerGram)) return '— ₽/г';
  return `${pricePerGram.toFixed(2).replace('.', ',')} ₽/г`;
}

// итог по цене за грамм и весу, округлённый до копеек
export function calculatePrice(pricePerGram, weightGrams) {
  if (typeof pricePerGram !== 'number' || typeof weightGrams !== 'number') return 0;
  if (!Number.isFinite(pricePerGram) || !Number.isFinite(weightGrams)) return 0;
  return Math.round(pricePerGram * weightGrams * 100) / 100;
}

// округление до копеек — для сумм, собранных из нескольких слагаемых
export function roundKopecks(value) {
  return Math.round(value * 100) / 100;
}

// русское склонение по числу: pluralize(2, ['товар', 'товара', 'товаров'])
export function pluralize(n, [one, few, many]) {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// превращает ошибку (Supabase или любую) в текст для пользователя и пишет её в консоль
export function getErrorMessage(error, context = '') {
  if (error === null || error === undefined) return GENERIC_ERROR;
  console.error(context, error);
  if (!navigator.onLine) return 'Нет подключения к интернету';
  const message = error.message;
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return GENERIC_ERROR;
}

// экранирует спецсимволы перед вставкой строки в innerHTML — защита от XSS
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
