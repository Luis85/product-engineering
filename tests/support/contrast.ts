export type Rgb = readonly [red: number, green: number, blue: number];
export type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

function linear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([red, green, blue]: Rgb): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrastRatio(left: Rgb, right: Rgb): number {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function blendOver([red, green, blue, alpha]: Rgba, background: Rgb): Rgb {
  const fraction = alpha / 255;
  const rest = 1 - fraction;
  return [
    red * fraction + background[0] * rest,
    green * fraction + background[1] * rest,
    blue * fraction + background[2] * rest,
  ];
}
