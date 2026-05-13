// Подсказки сочетаемости ингредиентов для текущего состояния смеси.
// RULES — статический массив правил, отсортированных по специфичности.

export const RULES = [
  // Корица
  {
    ingredient: 'cinnamon',
    condition: { blendHasIngredient: ['cardamom', 'clove'] },
    text: 'Триада chai: корица, гвоздика, кардамон — классика индийского чая.',
  },
  {
    ingredient: 'cinnamon',
    condition: { blendHasIngredient: 'cardamom' },
    text: 'Создаст chai-связку с кардамоном — основа индийского чая.',
  },
  {
    ingredient: 'cinnamon',
    condition: { blendBaseCategory: 'black' },
    text: 'С чёрной основой даёт тёплый, дессертный профиль.',
  },
  // Кардамон
  {
    ingredient: 'cardamom',
    condition: { blendHasIngredient: 'cinnamon' },
    text: 'Кардамон + корица = ядро chai. Хороший выбор.',
  },
  {
    ingredient: 'cardamom',
    condition: { blendBaseCategory: 'black' },
    text: 'Раскрывает чёрный чай по-восточному.',
  },
  // Гвоздика
  {
    ingredient: 'clove',
    condition: { blendHasIngredient: 'cinnamon' },
    text: 'Гвоздика + корица — согревающий зимний дуэт.',
  },
  {
    ingredient: 'clove',
    condition: { blendHasCharacteristic: 'aroma:пряный' },
    text: 'Усилит пряный профиль смеси — добавляйте умеренно.',
  },
  // Имбирь
  {
    ingredient: 'ginger',
    condition: { blendHasIngredient: 'lemon-zest' },
    text: 'Классика согревающего напитка против простуды.',
  },
  {
    ingredient: 'ginger',
    condition: { blendBaseCategory: 'black' },
    text: 'С чёрной основой — характерный масала-тон.',
  },
  // Бергамот
  {
    ingredient: 'bergamot-zest',
    condition: { blendBaseCategory: 'black' },
    text: 'Так получается Earl Grey — каноничный английский купаж.',
  },
  {
    ingredient: 'bergamot-zest',
    condition: { blendHasCharacteristic: 'taste:цитрусовый' },
    text: 'Усилит цитрусовый профиль — следите за балансом.',
  },
  // Цедра лимона
  {
    ingredient: 'lemon-zest',
    condition: { blendHasIngredient: 'ginger' },
    text: 'Лимон и имбирь — освежающий тандем для зимы.',
  },
  {
    ingredient: 'lemon-zest',
    condition: { blendBaseCategory: 'green' },
    text: 'С зелёной основой — лёгкий, утренний характер.',
  },
  // Ваниль
  {
    ingredient: 'vanilla',
    condition: { blendBaseCategory: 'rooibos' },
    text: 'Канон ройбос-десерта — мягко и сладко.',
  },
  {
    ingredient: 'vanilla',
    condition: { blendHasCharacteristic: 'taste:сладкий' },
    text: 'Подчеркнёт десертный характер смеси.',
  },
  // Мята
  {
    ingredient: 'peppermint',
    condition: { blendBaseCategory: 'green' },
    text: 'Получится Marrakech Mint — марокканский мятный чай.',
  },
  {
    ingredient: 'peppermint',
    condition: { blendHasCharacteristic: 'aroma:цветочный' },
    text: 'Свежесть мяты сбалансирует цветочные ноты.',
  },
  // Жасмин
  {
    ingredient: 'jasmine',
    condition: { blendBaseCategory: 'green' },
    text: 'Зелёный + жасмин — классика китайских ароматизированных чаёв.',
  },
  {
    ingredient: 'jasmine',
    condition: { blendHasIngredient: 'rose' },
    text: 'Жасмин с розой — насыщенный цветочный букет.',
  },
  // Эвкалипт
  {
    ingredient: 'eucalyptus',
    condition: { blendIngredientIsAlone: true },
    text: 'В одиночку доминирует — оставьте небольшую порцию.',
  },
  {
    ingredient: 'eucalyptus',
    condition: { blendHasIngredient: 'peppermint' },
    text: 'С мятой образует мощный ментоловый аккорд.',
  },
  // Шиповник
  {
    ingredient: 'rose-hip',
    condition: { blendBaseCategory: 'rooibos' },
    text: 'С ройбосом — мягкий витаминный настой.',
  },
  {
    ingredient: 'rose-hip',
    condition: { blendHasIngredient: 'hibiscus' },
    text: 'Шиповник + каркаде — кисло-сладкий чайный микс.',
  },
  // Сушёная вишня
  {
    ingredient: 'dried-cherry',
    condition: { blendBaseCategory: 'black' },
    text: 'Чёрный чай с вишней — десертный купаж.',
  },
  {
    ingredient: 'dried-cherry',
    condition: { blendHasIngredient: 'vanilla' },
    text: 'Вишня и ваниль — сладкая, согревающая комбинация.',
  },
  // Сушёная клюква
  {
    ingredient: 'dried-cranberry',
    condition: { blendHasCharacteristic: 'taste:сладкий' },
    text: 'Кислинка клюквы оттеняет сладость смеси.',
  },
  {
    ingredient: 'dried-cranberry',
    condition: { blendBaseCategory: 'black' },
    text: 'Чёрный чай с клюквой — бодрый ягодный профиль.',
  },
  // Каркаде (как ингредиент)
  {
    ingredient: 'karkade',
    condition: { blendHasIngredient: 'rose-hip' },
    text: 'Каркаде с шиповником — насыщенный кисло-сладкий настой.',
  },
  {
    ingredient: 'karkade',
    condition: { blendIngredientIsAlone: true },
    text: 'Каркаде сильно подкрашивает настой — добавляйте умеренно.',
  },
  // Шалфей
  {
    ingredient: 'sage',
    condition: { blendBaseCategory: 'green' },
    text: 'С зелёной основой — травяной, лекарственный профиль.',
  },
  // Мелисса
  {
    ingredient: 'lemon-balm',
    condition: { blendHasIngredient: 'peppermint' },
    text: 'Мелисса с мятой — успокаивающий вечерний дуэт.',
  },
  {
    ingredient: 'lemon-balm',
    condition: { blendHasCharacteristic: 'effect:расслабляющий' },
    text: 'Усилит расслабляющий эффект.',
  },
  // Лаванда
  {
    ingredient: 'lavender',
    condition: { blendBaseCategory: 'black' },
    text: 'С чёрным чаем — прованский ароматный купаж.',
  },
  {
    ingredient: 'lavender',
    condition: { blendIngredientIsAlone: true },
    text: 'Лаванда легко доминирует — добавляйте по щепотке.',
  },
  // Календула
  {
    ingredient: 'calendula',
    condition: { blendHasCharacteristic: 'aroma:цветочный' },
    text: 'Дополнит цветочную палитру тёплыми тонами.',
  },
  // Хризантема
  {
    ingredient: 'chrysanthemum',
    condition: { blendBaseCategory: 'green' },
    text: 'С зелёным чаем — традиционный китайский охлаждающий напиток.',
  },
  {
    ingredient: 'chrysanthemum',
    condition: { blendBaseCategory: 'puer' },
    text: 'С пуэром — классика Гуандуна.',
  },
  // Иван-чай (как ингредиент)
  {
    ingredient: 'ivan-chay',
    condition: { blendBaseCategory: 'black' },
    text: 'С чёрным чаем — добавит ферментированную мягкость.',
  },
];

