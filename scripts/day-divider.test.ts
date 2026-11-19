import { expect, test } from "bun:test";
import { dayLabel, newDay } from "../web/features/chat/model";
const t = (s: string) => s;
const at = (iso: string) =>
  ({
    id: 1,
    thread: "main",
    author: "a@test.com",
    text: "",
    ts: new Date(iso).getTime(),
  }) as never;
test("a day divider starts each local day; today/yesterday by name", () => {
  expect(newDay(undefined, at("2026-11-19T10:00:00"))).toBe(true);
  expect(newDay(at("2026-11-19T08:00:00"), at("2026-11-19T23:59:00"))).toBe(
    false,
  );
  expect(newDay(at("2026-11-18T23:59:00"), at("2026-11-19T00:01:00"))).toBe(
    true,
  );
  const now = new Date("2026-11-19T12:00:00").getTime();
  expect(
    dayLabel(new Date("2026-11-19T09:00:00").getTime(), now, "pt-BR", t),
  ).toBe("Hoje");
  expect(
    dayLabel(new Date("2026-11-18T09:00:00").getTime(), now, "pt-BR", t),
  ).toBe("Ontem");
  expect(
    dayLabel(new Date("2026-11-16T09:00:00").getTime(), now, "pt-BR", t),
  ).toContain("16");
  expect(
    dayLabel(new Date("2025-11-16T09:00:00").getTime(), now, "pt-BR", t),
  ).toContain("2025");
});
