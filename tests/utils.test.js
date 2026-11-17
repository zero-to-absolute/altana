import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatPrice,
  formatPricePerGram,
  calculatePrice,
  roundKopecks,
  pluralize,
  getErrorMessage,
  escapeHtml,
} from '../src/js/shared/utils.js';

/**
 * Группа тестов модуля shared/utils.js — единственного модуля
 * приложения без зависимостей от DOM и Supabase. Покрывает
 * семь экспортируемых функций.
 */
describe('shared/utils', () => {
  /**
   * formatPrice — форматирование цены в рублях.
   * Целое выводится без копеек, дробное — с двумя десятичными
   * знаками через запятую. Для невалидных входов — прочерк.
   */
  describe('formatPrice', () => {
    it('форматирует целое число без копеек', () => {
      expect(formatPrice(450)).toBe('450 ₽');
    });

    it('форматирует дробное число с двумя десятичными знаками', () => {
      expect(formatPrice(450.5)).toBe('450,50 ₽');
    });

    it('возвращает прочерк при значении null', () => {
      expect(formatPrice(null)).toBe('— ₽');
    });
  });

  /**
   * formatPricePerGram — форматирование цены за грамм с постфиксом «₽/г».
   */
  describe('formatPricePerGram', () => {
    it('форматирует дробную цену за грамм', () => {
      expect(formatPricePerGram(6.88)).toBe('6,88 ₽/г');
    });

    it('возвращает прочерк при значении null', () => {
      expect(formatPricePerGram(null)).toBe('— ₽/г');
    });
  });

  /**
   * calculatePrice — расчёт итоговой цены позиции по цене за грамм
   * и граммовке с округлением до копеек.
   */
  describe('calculatePrice', () => {
    it('умножает цену за грамм на граммовку', () => {
      expect(calculatePrice(6, 100)).toBe(600);
    });

    it('корректно работает с дробными значениями', () => {
      expect(calculatePrice(1.5, 3)).toBe(4.5);
    });

    it('возвращает 0 при нечисловом первом аргументе', () => {
      expect(calculatePrice('10', 100)).toBe(0);
    });
  });

  /**
   * roundKopecks — округление до копеек.
   */
  describe('roundKopecks', () => {
    it('округляет результат до двух десятичных знаков', () => {
      expect(roundKopecks(123.456)).toBe(123.46);
    });
  });

  /**
   * pluralize — русское склонение существительного по числу.
   */
  describe('pluralize', () => {
    const forms = ['товар', 'товара', 'товаров'];

    it('возвращает форму «один» для числа 1', () => {
      expect(pluralize(1, forms)).toBe('товар');
    });

    it('возвращает форму «несколько» для числа 3', () => {
      expect(pluralize(3, forms)).toBe('товара');
    });

    it('возвращает форму «много» для числа 11', () => {
      expect(pluralize(11, forms)).toBe('товаров');
    });
  });

  /**
   * getErrorMessage — извлечение текста ошибки из объекта Supabase
   * или Error, с дополнительной проверкой состояния сети.
   */
  describe('getErrorMessage', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('возвращает fallback-строку при null без вызова console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = getErrorMessage(null);
      expect(result).toBe('Произошла ошибка. Попробуйте позже');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('извлекает текст из поля message объекта Supabase', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(getErrorMessage({ message: 'Invalid login credentials' })).toBe('Invalid login credentials');
      spy.mockRestore();
    });

    it('возвращает сообщение о потере сети при navigator.onLine = false', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      expect(getErrorMessage(new Error('Failed to fetch'))).toBe('Нет подключения к интернету');
      spy.mockRestore();
    });
  });

  /**
   * escapeHtml — экранирование HTML-сущностей при вставке
   * пользовательского ввода в разметку. Защита от XSS.
   */
  describe('escapeHtml', () => {
    it('экранирует символы из вредоносной строки', () => {
      const malicious = '<img src="x" onerror=\'alert(1)\'>';
      const escaped = escapeHtml(malicious);
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
    });

    it('возвращает пустую строку при значении null', () => {
      expect(escapeHtml(null)).toBe('');
    });
  });
});