// Резолвит slug ингредиента в его id через каталог.
function resolveIngId(slug, catalog) {
  if (!catalog || !catalog.ingredientsBySlug) return null;
  const ing = catalog.ingredientsBySlug.get(slug);
  return ing ? ing.id : null;
}

// Получает массив { type, name } всех характеристик компонента.
function componentChars(component, catalog) {
  if (!catalog || !catalog.characteristics) return [];
  const map = component.type === 'tea' ? catalog.teaChars : catalog.ingChars;
  if (!map) return [];
  const ids = map.get(component.id) || [];
  const out = [];
  for (const id of ids) {
    const ch = catalog.characteristics.get(id);
    if (ch) out.push(ch);
  }
  return out;
}

// Проверяет одно условие правила относительно текущей смеси и каталога.
// Возвращает { matched, specificity } — либо null если не подошло.
function evaluateCondition(condition, blend, catalog) {
  let specificity = 0;
  let matched = true;
  // Условие "ингредиент один в смеси" (особый кейс эвкалипта/лаванды).
  if (condition.blendIngredientIsAlone === true) {
    if (!blend || !Array.isArray(blend.ingredients) || blend.ingredients.length > 1) {
      matched = false;
    }
    specificity = Math.max(specificity, 3);
  }
  if (matched && condition.blendHasIngredient !== undefined) {
    const slugs = Array.isArray(condition.blendHasIngredient)
      ? condition.blendHasIngredient
      : [condition.blendHasIngredient];
    const ids = slugs.map((s) => resolveIngId(s, catalog)).filter((v) => v !== null);
    const blendIds = (blend && blend.ingredients ? blend.ingredients.map((i) => i.ingredientId) : []);
    const hit = ids.some((id) => blendIds.includes(id));
    if (!hit) matched = false;
    specificity = Math.max(specificity, 3);
  }
  if (matched && condition.blendBaseCategory !== undefined) {
    const baseTeaId = blend && blend.bases && blend.bases.length > 0 ? blend.bases[0].teaId : null;
    const tea = baseTeaId !== null ? catalog.teasById.get(baseTeaId) : null;
    // Поддерживаем оба варианта схемы: tea.category_slug или tea.categories.slug.
    const slug = tea ? (tea.category_slug || (tea.categories && tea.categories.slug) || null) : null;
    if (slug !== condition.blendBaseCategory) matched = false;
    specificity = Math.max(specificity, 2);
  }
  if (matched && condition.blendHasCharacteristic !== undefined) {
    const want = condition.blendHasCharacteristic;
    const allComponents = [];
    if (blend && blend.bases) {
      for (const b of blend.bases) allComponents.push({ type: 'tea', id: b.teaId });
    }
    if (blend && blend.ingredients) {
      for (const i of blend.ingredients) allComponents.push({ type: 'ingredient', id: i.ingredientId });
    }
    let hit = false;
    for (const comp of allComponents) {
      const chars = componentChars(comp, catalog);
      for (const ch of chars) {
        if (`${ch.type}:${ch.name}` === want) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) matched = false;
    specificity = Math.max(specificity, 1);
  }
  return matched ? { specificity } : null;
}

// Возвращает { staticText, dynamicTexts } — top-2 динамических подсказки.
export function getHints({ ingredientSlug, blend, staticHint, catalog }) {
  const staticText = staticHint || '';
  const matched = [];
  for (const rule of RULES) {
    if (rule.ingredient !== ingredientSlug) continue;
    const res = evaluateCondition(rule.condition || {}, blend, catalog);
    if (res) {
      matched.push({ text: rule.text, specificity: res.specificity });
    }
  }
  matched.sort((a, b) => b.specificity - a.specificity);
  const dynamicTexts = matched.slice(0, 2).map((m) => m.text);
  return { staticText, dynamicTexts };
}
