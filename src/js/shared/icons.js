// Инициализация иконок Lucide через npm-импорт (раньше грузилось с unpkg).
// createIcons({ icons }) заменяет все <i data-lucide="..."> на SVG.
//
// Также выставляем window.lucide.createIcons() — это shim для существующего кода,
// который привык к глобалу от <script src="https://unpkg.com/lucide@latest">.

import { createIcons, icons } from 'lucide';

export function initIcons() {
  createIcons({ icons });
}

// Совместимость со старым кодом: window.lucide?.createIcons()
if (typeof window !== 'undefined') {
  window.lucide = window.lucide || {};
  window.lucide.createIcons = initIcons;
}

// Первичная инициализация после готовности DOM (раньше это делал инлайн-скрипт в HTML).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initIcons());
  } else {
    initIcons();
  }
}
