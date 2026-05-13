# Картинки чашек чая

Положи сюда PNG-файлы (прозрачный фон, квадратное полотно ≈ 256×256):

- `default.png` — fallback, когда основа не выбрана или slug неизвестен
- `black-tea.png`
- `green-tea.png`
- `oolong.png`
- `puerh.png`
- `white-tea.png`
- `herbal.png`
- `rooibos.png`

Код выбирает картинку по `category.slug` доминирующего чая в основе.
Файл `default.png` обязателен — он подставляется, если матча нет.

Найти конкретные места выбора: [src/js/constructor/render-step3.js](../../src/js/constructor/render-step3.js),
[src/js/constructor/render-preview.js](../../src/js/constructor/render-preview.js),
[src/js/recipes/saved-recipes.js](../../src/js/recipes/saved-recipes.js).
