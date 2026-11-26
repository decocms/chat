// The zoom of the full-screen image viewer (Gimenes #5961).
import { expect, test } from "bun:test";
import {
  fitScale,
  fitted,
  isFitted,
  pan,
  toggle,
  zoomLabel,
  zoomTo,
} from "../web/features/file-viewer/zoom";

test("fit shows the whole image, never bigger than its own size", () => {
  expect(
    fitScale({ width: 1000, height: 500 }, { width: 2000, height: 500 }),
  ).toBe(0.5);
  expect(
    fitScale({ width: 1000, height: 800 }, { width: 200, height: 100 }),
  ).toBe(1);
  expect(fitScale({ width: 0, height: 0 }, { width: 200, height: 100 })).toBe(
    1,
  );
});

test("a click zooms to the image's own size at the click, a second click fits again", () => {
  const start = fitted(0.5);
  const zoomed = toggle(start, 100, 0);
  expect(zoomed.scale).toBe(1);
  expect(zoomed.x).toBe(100 - 100 * 2); // the point under the cursor stays still
  expect(zoomLabel(zoomed)).toBe("100%");
  expect(isFitted(toggle(zoomed))).toBe(true);
  expect(zoomLabel(start)).toBe(null);
});

test("a small image zooms to 2× its fit", () => {
  expect(toggle(fitted(1)).scale).toBe(2);
});

test("zoom stops at fit and at 8×, and a fitted image does not pan", () => {
  const start = fitted(0.5);
  expect(isFitted(zoomTo(start, 0.1))).toBe(true);
  expect(zoomTo(start, 100).scale).toBe(8);
  expect(pan(start, 40, 40)).toEqual(start);
  expect(pan(zoomTo(start, 2), 40, -10)).toMatchObject({ x: 40, y: -10 });
});
