import { describe, it, expect, vi } from 'vitest';

/**
 * login.js и register.js при импорте обращаются к Supabase и DOM.
 * Перед загрузкой модулей мокаем тяжёлые зависимости — нам нужны
 * только чистые функции валидации, не сетевые вызовы.
 */
vi.mock('../src/js/shared/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock('../src/js/auth/auth-state.js', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  postAuthRedirectUrl: vi.fn().mockReturnValue('/'),
}));

const { validateLogin } = await import('../src/js/auth/login.js');
const { validateRegister } = await import('../src/js/auth/register.js');

/**
 * Тесты клиентской валидации формы входа.
 * Проверяют сообщения об ошибках до отправки запроса в Supabase.
 */
describe('auth/validateLogin', () => {
  it('требует email при пустом значении', () => {
    expect(validateLogin('', 'pass')).toBe('Введите email');
  });

  it('требует пароль при пустом значении', () => {
    expect(validateLogin('user@x.ru', '')).toBe('Введите пароль');
  });

  it('пропускает корректные данные без ошибок', () => {
    expect(validateLogin('user@x.ru', 'pass123')).toBeNull();
  });
});

/**
 * Тесты клиентской валидации формы регистрации.
 * Проверяют требования к имени, формату пароля и совпадению полей.
 */
describe('auth/validateRegister', () => {
  it('требует имя пользователя', () => {
    expect(validateRegister('', 'u@x.ru', 'pass12', 'pass12')).toBe('Введите имя');
  });

  it('требует email при пустом значении', () => {
    expect(validateRegister('Иван', '', 'pass12', 'pass12')).toBe('Введите email');
  });

  it('требует пароль не короче шести символов', () => {
    expect(validateRegister('Иван', 'u@x.ru', '12345', '12345')).toBe('Пароль должен содержать минимум 6 символов');
  });

  it('требует совпадения пароля и подтверждения', () => {
    expect(validateRegister('Иван', 'u@x.ru', 'pass12', 'pass34')).toBe('Пароли не совпадают');
  });

  it('пропускает корректно заполненные поля без ошибок', () => {
    expect(validateRegister('Иван', 'u@x.ru', 'pass12', 'pass12')).toBeNull();
  });

  it('возвращает первую по приоритету ошибку при нескольких пустых полях', () => {
    expect(validateRegister('', '', 'pass12', 'pass12')).toBe('Введите имя');
  });
});
