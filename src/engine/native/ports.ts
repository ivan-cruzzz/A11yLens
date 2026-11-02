/**
 * Лёгкий скан топ-100 TCP-портов через node:net: все порты параллельно,
 * таймаут 1 с на порт, общий бюджет 30 с. Только установка соединения —
 * без нагрузочных проб и брутфорса.
 */

import net from "node:net";
import type { NativeFinding, } from "./types";
import type { SecuritySeverity } from "../types";

export const DEFAULT_PORT_TIMEOUT_MS = 1000;
export const TOTAL_BUDGET_MS = 30_000;

/** Топ-100 TCP-портов (по данным nmap top ports). */
export const TOP_PORTS: readonly number[] = [
  20, 21, 22, 23, 25, 53, 79, 80, 81, 88,
  109, 110, 111, 113, 119, 135, 137, 138, 139, 143,
  161, 179, 389, 427, 443, 445, 465, 512, 513, 514,
  515, 543, 548, 554, 587, 631, 636, 646, 873, 990,
  993, 995, 1025, 1080, 1433, 1521, 1723, 1883, 2000, 2049,
  2082, 2083, 2086, 2087, 2095, 2096, 2121, 2181, 2222, 2375,
  2376, 2525, 3000, 3001, 3128, 3268, 3306, 3389, 3690, 4444,
  5000, 5001, 5060, 5222, 5432, 5555, 5672, 5800, 5900, 5901,
  5984, 5985, 6379, 6443, 6667, 8000, 8009, 8080, 8081, 8443,
  8888, 9090, 9092, 9100, 9200, 9300, 10000, 11211, 15672, 27017,
];

export interface PortInfo {
  name: string;
  severity: SecuritySeverity;
  recommendation: string;
}

/**
 * Опасные/заметные порты: для них — отдельная находка с критичностью.
 * Порты вне реестра (обычные 80/443 и т.п.) попадают в info-сводку.
 */
