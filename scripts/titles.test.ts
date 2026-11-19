import { expect, test } from "bun:test";
import { AXES, THRESHOLDS, compact, rank, titleFor } from "../shared/titles";

test("every axis has the same number of rising tiers", () => {
  for (const a of AXES) {
    expect(THRESHOLDS[a].length).toBe(8);
    expect([...THRESHOLDS[a]].sort((x, y) => x - y)).toEqual([...THRESHOLDS[a]]);
  }
});

test("rank finds the tier and the way to the next", () => {
  expect(rank("deploys", 0)).toMatchObject({ tier: 0, next: 1, progress: 0 });
  expect(rank("deploys", 5)).toMatchObject({ tier: 2, next: 20, progress: 0 });
  expect(rank("tokens", 3e7).progress).toBeCloseTo(0.5);
  expect(rank("limits", 1e9)).toMatchObject({ tier: 7, next: null, progress: 1 });
  expect(rank("tokens", Number.NaN).tier).toBe(0);
});

test("the headline title comes from the strongest axis, ties to the earlier one", () => {
  const t = titleFor({ tokens: 2e8, messages: 30, deploys: 5, limits: 0 });
  expect(t.title).toBe("Adept Tokensmith");
  expect(titleFor({ tokens: 2e6, messages: 30, deploys: 1, limits: 0 }).title).toBe("Apprentice Tokensmith");
  expect(titleFor({ tokens: 0, messages: 0, deploys: 0, limits: 0 }, "pt").title).toBe("Forjador de tokens Neófito");
  expect(titleFor({ tokens: 0, messages: 0, deploys: 80, limits: 0 }, "pt").title).toBe("Lançador Adepto");
});

test("compact numbers", () => {
  expect(compact(999)).toBe("999");
  expect(compact(1500)).toBe("1.5k");
  expect(compact(2_000_000)).toBe("2M");
  expect(compact(123_456_789)).toBe("123M");
});
