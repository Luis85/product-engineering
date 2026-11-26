import { expect, it } from "vitest";
import { blendOver, contrastRatio, relativeLuminance } from "../../support/contrast";

const black = [0, 0, 0] as const;
const white = [255, 255, 255] as const;

it("compares sRGB luminance symmetrically and distinguishes the text threshold", () => {
  expect(relativeLuminance(black)).toBe(0);
  expect(relativeLuminance(white)).toBeCloseTo(1, 8);
  expect(contrastRatio(black, white)).toBeCloseTo(21, 6);
  expect(contrastRatio(white, black)).toBeCloseTo(21, 6);
  expect(contrastRatio(black, black)).toBe(1);
  expect(contrastRatio([119, 119, 119], white)).toBeLessThan(4.5);
  expect(contrastRatio([118, 118, 118], white)).toBeGreaterThan(4.5);
});

it("composites transparent and partially transparent colors over the surrounding surface", () => {
  expect(blendOver([0, 0, 0, 0], white)).toEqual(white);
  expect(blendOver([0, 0, 0, 255], white)).toEqual(black);
  expect(blendOver([255, 0, 0, 128], black)).toEqual([128, 0, 0]);
});
