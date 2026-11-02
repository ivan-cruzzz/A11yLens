import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../src/engine";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("пропускает promise, выполненный вовремя", async () => {
    await expect(
      withTimeout(Promise.resolve("ok"), 1000, "таймаут")
    ).resolves.toBe("ok");
  });

  it("прокидывает ошибку исходного promise", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("источник")), 1000, "таймаут")
    ).rejects.toThrow("источник");
  });

  it("отклоняет зависший promise по таймауту с нужным сообщением", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      new Promise<string>(() => {}),
      50,
      "Анализ не уложился в срок"
    );
    const assertion = expect(pending).rejects.toThrow(
      "Анализ не уложился в срок"
    );
    vi.advanceTimersByTime(51);
    await assertion;
  });

  it("не убивает promise, который укладывается в срок", async () => {
    vi.useFakeTimers();
    const slow = withTimeout(
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("late"), 30)
      ),
      100,
      "таймаут"
    );
    const assertion = expect(slow).resolves.toBe("late");
    vi.advanceTimersByTime(31);
    await assertion;
  });
});
