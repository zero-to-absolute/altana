// Шаг 3 конструктора: имя смеси, формат, сохранение в корзину или рецепт.
// гостя ведём на модалку входа, после авторизации сохранение дожимается автоматически (?autoCheckout=1)

import { getState, subscribe, update, reset } from './state.js';
import { supabase } from '../shared/supabase.js';
import { escapeHtml, formatPrice } from '../shared/utils.js';
import { cupSlug, cupIconHtml, blendPrice, blendGrams, defaultRecipeName } from './blend.js';
import { saveRecipeAndAddToCart, deleteCartItem, updateExistingRecipe } from './save-and-cart.js';

function cupImgHtml(slug) {
  return cupIconHtml(slug, 64);
}

// контекст редактирования берём из URL — он единственный авторитет (state тянется из session)
function readEditCtx() {
  const p = new URLSearchParams(window.location.search);
  const editId = p.get('edit');
  if (editId && p.get('mode') === 'recipe') return { mode: 'recipe', recipeId: editId, cartItemId: null };
  if (editId && p.get('cartItem')) return { mode: 'cart', recipeId: null, cartItemId: p.get('cartItem') };
  return { mode: null, recipeId: null, cartItemId: null };
}

// ссылки уносят на login/register с маркерами, чтобы после входа дожать сохранение
function openAuthModal() {
  const base = import.meta.env.BASE_URL;
  document.querySelector('#step3-auth-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'step3-auth-modal';
  wrap.className = 'modal-backdrop';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `
    <div class="modal">
      <h3>Чтобы оформить заказ, войдите</h3>
      <p>Ваша смесь сохранена и появится после входа.</p>
      <div class="modal-actions">
        <a class="btn-ghost" href="${base}src/pages/register.html?redirect=constructor&step=3&autoCheckout=1">Регистрация</a>
        <a class="btn-primary" href="${base}src/pages/login.html?redirect=constructor&step=3&autoCheckout=1">Войти</a>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
}

async function currentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch (err) {
    console.error('auth.getUser:', err);
    return null;
  }
}

function compRowHtml(name, grams, pricePerGram) {
  const subtotal = typeof pricePerGram === 'number' ? `${Math.round(pricePerGram * grams)} ₽` : '—';
  return `
    <li class="step3-comp-row">
      <span class="step3-comp-name">${name}</span>
      <span class="step3-comp-grams">${grams} г</span>
      <span class="step3-comp-price">${subtotal}</span>
    </li>
  `;
}

function compSectionHtml(label, rowsHtml) {
  if (!rowsHtml) return '';
  return `
    <div class="step3-card-section">
      <div class="step3-card-section-label">${label}</div>
      <ul class="step3-comp-list">${rowsHtml}</ul>
    </div>
  `;
}

export function mountStep3({ container, data }) {
  container.innerHTML = `
    <div class="step3-layout">
      <h2 class="text-3xl md:text-4xl font-serif text-tea-dark mb-3 leading-tight">Финальные штрихи</h2>
      <p class="text-tea-dark/60 mb-8 text-sm leading-relaxed">Дайте смеси имя — она появится в корзине под этим названием.</p>

      <div class="step3-card" id="step3-card"></div>

      <div class="step3-name-block">
        <label for="recipe-name" class="step3-label">Название смеси</label>
        <input type="text" id="recipe-name" class="input-field w-full" maxlength="80" placeholder="Например: Утро с Ассамом" autocomplete="off">
        <div class="step3-name-hint">До 80 символов</div>
      </div>

      <div class="step3-format-block">
        <div class="step3-label">Формат</div>
        <div class="step3-format-toggle" role="group" aria-label="Формат смеси">
          <button type="button" class="step3-format-btn" data-format="blend">Готовый купаж</button>
          <button type="button" class="step3-format-btn" data-format="separate">Раздельный набор</button>
        </div>
        <p class="step3-format-hint" id="step3-format-hint"></p>
      </div>

      <div class="step3-error hidden" id="step3-error" role="alert" aria-live="polite"></div>

      <div class="step3-actions">
        <button type="button" class="btn-ghost" data-action="back">← Назад</button>
        <button type="button" class="btn-primary" data-action="save-cart">Сохранить и в корзину</button>
      </div>
      <div class="step3-edit-hint hidden" id="step3-edit-hint" aria-live="polite"></div>
    </div>
  `;

  const cardEl = container.querySelector('#step3-card');
  const nameInput = container.querySelector('#recipe-name');
  const formatHint = container.querySelector('#step3-format-hint');
  const formatBtns = container.querySelectorAll('.step3-format-btn');
  const errorEl = container.querySelector('#step3-error');
  const saveBtn = container.querySelector('[data-action="save-cart"]');
  const editHintEl = container.querySelector('#step3-edit-hint');

  const editCtx = readEditCtx();
  if (editCtx.mode === 'recipe') {
    saveBtn.textContent = 'Сохранить изменения';
    editHintEl.textContent = 'Редактируется существующий рецепт — сохранение перезапишет его.';
    editHintEl.classList.remove('hidden');
  } else if (editCtx.mode === 'cart') {
    editHintEl.textContent = 'Старая позиция корзины будет заменена новой смесью.';
    editHintEl.classList.remove('hidden');
  }

  nameInput.value = getState().recipeName || '';

  function renderCard() {
    const state = getState();
    const basesHtml = state.bases.map((b) => {
      const tea = data.teasById.get(b.teaId);
      return compRowHtml(tea ? escapeHtml(tea.name) : `#${b.teaId}`, b.grams, tea?.price_per_gram);
    }).join('');
    const ingsHtml = state.ingredients.map((item) => {
      const ing = data.ingredientsById.get(item.ingredientId);
      return ing ? compRowHtml(escapeHtml(ing.name), item.grams, ing.price_per_gram) : '';
    }).join('');

    cardEl.innerHTML = `
      <div class="step3-card-head">
        <div class="step3-card-cup">${cupImgHtml(cupSlug(state.bases, data.teasById))}</div>
        <div class="step3-card-meta">
          <div class="step3-card-total">${blendGrams(state)} г</div>
          <div class="step3-card-price">${escapeHtml(formatPrice(blendPrice(state, data)))}</div>
        </div>
      </div>
      ${compSectionHtml('Основа', basesHtml)}
      ${compSectionHtml('Ингредиенты', ingsHtml)}
    `;
  }

  function renderFormat() {
    const fmt = getState().blendFormat || 'blend';
    formatBtns.forEach((btn) => {
      const active = btn.dataset.format === fmt;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    formatHint.textContent = fmt === 'separate'
      ? 'Компоненты придут раздельно — смешаете сами перед завариванием.'
      : 'Все компоненты будут смешаны заранее.';
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  async function save() {
    if (saveBtn.disabled) return;
    hideError();

    if (!(await currentUser())) {
      openAuthModal();
      return;
    }

    if (!(getState().recipeName || '').trim()) {
      const auto = defaultRecipeName(getState().bases, data.teasById);
      update({ recipeName: auto });
      nameInput.value = auto;
    }

    const prevLabel = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем…';
    try {
      if (editCtx.mode === 'recipe' && editCtx.recipeId) {
        await updateExistingRecipe(editCtx.recipeId);
        reset();
        window.location.href = `${import.meta.env.BASE_URL}src/pages/saved-recipes.html`;
        return;
      }
      await saveRecipeAndAddToCart();
      if (editCtx.mode === 'cart' && editCtx.cartItemId) {
        try {
          await deleteCartItem(editCtx.cartItemId);
        } catch (delErr) {
          console.error('deleteCartItem:', delErr); // не валим поток — пользователь удалит дубль вручную
        }
      }
      reset();
      window.location.href = `${import.meta.env.BASE_URL}src/pages/cart.html`;
    } catch (err) {
      console.error('save:', err);
      showError(err?.message || 'Не удалось сохранить. Попробуйте ещё раз.');
      saveBtn.textContent = prevLabel;
      saveBtn.disabled = false;
    }
  }

  nameInput.addEventListener('input', () => update({ recipeName: nameInput.value }));
  formatBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.format === 'blend' || btn.dataset.format === 'separate') update({ blendFormat: btn.dataset.format });
  }));
  container.querySelector('[data-action="back"]').addEventListener('click', () => update({ step: 2 }));
  saveBtn.addEventListener('click', save);

  subscribe((state) => {
    if (!container.isConnected) return;
    // имя могли заполнить извне (autoCheckout) — синхронизируем, но не перебиваем ввод
    if (document.activeElement !== nameInput && nameInput.value !== (state.recipeName || '')) {
      nameInput.value = state.recipeName || '';
    }
    renderFormat();
  });

  renderCard();
  renderFormat();
  window.lucide?.createIcons();
}
