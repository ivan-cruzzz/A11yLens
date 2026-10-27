import type { Category } from "./types";

export interface Tip {
  /** WCAG criterion, e.g. "1.4.3". */
  wcag: string;
  /** One-line advice (экспресс-движок). */
  short: string;
  /** Detailed advice with steps (глубокий движок). */
  full: string;
  /** Optional code example (строгий движок добавляет чек-лист). */
  code?: string;
}

const T = (
  wcag: string,
  short: string,
  full: string,
  code?: string
): Tip => ({ wcag, short, full, code });

/**
 * Эвристическая база «AI-советов»: для каждого правила axe-core —
 * краткий и подробный рецепт исправления. Покрыты самые частые правила;
 * для остальных советы строятся из текста axe (help + helpUrl).
 */
const RULE_TIPS: Record<string, Tip> = {
  "color-contrast": T(
    "1.4.3",
    "Текст не читается на этом фоне: поднимите контраст минимум до 4.5:1 (для крупного текста — 3:1).",
    "Текущий цвет текста и фона дают контраст ниже порога WCAG. Как исправить: 1) затемните текст или осветлите фон, пока контраст не достигнет 4.5:1 (крупный текст ≥ 24px или 19px bold — 3:1); 2) проверьте все состояния: hover, disabled, placeholder; 3) не полагайтесь на полупрозрачный текст поверх фото — подложите под него плашку.",
    "/* Было: */ .hint { color: #9ca3af; background: #f9fafb; }\n/* Стало (контраст 4.6:1): */\n.hint { color: #52525b; background: #f9fafb; }"
  ),
  "link-in-text-block": T(
    "1.4.1",
    "Ссылку внутри текста выделяйте не только цветом — добавьте подчёркивание.",
    "Ссылка в блоке текста отличается только цветом, который может быть незаметен дальтоникам. Добавьте подчёркивание или другой визуальный признак (например, жирность), сохраняя контраст 4.5:1.",
    "a.text-link { text-decoration: underline; text-underline-offset: 2px; }"
  ),
  "image-alt": T(
    "1.1.1",
    "У изображения нет alt — опишите его содержание или скройте alt=\"\" для декоративных.",
    "Каждое изображение обязано иметь атрибут alt. Информативные картинки — краткое описание смысла (что показано и зачем); декоративные — пустой alt=\"\", чтобы скринридер их пропускал. Иконки-ссылки получают alt с названием действия.",
    "<!-- информативное -->\n<img src=\"chart.png\" alt=\"Продажи выросли на 18% за квартал\">\n<!-- декоративное -->\n<img src=\"divider.svg\" alt=\"\">"
  ),
  "input-image-alt": T(
    "1.1.1",
    "Кнопка-картинка без alt — добавьте alt с названием действия.",
    "Кнопка отправки в виде изображения должна иметь alt, повторяющий её назначение: «Найти», «Отправить», «Подписаться».",
    "<input type=\"image\" src=\"search.svg\" alt=\"Найти\">"
  ),
  "area-alt": T(
    "1.1.1",
    "Активной области карты-изображения нужен alt с названием цели.",
    "Каждый <area> внутри image-map должен описывать, куда ведёт ссылка.",
    "<area shape=\"rect\" coords=\"10,10,80,60\" href=\"docs.html\" alt=\"Документация\">"
  ),
  "svg-img-alt": T(
    "1.1.1",
    "SVG-изображению нужны role=\"img\" и title/desc или aria-label.",
    "SVG без текстовой альтернативы невидим для скринридеров. Для информативного SVG: role=\"img\" + <title>; для декоративного — aria-hidden=\"true\".",
    "<svg role=\"img\" aria-label=\"Схема процесса доставки\">…</svg>\n<!-- или для декоративных -->\n<svg aria-hidden=\"true\">…</svg>"
  ),
  "button-name": T(
    "4.1.2",
    "У кнопки нет доступного имени — добавьте текст или aria-label.",
    "Скринридер объявляет кнопку как «кнопка» без названия. Добавьте видимый текст, aria-label для иконок или aria-labelledby на связанный текст.",
    "<!-- иконка-кнопка -->\n<button aria-label=\"Закрыть окно\"><XIcon /></button>"
  ),
  "link-name": T(
    "4.1.2",
    "Ссылка без текста — добавьте содержимое или aria-label.",
    "Ссылка, которая читается как «ссылка», бесполезна. Дайте ей текст («Подробнее о тарифах») или aria-label; для иконок-ссылок — скрытый текст.",
    "<a href=\"/docs\" aria-label=\"Документация API\"><BookIcon /></a>"
  ),
  label: T(
    "3.3.2",
    "У поля формы нет <label> — свяжите подпись через for/id или aria-label.",
    "Каждое поле ввода должно иметь подпись, связанную программно: <label for=\"email\">Email</label>. Placeholder не заменяет label — он исчезает при вводе. Для полей без видимой подписи используйте aria-label.",
    "<label for=\"email\">Email</label>\n<input id=\"email\" type=\"email\" autocomplete=\"email\">"
  ),
  "select-name": T(
    "4.1.2",
    "Выпадающий список без названия — добавьте label или aria-label.",
    "Элемент <select> должен иметь программно связанную подпись, иначе пользователь не понимает, что выбирает.",
    "<label for=\"city\">Город</label>\n<select id=\"city\">…</select>"
  ),
  "autocomplete-valid": T(
    "1.3.5",
    "Добавьте корректный autocomplete для полей персональных данных.",
    "Поля имени, email, телефона и адреса должны содержать валидный атрибут autocomplete — это ускоряет заполнение и помогает людям с моторными нарушениями.",
    "<input type=\"email\" name=\"email\" autocomplete=\"email\">"
  ),
  tabindex: T(
    "2.4.3",
    "Положительный tabindex ломает порядок фокуса — уберите его.",
    "tabindex=\"1\" и больше вырывает элемент из естественного порядка Tab. Используйте DOM-порядок; для интерактивных кастомных элементов — tabindex=\"0\".",
    "<!-- было --> <div tabindex=\"3\">…</div>\n<!-- стало --> <div tabindex=\"0\" role=\"button\">…</div>"
  ),
  "focus-order-semantics": T(
    "1.3.2",
    "Элемент в порядке фокуса не интерактивен — сделайте его кнопкой/ссылкой.",
    "Элемент с tabindex попадает в Tab-порядок, но не имеет роли интерактивного элемента. Замените <div onclick> на <button> или <a href>.",
    "<!-- было --> <div class=\"card\" tabindex=\"0\" onclick=\"go()\">\n<!-- стало --> <a class=\"card\" href=\"/detail\">…</a>"
  ),
  keyboard: T(
    "2.1.1",
    "Функция недоступна с клавиатуры — добавьте обработчики keydown и фокусируемость.",
    "Всё, что работает мышью, должно работать с клавиатуры: Tab/Shift+Tab для навигации, Enter/Space для активации. Для drag-and-drop добавьте альтернативу кнопками.",
    "el.addEventListener('keydown', (e) => {\n  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }\n});"
  ),
  "interactive-supports-focus": T(
    "2.1.1",
    "Интерактивному элементу нужен tabindex=\"0\" или замена на <button>.",
    "Кликабельный элемент не получает фокус с клавиатуры. Лучшее решение — заменить на семантический <button>; иначе добавьте tabindex=\"0\" и обработку Enter/Space.",
    "<button type=\"button\" onClick={activate}>Открыть</button>"
  ),
  "scrollable-region-focusable": T(
    "2.1.1",
    "Прокручиваемая область должна получать фокус: tabindex=\"0\".",
    "Область с overflow:auto/scroll высотой больше вьюпорта недоступна для прокрутки с клавиатуры без фокуса.",
    "<div class=\"logs\" tabindex=\"0\" aria-label=\"Журнал событий\">…</div>"
  ),
  "target-size": T(
    "2.5.8",
    "Слишком маленькая цель нажатия — увеличьте до минимум 24×24 px.",
    "Интерактивные цели меньше 24×24 px сложно попасть курсором или пальцем. Увеличьте область или добавьте padding, сохранив визуальный размер.",
    "button { padding: 8px; } /* визуальная иконка 16px, цель 32px */"
  ),
  "html-has-lang": T(
    "3.1.1",
    "Добавьте lang на <html> — скринридер выбирает язык озвучки.",
    "Без lang скринридер читает русский текст английским голосом. Для русскоязычного сайта — lang=\"ru\".",
    "<html lang=\"ru\">"
  ),
  "html-lang-valid": T(
    "3.1.1",
    "Значение lang невалидно — используйте код BCP 47, например \"ru\".",
    "Атрибут lang должен содержать корректный языковой тег: ru, en, ru-RU.",
    "<html lang=\"ru\">"
  ),
  "page-title": T(
    "2.4.2",
    "Добавьте осмысленный <title> страницы.",
    "Название страницы — первое, что объявляет скринридер при переходе. Формат: «Тема — Название сайта».",
    "<title>Тарифы — Интернет-магазин</title>"
  ),
  "meta-viewport": T(
    "1.4.4",
    "Уберите user-scalable=no / maximum-scale — запрет зума нарушает WCAG.",
    "Пользователи с низким зрением должны иметь возможность увеличить страницу до 200%. Оставьте стандартный viewport.",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
  ),
  "landmark-one-main": T(
    "1.3.6",
    "Добавьте один <main> — ориентир для быстрого перехода к контенту.",
    "Скринридеры перемещаются по ориентирам (landmarks). Оберните основной контент в <main>.",
    "<body>\n  <header>…</header>\n  <main>…контент…</main>\n  <footer>…</footer>\n</body>"
  ),
  region: T(
    "1.3.6",
    "Оберните самостоятельный блок в ориентир: <nav>, <aside>, <section aria-label>.",
    "Повторяющиеся блоки (меню, поиск) должны быть ориентирами, чтобы пользователь мог их пропускать.",
    "<nav aria-label=\"Основное меню\">…</nav>"
  ),
  bypass: T(
    "2.4.1",
    "Добавьте ссылку «Перейти к содержимому» в начало страницы.",
    "Skip-link позволяет не пролистывать меню на каждой странице. Ссылка первая в Tab-порядке и ведёт на #main.",
    "<a href=\"#main\" class=\"skip-link\">Перейти к содержимому</a>\n<main id=\"main\">…</main>"
  ),
  "heading-order": T(
    "1.3.1",
    "Скачок в уровнях заголовков — не перескакивайте уровни (h2 после h1, без h3→h5).",
    "Иерархия заголовков — это оглавление страницы для скринридера. Каждый уровень вложен в предыдущий без пропусков.",
    "<h1>Тарифы</h1>\n  <h2>Для бизнеса</h2>\n    <h3>Тариф «Оптимальный»</h3>"
  ),
  "empty-heading": T(
    "1.3.1",
    "Пустой заголовок — уберите тег или добавьте текст.",
    "Заголовок без текста сбивает навигацию по оглавлению.",
    "<h2>Отзывы клиентов</h2>"
  ),
  "aria-allowed-attr": T(
    "4.1.2",
    "ARIA-атрибут запрещён для этой роли — проверьте допустимые атрибуты роли.",
    "Например, aria-expanded недопустим на роли button без popup. Уберите атрибут или смените роль на подходящую.",
    "<!-- роль button не поддерживает aria-checked -->\n<div role=\"button\" aria-pressed=\"true\">Вкл</div>"
  ),
  "aria-required-attr": T(
    "4.1.2",
    "Роли не хватает обязательного ARIA-атрибута.",
    "У кастомных виджетов роль требует атрибутов состояния: checkbox → aria-checked, slider → aria-valuenow, tab → aria-selected.",
    "<div role=\"checkbox\" aria-checked=\"true\" tabindex=\"0\">…</div>"
  ),
  "aria-valid-attr-value": T(
    "4.1.2",
    "Значение ARIA-атрибута невалидно — обычно ссылка на несуществующий id.",
    "aria-labelledby/aria-describedby/aria-controls должны указывать на существующие id элементов.",
    "<button aria-describedby=\"hint-1\">Сохранить</button>\n<p id=\"hint-1\">Черновик сохранится автоматически</p>"
  ),
  "duplicate-id-aria": T(
    "4.1.1",
    "Дублирующийся id ломает aria-ссылки — сделайте id уникальными.",
    "aria-labelledby и label for перестают работать корректно, если id встречается дважды.",
    "<!-- уникальные id для каждого экземпляра -->\n<label for=\"email-newsletter\">…</label>"
  ),
  "nested-interactive": T(
    "4.1.2",
    "Вложенные интерактивные элементы — разделите их на siblings.",
    "Кнопка внутри ссылки (или наоборот) ломает объявление скринридера и фокус. Разнесите элементы по разным контейнерам.",
    "<div class=\"card\">\n  <h3><a href=\"…\">Название</a></h3>\n  <button>В сравнение</button>\n</div>"
  ),
  list: T(
    "1.3.1",
    "Список должен быть <ul>/<ol>/<li> — не имитируйте списки div-ами.",
    "Скринридер объявляет количество пунктов настоящего списка и позволяет быстро перемещаться по ним.",
    "<ul>\n  <li>Пункт первый</li>\n  <li>Пункт второй</li>\n</ul>"
  ),
  listitem: T(
    "1.3.1",
    "Элемент списка без родительского <ul>/<ol> — оберните его.",
    "<li> допустим только внутри списка.",
    "<ul>\n  <li>Корректный пункт</li>\n</ul>"
  ),
  "frame-title": T(
    "4.1.2",
    "У iframe нет title — опишите его содержимое.",
    "Скринридер читает title фрейма при навигации: «Видеоплеер», «Карта офиса».",
    "<iframe src=\"…\" title=\"Видеоинструкция по оплате\"></iframe>"
  ),
  "video-caption": T(
    "1.2.2",
    "Добавьте субтитры к видео.",
    "Субтитры обязательны для глухих пользователей: <track kind=\"captions\"> с файлом WebVTT.",
    "<video controls>\n  <source src=\"demo.mp4\" type=\"video/mp4\">\n  <track src=\"ru.vtt\" kind=\"captions\" srclang=\"ru\" label=\"Русские\">\n</video>"
  ),
  "meta-refresh": T(
    "2.2.1",
    "Уберите авто-обновление страницы через meta refresh.",
    "Внезапная перезагрузка сбивает скринридеры и чтение. Обновляйте данные AJAX-ом или по действию пользователя.",
    "<!-- удалить: --> <meta http-equiv=\"refresh\" content=\"30\">"
  ),
  blink: T(
    "2.2.2",
    "Уберите мигающий текст.",
    "Мерцание мешает чтению и может спровоцировать приступ у чувствительных пользователей. Используйте статичное выделение.",
    "/* вместо blink */ .attention { font-weight: 600; color: var(--warning); }"
  ),
};

