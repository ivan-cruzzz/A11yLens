"""
Генерирует презентацию A11yLens (16:9, тёмная тема) → docs/A11yLens-presentation.pptx
Запуск: python scripts/presentation.py
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from PIL import Image

BG = RGBColor(0x0A, 0x0A, 0x0A)
TEXT = RGBColor(0xFA, 0xFA, 0xFA)
MUTED = RGBColor(0xA1, 0xA1, 0xAA)
LINE = RGBColor(0x26, 0x26, 0x26)
CARD = RGBColor(0x14, 0x14, 0x14)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
SHOTS = "docs/screenshots"

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H
BLANK = prs.slide_layouts[6]


def slide():
    s = prs.slides.add_slide(BLANK)
    fill = s.background.fill
    fill.solid()
    fill.fore_color.rgb = BG
    return s


def text(s, x, y, w, h, content, size=18, color=TEXT, bold=False,
         align=PP_ALIGN.LEFT, font="Segoe UI", line_spacing=1.15):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    lines = content if isinstance(content, list) else [content]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        if isinstance(line, tuple):
            body, body_size, body_color, body_bold = line
        else:
            body, body_size, body_color, body_bold = line, size, color, bold
        run = p.add_run()
        run.text = body
        run.font.size = Pt(body_size)
        run.font.color.rgb = body_color
        run.font.bold = body_bold
        run.font.name = font
    return box


def bullets(s, x, y, w, h, items, size=16):
    lines = []
    for item in items:
        if isinstance(item, tuple):
            lines.append(("•  " + item[0], size, TEXT, True))
            lines.append(("    " + item[1], size - 3, MUTED, False))
        else:
            lines.append(("•  " + item, size, TEXT, False))
    return text(s, x, y, w, h, lines, line_spacing=1.2)


def picture_fit(s, path, x, y, max_w, max_h, border=True):
    """Вписывает картинку в прямоугольник, центрирует."""
    with Image.open(path) as img:
        ratio = img.width / img.height
    w = max_w
    h = Emu(int(w / ratio)) if False else int(w / ratio)
    from pptx.util import Emu as _Emu
    h = _Emu(int(max_w / ratio))
    if h > max_h:
        h = max_h
        w = _Emu(int(max_h * ratio))
    left = x + _Emu(int((max_w - w) / 2))
    top = y + _Emu(int((max_h - h) / 2))
    pic = s.shapes.add_picture(path, left, top, width=w, height=h)
    if border:
        pic.line.color.rgb = LINE
        pic.line.width = Pt(1)
    return pic


def rule(s, x, y, w):
    shape = s.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Pt(1.2))
    shape.fill.solid()
    shape.fill.fore_color.rgb = LINE
    shape.line.fill.background()
    return shape


# ── 1. Титул ────────────────────────────────────────────────────────────────
s = slide()
text(s, 1.0, 1.7, 11.3, 1.6, "A11yLens", 66, TEXT, True)
text(s, 1.0, 3.1, 11.3, 1.0,
     "Доступность WCAG 2.2 и кибербезопасность сайта — за одну минуту",
     24, MUTED)
rule(s, 1.0, 4.2, 3.0)
text(s, 1.0, 4.5, 11.3, 0.6,
     ["Playwright · axe-core · Next.js · один наглядный отчёт"],
     16, MUTED)
picture_fit(s, f"{SHOTS}/report-overview.png", 1.0, 5.3, 11.3, 2.0, border=False)

# ── 2. Проблема → решение ───────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.5, 11.7, 0.8, "Зачем", 34, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
bullets(s, 0.8, 1.8, 5.6, 4.8, [
    ("Доступность проверяют вручную", "Аудит WCAG у специалистов — долго и дорого, а простая автоматика смотрит только HTML."),
    ("Security-гигиена разрозненна", "Заголовки, куки и утечки версий никто не связывает с UI-качеством."),
    ("Отчёты неудобные", "Сырые дампы правил вместо понятного экрана для заказчика."),
], 18)
bullets(s, 7.0, 1.8, 5.5, 4.8, [
    ("Один скан — два измерения", "Оценка доступности 0–100 и балл безопасности из одной загрузки страницы."),
    ("Настоящий браузер", "Playwright рендерит страницу как пользователь и фотографирует проблемные элементы."),
    ("Отчёт, который можно показать", "Bento-панель, вкладки, PDF, JSON/CSV, бейдж для README."),
], 18)

# ── 3. Отчёт ────────────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.45, 11.7, 0.8, "Отчёт: два счётчика на одном экране", 30, TEXT, True)
rule(s, 0.8, 1.25, 2.2)
picture_fit(s, f"{SHOTS}/report-overview.png", 0.8, 1.55, 11.7, 5.6)

# ── 4. Доступность ──────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.5, 11.7, 0.8, "Доступность: WCAG 2.2 под капотом", 30, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
bullets(s, 0.8, 1.8, 5.9, 5.2, [
    ("60+ правил axe-core", "WCAG AA / AAA / Section 508, десктоп и мобильные вьюпорты."),
    ("Оценка 0–100", "Веса по критичности: critical −12, serious −8, moderate −4, minor −2."),
    ("Скриншоты нарушений", "Каждый проблемный элемент — со снимком и лайтбоксом."),
    ("Diff и мониторинг", "Что исправилось с прошлого скана, watchlist с ↑/↓."),
    ("Экспорт", "PDF для клиента + JSON/CSV для CI."),
], 17)
picture_fit(s, f"{SHOTS}/scanner-start.png", 6.9, 1.7, 5.6, 5.3)

# ── 5. Безопасность ─────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.45, 11.7, 0.8, "Безопасность: 19 пассивных проверок", 30, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
bullets(s, 0.8, 1.75, 5.9, 5.3, [
    ("Заголовки", "CSP, HSTS, clickjacking, nosniff, Referrer-Policy, Permissions-Policy, COOP."),
    ("Cookies", "Secure, HttpOnly, SameSite."),
    ("Контент", "Mixed content и SRI у внешних скриптов."),
    ("Утечки", "X-Powered-By, meta generator, устаревший jQuery (< 3.5 — CVE)."),
    ("Инфраструктура", "HTTP→HTTPS редирект, пробы /.git, /.env, phpinfo, .bak."),
    ("Балл 0–100", "−20/−10/−5 по критичности, каждая находка — с рецептом."),
], 16)
picture_fit(s, f"{SHOTS}/report-security.png", 6.9, 1.7, 5.6, 5.3)

# ── 6. Продукт ──────────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.5, 11.7, 0.8, "Продукт, а не демо", 30, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
bullets(s, 0.8, 1.8, 5.9, 5.2, [
    ("Аккаунт и подписки", "Регистрация с процедурным аватаром, тарифы Free/Pro/Business с лимитами."),
    ("Command palette ⌘K", "Все действия с клавиатуры."),
    ("ИИ-помощник", "Разбор отчёта в чате (rule-based демо, без API)."),
    ("История и статистика", "Спарклайны оценок, активность за 14 дней."),
    ("Гайд по WCAG", "Интерактивный чеклист 18 правил с прогрессом."),
    ("RU / EN", "Переключатель языка в шапке."),
], 17)
picture_fit(s, f"{SHOTS}/pricing.png", 6.9, 1.7, 5.6, 5.3)

# ── 7. Архитектура ──────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.5, 11.7, 0.8, "Как это устроено", 30, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
flow = [
    ("Браузер", "Next.js 16 · React 19 · Tailwind 4 · motion"),
    ("API /api/scan", "Playwright + headless Chromium"),
    ("Движки", "axe-core · аудит заголовков, кук, проб"),
    ("Отчёт", "bento-панель · вкладки · PDF/JSON/CSV"),
]
y = 1.9
for i, (title, sub) in enumerate(flow):
    box = s.shapes.add_shape(5, Inches(1.0), Inches(y), Inches(11.3), Inches(1.05))
    box.fill.solid()
    box.fill.fore_color.rgb = CARD
    box.line.color.rgb = LINE
    tf = box.text_frame
    tf.margin_left = Inches(0.3)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    r1 = p.add_run(); r1.text = title + "   "
    r1.font.size = Pt(19); r1.font.bold = True; r1.font.color.rgb = TEXT
    r2 = p.add_run(); r2.text = sub
    r2.font.size = Pt(14); r2.font.color.rgb = MUTED
    y += 1.32
text(s, 1.0, 7.05, 11.3, 0.4,
     "Storage: localStorage — аккаунт, план, история, watchlist. Сервер stateless, без БД.",
     13, MUTED)

# ── 8. Быстрый старт ────────────────────────────────────────────────────────
s = slide()
text(s, 0.8, 0.5, 11.7, 0.8, "Быстрый старт", 30, TEXT, True)
rule(s, 0.8, 1.35, 2.2)
code_bg = s.shapes.add_shape(5, Inches(0.8), Inches(1.8), Inches(11.7), Inches(2.3))
code_bg.fill.solid(); code_bg.fill.fore_color.rgb = CARD; code_bg.line.color.rgb = LINE
tf = code_bg.text_frame
tf.margin_left = Inches(0.35); tf.margin_top = Inches(0.25)
for i, cmd in enumerate([
    "git clone https://github.com/ivan-cruzzz/A11yLens.git",
    "cd A11yLens && npm install",
    "npx playwright install chromium",
    "npm run dev   # → http://localhost:3000",
]):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    r = p.add_run(); r.text = "$ " + cmd
    r.font.name = "Consolas"; r.font.size = Pt(18); r.font.color.rgb = TEXT
text(s, 0.8, 4.5, 11.7, 1.6, [
    "Node.js 18.18+ · первый скан ~30 секунд",
    "Скриншоты для README: node scripts/screenshot.mjs",
], 16, MUTED)

# ── 9. Финал ────────────────────────────────────────────────────────────────
s = slide()
text(s, 1.0, 2.4, 11.3, 1.2, "A11yLens", 54, TEXT, True)
text(s, 1.0, 3.6, 11.3, 0.8,
     "Проверьте свой сайт — отчёт готов через полминуты", 22, MUTED)
rule(s, 1.0, 4.7, 3.0)
text(s, 1.0, 5.0, 11.3, 0.8, "github.com/ivan-cruzzz/A11yLens", 24, TEXT, True)
text(s, 1.0, 5.8, 11.3, 0.6,
     "MIT License · Next.js · Playwright · axe-core", 15, MUTED)

out = "docs/A11yLens-presentation.pptx"
prs.save(out)
print("OK:", out, "-", len(prs.slides._sldIdLst), "slides")
