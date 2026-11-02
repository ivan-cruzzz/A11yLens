/**
 * Окно работает с глобальным Tauri API (app.withGlobalTauri: true в
 * tauri.conf.json) — фронт не тянет npm-пакет @tauri-apps/api.
 * Команды реализованы в src-tauri/src/lib.rs.
 */

export interface AppState {
  ethicsAccepted: boolean;
  chromiumConsent: boolean;
  theme: "dark" | "light";
}

export interface EngineRun {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BrowserStatus {
  installed: boolean;
  browsersDir: string;
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core: { invoke: Invoke };
    };
  }
}

export const invoke: Invoke = (cmd, args) => {
  const api = window.__TAURI__;
  if (!api) {
    return Promise.reject(
      new Error("Tauri API недоступен: окно запущено вне Tauri (сборка/запуск через npm run tauri)")
    );
  }
  return api.core.invoke(cmd, args);
};
