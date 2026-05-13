// Шкала совместимости/сочетаемости. Строится через DOM-методы (без innerHTML) — XSS-безопасно.

import { bucket } from '../constructor/compatibility.js';

const SIZE_CLASS = { sm: 'scale-sm', md: 'scale-md', lg: 'scale-lg' };
const LEVEL_CLASSES = ['scale-emerald', 'scale-sage', 'scale-amber', 'scale-terracotta', 'scale-clay-red'];

// создаёт элемент шкалы по score (size — 'sm'|'md'|'lg', label переопределяет подпись); опционально монтирует в container
export function renderScale({ score, container, size = 'md', label = null }) {
  const b = bucket(score);
  const root = document.createElement('div');
  root.className = `scale scale-${b.level} ${SIZE_CLASS[size] || SIZE_CLASS.md}`;

  const track = document.createElement('div');
  track.className = 'scale-track';
  const fill = document.createElement('div');
  fill.className = 'scale-fill';
  fill.style.width = `${b.fillPct}%`;
  fill.style.background = b.color;
  track.appendChild(fill);

  const lab = document.createElement('span');
  lab.className = 'scale-label';
  lab.textContent = label ?? b.label;

  root.appendChild(track);
  root.appendChild(lab);
  if (container) container.appendChild(root);
  return root;
}

// обновляет существующую шкалу под новый score без пересоздания DOM
export function updateScale(element, score, label = null) {
  if (!element) return;
  const b = bucket(score);
  element.classList.remove(...LEVEL_CLASSES);
  element.classList.add(`scale-${b.level}`);
  const fill = element.querySelector('.scale-fill');
  if (fill) {
    fill.style.width = `${b.fillPct}%`;
    fill.style.background = b.color;
  }
  const lab = element.querySelector('.scale-label');
  if (lab) lab.textContent = label ?? b.label;
}
