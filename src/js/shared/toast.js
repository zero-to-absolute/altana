// Короткое всплывающее уведомление в правом нижнем углу.
// Стили — класс .toast в src/index.css; ошибка подсвечивается красным.

const VISIBLE_MS = 2500;

let activeToast = null;
let hideTimer = null;

export function showToast(text, { error = false } = {}) {
  if (activeToast) {
    activeToast.remove();
    clearTimeout(hideTimer);
  }

  const el = document.createElement('div');
  el.className = error ? 'toast toast--error' : 'toast';
  el.textContent = text;
  document.body.appendChild(el);

  activeToast = el;
  hideTimer = setTimeout(() => {
    el.remove();
    if (activeToast === el) activeToast = null;
  }, VISIBLE_MS);
}
