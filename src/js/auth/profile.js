// Страница профиля: показывает email/имя/дату регистрации/аватар, позволяет сменить имя, пароль и фото.
// Гостя уводит на страницу входа.

import { supabase } from '../shared/supabase.js';
import { getCurrentUser, logout } from './auth-state.js';

const MIN_PASSWORD_LENGTH = 6;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_BUCKET = 'avatars';

const COLOR_OK = '#22c55e';
const COLOR_ERROR = '#ef4444';

// статус-строка под секцией (имя / пароль / аватар)
function setStatus(elementId, message, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = isError ? COLOR_ERROR : COLOR_OK;
}

function clearStatus(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDisabled(el, disabled) {
  if (el) el.disabled = disabled;
}

function formatDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function publicAvatarUrl(path) {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // ?t=… — обходим кэш, чтобы новое фото показалось сразу
  return `${data.publicUrl}?t=${Date.now()}`;
}

function renderAvatar(avatarPath) {
  const wrapper = document.getElementById('avatar-preview-wrapper');
  if (!wrapper) return;
  if (avatarPath) {
    wrapper.innerHTML = `<img id="avatar-preview" src="${publicAvatarUrl(avatarPath)}" alt="Аватар" class="w-full h-full object-cover">`;
    return;
  }
  wrapper.innerHTML = '<i data-lucide="user" size="64"></i>';
  window.lucide?.createIcons();
}

async function loadProfile(user) {
  setText('user-email', user.email);

  let profile = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, created_at')
      .eq('id', user.id)
      .single();
    // PGRST116 — строки профиля ещё нет, это нормально (триггер мог не отработать)
    if (error && error.code !== 'PGRST116') {
      setStatus('profile-status', `Не удалось загрузить профиль: ${error.message}`, true);
      return;
    }
    profile = data ?? null;
  } catch (err) {
    console.error('loadProfile:', err);
    setStatus('profile-status', 'Непредвиденная ошибка при загрузке профиля', true);
    return;
  }

  const displayName = profile?.full_name || user.email;
  const nameInput = document.getElementById('full-name');
  if (nameInput) nameInput.value = profile?.full_name || '';
  setText('user-name-display', displayName);
  if (profile?.created_at) setText('user-created-at', formatDate(profile.created_at));
  renderAvatar(profile?.avatar_url ?? null);
}

async function handleAvatarChange(event, user) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('avatar-status', 'Выберите изображение', true);
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    setStatus('avatar-status', 'Файл не должен превышать 2 МБ', true);
    return;
  }

  const changeBtn = document.getElementById('avatar-change-btn');
  setDisabled(changeBtn, true);
  clearStatus('avatar-status');
  try {
    // имя файла в бакете = id пользователя, upsert перезаписывает прежнее фото
    const { error: uploadErr } = await supabase.storage.from(AVATAR_BUCKET).upload(user.id, file, { upsert: true });
    if (uploadErr) {
      setStatus('avatar-status', `Ошибка загрузки: ${uploadErr.message}`, true);
      return;
    }
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: user.id, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (updateErr) {
      setStatus('avatar-status', `Ошибка обновления профиля: ${updateErr.message}`, true);
      return;
    }
    renderAvatar(user.id);
    setStatus('avatar-status', 'Фото обновлено');
  } catch (err) {
    console.error('handleAvatarChange:', err);
    setStatus('avatar-status', 'Непредвиденная ошибка при загрузке аватара', true);
  } finally {
    setDisabled(changeBtn, false);
  }
}

async function handleNameSave(event, user) {
  event.preventDefault();
  clearStatus('profile-status');

  const name = document.getElementById('full-name')?.value.trim() ?? '';
  if (!name) {
    setStatus('profile-status', 'Имя не может быть пустым', true);
    return;
  }

  const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
  setDisabled(submitBtn, true);
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      setStatus('profile-status', `Ошибка сохранения: ${error.message}`, true);
      return;
    }
    // дублируем имя в auth metadata, при сбое профиль уже сохранён — просто логируем
    const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (authErr) console.error('sync full_name to auth:', authErr);
    setText('user-name-display', name);
    setStatus('profile-status', 'Сохранено');
  } catch (err) {
    console.error('handleNameSave:', err);
    setStatus('profile-status', 'Непредвиденная ошибка при сохранении', true);
  } finally {
    setDisabled(submitBtn, false);
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  clearStatus('password-status');

  const password = document.getElementById('new-password').value;
  const confirm = document.getElementById('new-password-confirm').value;
  if (password.length < MIN_PASSWORD_LENGTH) {
    setStatus('password-status', `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`, true);
    return;
  }
  if (password !== confirm) {
    setStatus('password-status', 'Пароли не совпадают', true);
    return;
  }

  const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
  setDisabled(submitBtn, true);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('password-status', error.message, true);
      return;
    }
    setStatus('password-status', 'Пароль изменён');
    document.getElementById('new-password').value = '';
    document.getElementById('new-password-confirm').value = '';
  } catch (err) {
    console.error('handlePasswordChange:', err);
    setStatus('password-status', 'Непредвиденная ошибка при смене пароля', true);
  } finally {
    setDisabled(submitBtn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser();
  if (!user) {
    const back = encodeURIComponent(window.location.pathname);
    window.location.href = `${import.meta.env.BASE_URL}src/pages/login.html?redirect=${back}`;
    return;
  }

  await loadProfile(user);

  const avatarBtn = document.getElementById('avatar-change-btn');
  const avatarInput = document.getElementById('avatar-input');
  if (avatarBtn && avatarInput) {
    avatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (event) => handleAvatarChange(event, user));
  }

  document.getElementById('profile-form')?.addEventListener('submit', (event) => handleNameSave(event, user));
  document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);
  document.getElementById('profile-logout-btn')?.addEventListener('click', async () => {
    await logout();
    window.location.href = import.meta.env.BASE_URL;
  });
});
