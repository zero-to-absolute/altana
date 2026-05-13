// Страница входа: валидация формы, вызов Supabase Auth, редирект.

import { supabase } from '../shared/supabase.js';
import { getCurrentUser, postAuthRedirectUrl } from './auth-state.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

// проверяет введённые данные, возвращает текст ошибки или null
export function validateLogin(email, password) {
  if (!email.trim()) return 'Введите email';
  if (!password) return 'Введите пароль';
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

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const problem = validateLogin(email, password);
  if (problem) {
    showError(problem);
    return;
  }

  submitBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError(error.message);
      submitBtn.disabled = false;
      return;
    }
    window.location.href = postAuthRedirectUrl();
  } catch (err) {
    console.error('login:', err);
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