export const PORT_INFO: Readonly<Record<number, PortInfo>> = {
  21: { name: "FTP", severity: "high", recommendation: "Закройте FTP наружу (21/tcp) — пароли идут открытым текстом; используйте SFTP по 22-му." },
  23: { name: "Telnet", severity: "high", recommendation: "Отключите Telnet (23/tcp) — протокол без шифрования, перехват учётных данных тривиален; замените на SSH." },
  25: { name: "SMTP", severity: "medium", recommendation: "Если почтовый сервер не нужен на этом хосте — закройте 25/tcp; открытый SMTP часто попадает в спам-рассылки." },
  53: { name: "DNS", severity: "low", recommendation: "DNS (53/tcp) наружу нужен только публичным резолверам; иначе закройте — открытый резолвер используют для DNS-усиления." },
  79: { name: "Finger", severity: "low", recommendation: "Закройте 79/tcp — протокол раскрывает списки пользователей, деградировавший атавизм." },
  110: { name: "POP3", severity: "medium", recommendation: "Замените POP3 (110/tcp) на POP3S (995) — открытый вариант передаёт пароли без шифрования." },
  111: { name: "RPCBind", severity: "medium", recommendation: "Закройте RPCBind (111/tcp) наружу — используется для разведки и усиления DDoS." },
  135: { name: "MS RPC", severity: "high", recommendation: "Закройте MS RPC (135/tcp) на границе сети — классический путь для эксплуатации Windows-сервисов." },
  137: { name: "NetBIOS Name", severity: "high", recommendation: "Закройте NetBIOS (137-139/tcp) наружу — раскрывает имена машин и шар, исторический вектор атак." },
  138: { name: "NetBIOS Datagram", severity: "high", recommendation: "Закройте NetBIOS (137-139/tcp) наружу — раскрывает имена машин и шар." },
  139: { name: "NetBIOS Session", severity: "high", recommendation: "Закройте NetBIOS (137-139/tcp) наружу — раскрывает общие ресурсы Windows." },
  161: { name: "SNMP", severity: "medium", recommendation: "Ограничьте SNMP (161/tcp) списком адресов и смените community-строку с public." },
  389: { name: "LDAP", severity: "low", recommendation: "Открывайте LDAP (389/tcp) только тем, кому нужен; наружу — лишь LDAPS (636)." },
  445: { name: "SMB", severity: "high", recommendation: "Закройте SMB (445/tcp) наружу — через него идут WannaCry-класс атаки и доступ к общим папкам." },
  512: { name: "rexec", severity: "high", recommendation: "Отключите rexec/rlogin/rsh (512-514/tcp) — протоколы без шифрования и с доверенной аутентификацией по хосту." },
  513: { name: "rlogin", severity: "high", recommendation: "Отключите rlogin (513/tcp) — без шифрования, аутентификация по доверенным хостам." },
  514: { name: "rsh/syslog", severity: "high", recommendation: "Проверьте, что на 514/tcp не торчит rsh; syslog наружу не отдавайте." },
  873: { name: "rsync", severity: "medium", recommendation: "Закройте rsync (873/tcp) наружу или включите аутентификацию — часто торчит без пароля." },
  1433: { name: "MS SQL", severity: "high", recommendation: "База данных (1433/tcp) не должна быть доступна из интернета — ограничьте фаерволом или VPN." },
  1521: { name: "Oracle DB", severity: "medium", recommendation: "Ограничьте доступ к Oracle (1521/tcp) внутренней сетью." },
  1723: { name: "PPTP VPN", severity: "low", recommendation: "PPTP (1723/tcp) криптографически сломан — перейдите на WireGuard/OpenVPN." },
  1883: { name: "MQTT", severity: "low", recommendation: "MQTT (1883/tcp) без TLS — включите 8883 или закройте наружу." },
  2049: { name: "NFS", severity: "high", recommendation: "NFS (2049/tcp) наружу не отдают никогда — ограничьте внутренней сетью." },
  2181: { name: "ZooKeeper", severity: "medium", recommendation: "ZooKeeper (2181/tcp) обычно работает без аутентификации — закройте наружу." },
  2375: { name: "Docker API", severity: "high", recommendation: "Docker API без TLS (2375/tcp) даёт полный контроль над хостом — немедленно закройте наружу." },
  2376: { name: "Docker API TLS", severity: "medium", recommendation: "Docker API (2376/tcp) наружу не нужен — доступ только с управляющих хостов." },
  3000: { name: "Dev-сервер", severity: "low", recommendation: "Dev-сервер (3000/tcp) на продакшене — уберите или закройте фаерволом." },
  3128: { name: "Squid Proxy", severity: "low", recommendation: "Открытый прокси (3128/tcp) злоупотребляют для анонимизации — ограничьте ACL." },
  3306: { name: "MySQL", severity: "high", recommendation: "MySQL (3306/tcp) из интернета доступен не должен быть — фаервол/VPN, и проверьте, что root не без пароля." },
  3389: { name: "RDP", severity: "high", recommendation: "RDP (3389/tcp) наружу — главный вход для брутфорса; закройте фаерволом, используйте VPN или шлюз удалённых рабочих столов." },
  3690: { name: "SVN", severity: "low", recommendation: "Доступ к SVN (3690/tcp) наружу — закройте, репозиторий может утечь." },
  4444: { name: "Metasploit default", severity: "high", recommendation: "Порт 4444 — дефолт обработчика Metasploit; проверьте, что это легитимный сервис, и закройте наружу." },
  5000: { name: "UPnP/Flask", severity: "low", recommendation: "Проверьте, что на 5000/tcp не отдаётся отладочный сервер наружу." },
  5060: { name: "SIP", severity: "low", recommendation: "SIP (5060/tcp) без TLS брутфорсят ради телефонии — ограничьте доступ." },
  5222: { name: "XMPP", severity: "low", recommendation: "XMPP (5222/tcp) — если чат не нужен, закройте." },
  5432: { name: "PostgreSQL", severity: "high", recommendation: "PostgreSQL (5432/tcp) из интернета не отдают — фаервол/VPN и надёжные пароли." },
  5555: { name: "ADB", severity: "high", recommendation: "Android Debug Bridge (5555/tcp) на сервере — полный контроль над устройством/контейнером; немедленно закройте." },
  5672: { name: "RabbitMQ", severity: "medium", recommendation: "RabbitMQ AMQP (5672/tcp) наружу не отдают — только внутренней сети, guest-учётку удалите." },
  5800: { name: "VNC HTTP", severity: "medium", recommendation: "Веб-доступ VNC (5800/tcp) наружу закройте." },
  5900: { name: "VNC", severity: "high", recommendation: "VNC (5900/tcp) без VPN не отдают — часто без шифрования и с короткими паролями." },
  5901: { name: "VNC", severity: "high", recommendation: "VNC (5901/tcp) наружу закройте — используйте SSH-туннель." },
  5984: { name: "CouchDB", severity: "medium", recommendation: "CouchDB (5984/tcp) без аутентификации отдаёт все базы — закройте наружу." },
  5985: { name: "WinRM", severity: "medium", recommendation: "WinRM HTTP (5985/tcp) наружу закройте — удалённое выполнение команд на Windows." },
  6379: { name: "Redis", severity: "high", recommendation: "Redis (6379/tcp) без пароля из интернета — известный путь к RCE (запись в cron/ssh); bind + requirepass + фаервол." },
  6443: { name: "Kubernetes API", severity: "medium", recommendation: "Kubernetes API (6443/tcp) наружу — ограничьте списком IP, включите RBAC и аудит." },
  6667: { name: "IRC", severity: "low", recommendation: "IRC (6667/tcp) на продакшене обычно не нужен — закройте." },
  8009: { name: "AJP", severity: "medium", recommendation: "AJP (8009/tcp, Ghostcat) наружу не отдают — Tomcat должен слушать AJP только локально." },
  9090: { name: "Prometheus", severity: "medium", recommendation: "Prometheus (9090/tcp) раскрывает метрики инфраструктуры — закройте basic-auth/фаерволом." },
  9092: { name: "Kafka", severity: "medium", recommendation: "Kafka (9092/tcp) наружу не отдают без SASL/TLS — только внутренней сети." },
  9100: { name: "Printer", severity: "low", recommendation: "Raw-печать (9100/tcp) — закройте наружу, принтеры частый плацдарм." },
  9200: { name: "Elasticsearch", severity: "high", recommendation: "Elasticsearch (9200/tcp) из интернета отдаёт все индексы — включите аутентификацию и фаервол." },
  9300: { name: "ES Cluster", severity: "medium", recommendation: "Кластерный порт Elasticsearch (9300/tcp) наружу закройте." },
  10000: { name: "Webmin", severity: "medium", recommendation: "Webmin (10000/tcp) наружу — ограничьте IP и обновите: старые версии с RCE." },
  11211: { name: "Memcached", severity: "high", recommendation: "Memcached (11211/tcp) без аутентификации — используют для DDoS-усиления и чтения данных; закройте наружу." },
  15672: { name: "RabbitMQ UI", severity: "medium", recommendation: "Веб-панель RabbitMQ (15672/tcp) наружу — закройте или закройте basic-auth." },
  27017: { name: "MongoDB", severity: "high", recommendation: "MongoDB (27017/tcp) без аутентификации из интернета — базы утекают пачками; включите auth и фаервол." },
};

