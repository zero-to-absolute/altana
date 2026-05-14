// Страница регистрации: валидация формы, вызов Supabase Auth, редирект.

import '../shared/icons.js';
import { supabase } from '../shared/supabase.js';
import { getCurrentUser, postAuthRedirectUrl } from './auth-state.js';

const MIN_PASSWORD_LENGTH = 6;

const form = document.getElementById('register-form');
const nameInput = document.getElementById('full-name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('password-confirm');
const errorBox = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

// проверяет введённые данные, возвращает текст ошибки или null
export function validateRegister(name, email, password, confirm) {
  if (!name.trim()) return 'Введите имя';
  if (!email.trim()) return 'Введите email';
  if (password.length < MIN_PASSWORD_LENGTH) return `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`;
  if (password !== confirm) return 'Пароли не совпадают';
  return null;
}

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideError() {
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  const problem = validateRegister(name, email, password, confirm);
  if (problem) {
    showError(problem);
    return;
  }

  submitBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      showError(error.message);
      submitBtn.disabled = false;
      return;
    }
    window.location.href = postAuthRedirectUrl();
  } catch (err) {
    console.error('register:', err);
    showError('Произошла непредвиденная ошибка. Попробуйте позже.');
    submitBtn.disabled = false;
  }
}

async function init() {
  if (!form) return;
  if (await getCurrentUser()) {
    window.location.href = postAuthRedirectUrl();
    return;
  }
  form.addEventListener('submit', handleSubmit);
}

init();
