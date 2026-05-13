// Блок «Памятка» об ингредиенте в Шаге 2: статичный role_hint и динамические подсказки из blend-hints.js.

import { getHints } from './blend-hints.js';
import { escapeHtml } from '../shared/utils.js';

// при наведении или фокусе на pill-ингредиенте показывает памятку; container — куда рендерить,
// pillsParent — родитель pill-ов для делегирования, data — каталог, getBlend — () => { bases, ingredients }
export function mountHints({ container, pillsParent, data, getBlend }) {
  renderEmpty(container);

  const onPill = (e) => {
    const pill = e.target.closest('[data-ingredient-slug]');
    if (pill) showHint(pill, container, data, getBlend);
  };
  pillsParent.addEventListener('mouseover', onPill);
  pillsParent.addEventListener('focusin', onPill);
  pillsParent.addEventListener('mouseleave', () => renderEmpty(container));
  pillsParent.addEventListener('focusout', (e) => {
    // сбрасываем только если фокус ушёл совсем за пределы pillsParent
    if (!pillsParent.contains(e.relatedTarget)) renderEmpty(container);
  });
}

function showHint(pillEl, container, data, getBlend) {
  const slug = pillEl.dataset.ingredientSlug;
  if (!slug) return;
  const ing = data.ingredientsBySlug.get(slug);
  if (!ing) return;

  const hints = getHints({
    ingredientSlug: slug,
    blend: getBlend(),
    staticHint: ing.role_hint || '',
    catalog: {
      teasBySlug: data.teasBySlug,
      teasById: data.teasById,
      ingredientsBySlug: data.ingredientsBySlug,
      characteristics: data.characteristics,
      teaChars: data.teaChars,
      ingChars: data.ingChars,
    },
  });

  const dynamicHtml = hints.dynamicTexts.length
    ? `<hr class="my-2 border-bone">
       <ul class="list-disc pl-4 space-y-1">${hints.dynamicTexts.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';
  container.innerHTML = `
    <h4 class="font-serif text-base text-tea-dark mb-1">${escapeHtml(ing.name)}</h4>
    <p class="text-sm text-tea-dark/70 leading-relaxed">${escapeHtml(hints.staticText)}</p>
    ${dynamicHtml}
  `;
}

function renderEmpty(container) {
  container.innerHTML = `
    <p class="text-xs text-tea-dark/40 italic">Наведите на ингредиент, чтобы увидеть подсказку о его роли в смеси.</p>
  `;
}