const FALLBACK: Tip = {
  wcag: "4.1",
  short:
    "Проверьте описание правила по ссылке axe DevTools и примените рекомендацию к каждому найденному элементу.",
  full:
    "Это нарушение найдено движком axe-core. Откройте ссылку «Подробнее» — там описание правила и паттерн исправления от Deque. Проверьте каждый перечисленный элемент: замените разметку на семантическую, добавьте недостающие атрибуты и убедитесь, что поведение с клавиатуры не изменилось.",
};

export function tipFor(ruleId: string): Tip {
  return RULE_TIPS[ruleId] ?? FALLBACK;
}

export type EngineId = "express" | "deep" | "strict";

export const ENGINE_OPTIONS: {
  id: EngineId;
  name: string;
  description: string;
  efforts: { id: string; label: string; hint?: string }[];
  defaultEffort?: string;
}[] = [
  {
    id: "express",
    name: "Экспресс-движок",
    description: "Одна строка на нарушение — быстро и по делу",
    efforts: [
      {
        id: "low",
        label: "Кратко",
        hint: "Суть проблемы одной строкой.",
      },
      {
        id: "medium",
        label: "Развёрнуто",
        hint: "Короткий совет + причина.",
      },
    ],
    defaultEffort: "low",
  },
  {
    id: "deep",
    name: "Глубокий анализ",
    description: "Пошаговые рецепты и примеры кода",
    efforts: [
      { id: "medium", label: "Стандарт", hint: "Совет + шаги исправления." },
      {
        id: "high",
        label: "С кодом",
        hint: "Добавляет пример кода к каждому совету.",
      },
    ],
    defaultEffort: "medium",
  },
  {
    id: "strict",
    name: "Строгий аудит",
    description: "Максимальная детализация + ссылки на WCAG",
    efforts: [
      { id: "high", label: "Подробно", hint: "Всё из глубокого режима." },
      {
        id: "max",
        label: "Максимум",
        hint: "Полный разбор + чек-лист проверки.",
      },
    ],
    defaultEffort: "max",
  },
];

