import { mkdir, writeFile } from "node:fs/promises";
import { browser } from "@wdio/globals";
import { blendOver, contrastRatio } from "../support/contrast";
import type { Rgb, Rgba } from "../support/contrast";

interface ColorSample {
  readonly label: string;
  readonly foreground: readonly Rgba[];
  readonly layers: readonly Rgba[];
}

function sampleRatio({ foreground, layers }: ColorSample) {
  const white: Rgb = [255, 255, 255];
  const background = layers.toReversed().reduce((result, color) => blendOver(color, result), white);
  return Math.max(
    ...foreground.map((color) => contrastRatio(blendOver(color, background), background)),
  );
}

export async function measureAppearance(selector: string) {
  const measured = await browser.execute((root) => {
    const surface = document.querySelector<HTMLElement>(root);
    if (!surface) throw new Error("The appearance surface is missing");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas color measurement is unavailable");

    function rgba(value: string): Rgba {
      if (!context) throw new Error("Canvas context is missing");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "transparent";
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a];
    }

    function backgrounds(start: Element | null): Rgba[] {
      const colors: Rgba[] = [];
      for (let element = start; element; element = element.parentElement) {
        const color = rgba(getComputedStyle(element).backgroundColor);
        if (color[3] > 0) colors.push(color);
        if (color[3] === 255) break;
      }
      return colors;
    }

    function visible(element: Element): boolean {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 1 &&
        bounds.height > 1 &&
        element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      );
    }

    function textSample(host: Element, label: string): ColorSample {
      return {
        label,
        foreground: [rgba(getComputedStyle(host).color)],
        layers: backgrounds(host),
      };
    }

    function sampleText(content: Element) {
      const result: ColorSample[] = [];
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const label = node.textContent?.trim();
        const host = node.parentElement;
        if (!label || !host || host.closest("option, script, style") || !visible(host)) continue;
        result.push(textSample(host, label.slice(0, 100)));
      }
      return result;
    }

    const controls = Array.from(
      surface.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input:not([type='checkbox']):not([type='radio']), textarea, select",
      ),
    ).filter(visible);
    const text = [
      ...sampleText(surface),
      ...controls
        .filter((field) => field.value !== "")
        .map((field) => textSample(field, field.name + " value")),
    ];
    const fields: ColorSample[] = controls.map((field) => {
      const computed = getComputedStyle(field);
      const rings = computed.boxShadow.match(/(?:rgba?|color|oklab|oklch)\([^)]*\)/g) ?? [];
      const edges = [computed.backgroundColor, ...rings];
      if (Number.parseFloat(computed.borderTopWidth) > 0) edges.push(computed.borderTopColor);
      return {
        label: field.name,
        foreground: edges.map(rgba),
        layers: backgrounds(field.parentElement),
      };
    });
    return { text, fields };
  }, selector);

  const ratios = (samples: readonly ColorSample[]) =>
    samples.map((sample) => ({ label: sample.label, ratio: sampleRatio(sample) }));
  return { text: ratios(measured.text), fields: ratios(measured.fields) };
}

export async function saveAppearanceReport(report: unknown): Promise<void> {
  const folder = new URL("../../reports/e2e/", import.meta.url);
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL("appearance-contrast.json", folder),
    JSON.stringify(report, null, 2) + "\n",
  );
}
