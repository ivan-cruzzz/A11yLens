window.STATE =
{
  "version": 2,
  "slug": "a11ylens-upgrade",
  "dir": "2026-11-02-a11ylens-upgrade--wip",
  "title": "A11yLens: качество сканера, ПК-софт и интерфейс",
  "mode": "interview",
  "depth": "deep",
  "tier": "T2",
  "briefFile": "2026-11-02-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "C:/Users/Sы/.zcode/skills/autopilot",
  "baseCommit": null,
  "startedAt": "2026-11-02T13:15:57+03:00",
  "updatedAt": "2026-11-02T13:47:17+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-02T13:15:57+03:00",
      "finishedAt": "2026-11-02T13:18:03+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-02T13:18:03+03:00",
      "finishedAt": "2026-11-02T13:19:23+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-02T13:19:23+03:00",
      "finishedAt": "2026-11-02T13:28:46+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-02T13:28:46+03:00",
      "finishedAt": "2026-11-02T13:42:20+03:00"
    },
    {
      "id": "plan",
      "status": "active",
      "startedAt": "2026-11-02T13:42:20+03:00"
    },
    {
      "id": "build",
      "status": "pending"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 10,
    "done": 0,
    "inTicket": 10,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Фундамент: движок, тесты, честные ошибки",
      "requirements": [
        "R01"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/engine/",
        "src/app/api/",
        "src/lib/",
        "tests/",
        "package.json"
      ],
      "review": "да — фундамент",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "02",
      "title": "Глубина исследования и разбор: страницы, доказательства, план исправления",
      "requirements": [
        "R02",
        "R03"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/engine/scan.ts",
        "src/engine/report.ts",
        "src/engine/advice/",
        "src/lib/knowledge.ts",
        "src/components/app/",
        "src/app/scan/",
        "tests/report/"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Нативные проверки и CLI",
      "requirements": [
        "R05",
        "G01",
        "A01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/engine/native/",
        "src/cli/",
        "tests/native/",
        "tests/cli/",
        "package.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "04",
      "title": "Нативное Windows-приложение (Tauri)",
      "requirements": [
        "R04"
      ],
      "blockedBy": [
        "03"
      ],
      "wave": 3,
      "zone": [
        "desktop/"
      ],
      "review": "нет",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "05",
      "title": "Интерфейс: темы, акцент, воздух, пустые состояния",
      "requirements": [
        "R06"
      ],
      "blockedBy": [
        "02"
      ],
      "wave": 3,
      "zone": [
        "src/app/",
        "src/components/",
        "src/lib/i18n.tsx"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "06",
      "title": "Идеи развития и финальная регрессия",
      "requirements": [
        "R07",
        "R08i",
        "R09i"
      ],
      "blockedBy": [
        "01",
        "02",
        "03",
        "04",
        "05"
      ],
      "wave": 4,
      "zone": [
        "docs/IDEAS.md",
        "README.md",
        ".autopilot/<dir>/interfaces.md"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    }
  ],
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 2,
    "fixed": 2,
    "deferred": 0,
    "items": [
      "принятые рекомендации раундов 1-2 не были записаны в бриф — дописаны в Дополнения",
      "выбор «искать слабые места, не ловить атаки» не был записан в бриф — покрыт той же записью"
    ]
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-11-02T13:15:57+03:00",
    "2026-11-02T13:18:03+03:00",
    "2026-11-02T13:19:21+03:00",
    "2026-11-02T13:19:23+03:00",
    "2026-11-02T13:21:29+03:00",
    "2026-11-02T13:24:25+03:00",
    "2026-11-02T13:25:44+03:00",
    "2026-11-02T13:27:50+03:00",
    "2026-11-02T13:28:46+03:00",
    "2026-11-02T13:42:17+03:00",
    "2026-11-02T13:42:20+03:00",
    "2026-11-02T13:46:40+03:00",
    "2026-11-02T13:46:43+03:00",
    "2026-11-02T13:46:45+03:00",
    "2026-11-02T13:47:14+03:00",
    "2026-11-02T13:47:17+03:00"
  ],
  "rev": 17,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-11-02T13:21:29+03:00",
      "to": "2026-11-02T13:24:25+03:00"
    },
    {
      "kind": "briefing",
      "from": "2026-11-02T13:25:44+03:00",
      "to": "2026-11-02T13:27:50+03:00"
    }
  ],
  "log": [
    {
      "t": "2026-11-02T13:15:57+03:00",
      "k": "init"
    },
    {
      "t": "2026-11-02T13:18:03+03:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-11-02T13:19:23+03:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-11-02T13:21:29+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "4 вопроса: смысл кибер-проверки, формат ПК-софта, ИИ или правила, референс интерфейса"
    },
    {
      "t": "2026-11-02T13:24:25+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-11-02T13:25:44+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "3 вопроса: набор проверок ПК-софта, куда идеи, платформы"
    },
    {
      "t": "2026-11-02T13:27:50+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-11-02T13:28:46+03:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 10,
      "total": 10
    },
    {
      "t": "2026-11-02T13:28:46+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-11-02T13:42:17+03:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 2,
      "fixed": 2,
      "deferred": 0
    },
    {
      "t": "2026-11-02T13:42:20+03:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-11-02T13:46:40+03:00",
      "k": "tier",
      "v": "T2"
    },
    {
      "t": "2026-11-02T13:46:43+03:00",
      "k": "tickets",
      "n": 6
    },
    {
      "t": "2026-11-02T13:46:45+03:00",
      "k": "gate",
      "g": "G3",
      "ok": false,
      "problems": 2
    },
    {
      "t": "2026-11-02T13:47:14+03:00",
      "k": "tickets",
      "n": 6
    },
    {
      "t": "2026-11-02T13:47:17+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«улучши качество скриптов»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«и исследований ошибок сайта»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«сделай более качественный разбор проблем сайта»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«сделай софт на пк для более качественной проверки на возможную кибератаку»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«и тд» (продолжение про проверку на кибератаку — смежные проверки)",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«сделай более приятный интерфейс»",
      "status": "in-ticket"
    },
    {
      "id": "R07",
      "text": "«дай новые идеи для сайта»",
      "status": "in-ticket"
    },
    {
      "id": "R08i",
      "text": "(подразумевается) текущие функции сканера не ломаются улучшениями",
      "status": "in-ticket"
    },
    {
      "id": "R09i",
      "text": "(подразумевается) идеи из R07 доносятся до пользователя (отчёт/раздел в приложении)",
      "status": "in-ticket"
    },
    {
      "id": "G01",
      "text": "«сделай возможность проверки сайта через терминал»",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": false,
      "at": "2026-11-02T13:28:46+03:00",
      "open": 10,
      "total": 10
    },
    "G2": {
      "ok": true,
      "at": "2026-11-02T13:42:17+03:00",
      "found": 2,
      "fixed": 2,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-11-02T13:47:17+03:00",
      "problems": 0
    }
  },
  "result": null
}