export interface Advice {
  short: string;
  full: string;
  wcag: string;
}

export type DetailLevel = "short" | "full";

export function buildAdvice(
  ruleId: string,
  engine: EngineId,
  detail: DetailLevel
): Advice {
  const tip = tipFor(ruleId);
  const short =
    engine === "express" && detail === "short"
      ? tip.short
      : `${tip.short} (WCAG ${tip.wcag})`;

  let full = tip.full;
  if (engine === "strict") {
    full += `\n\nЧек-лист проверки: 1) исправьте разметку по рецепту; 2) перепроверьте сканером; 3) пройдите по странице с клавиатуры; 4) проверьте объявление в скринридере. Критерий WCAG ${tip.wcag}.`;
    if (tip.code) {
      full += `\n\nПример:\n${tip.code}`;
    }
  } else if (engine === "deep" && tip.code && detail === "full") {
    full += `\n\nПример:\n${tip.code}`;
  }

  return { short, full, wcag: tip.wcag };
}

export function categoryOf(ruleId: string): Category {
  if (ruleId === "color-contrast" || ruleId === "link-in-text-block") {
    return "contrast";
  }
  if (
    ruleId.includes("alt") ||
    ruleId === "frame-title" ||
    ruleId === "image-redundant-alt"
  ) {
    return "alt";
  }
  if (
    [
      "keyboard",
      "tabindex",
      "focus-order-semantics",
      "interactive-supports-focus",
      "focusable-content",
      "scrollable-region-focusable",
      "target-size",
      "bypass",
    ].includes(ruleId)
  ) {
    return "keyboard";
  }
  if (
    [
      "label",
      "select-name",
      "autocomplete-valid",
      "button-name",
      "link-name",
      "aria-input-field-name",
      "aria-toggle-field-name",
    ].includes(ruleId)
  ) {
    return "forms";
  }
  if (
    ruleId.startsWith("aria-") ||
    [
      "landmark-one-main",
      "region",
      "heading-order",
      "empty-heading",
      "list",
      "listitem",
      "definition-list",
      "dlitem",
      "nested-interactive",
      "duplicate-id-aria",
      "html-has-lang",
      "html-lang-valid",
      "page-title",
      "landmark-unique",
      "landmark-no-duplicate-banner",
      "landmark-no-duplicate-contentinfo",
    ].includes(ruleId)
  ) {
    return "aria";
  }
  return "other";
}