export interface PortScanOptions {
  timeoutMsPerPort?: number;
  totalBudgetMs?: number;
  ports?: readonly number[];
}

export type PortProbeFn = (
  host: string,
  port: number,
  timeoutMs: number
) => Promise<boolean>;

export interface PortScanDeps {
  probe?: PortProbeFn;
  now?: () => number;
}

export interface PortScanResult {
  openPorts: number[];
  findings: NativeFinding[];
  probedCount: number;
  /** Порты, которые не успели проверить в рамках бюджета. */
  uncheckedPorts: number;
}

const finding = (
  id: string,
  title: string,
  severity: NativeFinding["severity"],
  detail: string,
  evidence: string,
  recommendation: string
): NativeFinding => ({ id, title, severity, detail, evidence, recommendation });

const portLabel = (port: number): string => {
  const info = PORT_INFO[port];
  return info ? `${port} (${info.name})` : String(port);
};

/**
 * Все порты стартуют параллельно; каждая проба ограничена и своим
 * таймаутом, и общим бюджетом скана.
 */
export async function scanPorts(
  host: string,
  options: PortScanOptions = {},
  deps: PortScanDeps = {}
): Promise<PortScanResult> {
  const probe = deps.probe ?? probePort;
  const now = deps.now ?? Date.now;
  const ports = options.ports ?? TOP_PORTS;
  const perPort = options.timeoutMsPerPort ?? DEFAULT_PORT_TIMEOUT_MS;
  const budget = options.totalBudgetMs ?? TOTAL_BUDGET_MS;
  const startedAt = now();

  const outcomes = await Promise.all(
    ports.map(async (port): Promise<boolean | null> => {
      const left = budget - (now() - startedAt);
      if (left <= 0) {
        return null; // бюджет исчерпан — порт не проверен
      }
      const slice = Math.min(perPort, left);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const guard = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), slice);
      });
      try {
        return await Promise.race([probe(host, port, slice), guard]);
      } catch {
        return null;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    })
  );

  const openPorts = ports.filter((_, index) => outcomes[index] === true);
  const uncheckedPorts = outcomes.filter((outcome) => outcome === null).length;
  const probedCount = ports.length - uncheckedPorts;

  const findings: NativeFinding[] = [];
  for (const port of openPorts) {
    const info = PORT_INFO[port];
    if (!info) {
      continue;
    }
    findings.push(
      finding(
        `nport-${port}`,
        `Открыт порт ${portLabel(port)}`,
        info.severity,
        `На ${host} отвечает порт ${portLabel(port)} — сервис доступен из интернета${info.severity === "high" ? " и известен как частый вход для атак" : ""}.`,
        `TCP-соединение до ${host}:${port} установлено`,
        info.recommendation
      )
    );
  }

  if (openPorts.length > 0) {
    findings.push(
      finding(
        "nports-open",
        `Открытые порты: ${openPorts.length} шт.`,
        "info",
        `Снаружи отвечают порты: ${openPorts.map(portLabel).join(", ")}. Каждый открытый порт — потенциальная поверхность атаки.`,
        `TCP-соединения установлены: ${openPorts.join(", ")}`,
        "Сравните список с ожидаемым: наружу нужны только 80/443 и то, что осознанно публикуется; остальное — фаервол."
      )
    );
  }

  return { openPorts, findings, probedCount, uncheckedPorts };
}

/** Реальная проба: TCP connect с таймаутом, без отправки данных. */
export function probePort(
  host: string,
  port: number,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (open: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}
