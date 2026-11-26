import type { Platform as ObsidianPlatform } from "obsidian";

export const DEFAULT_TEST_LANGUAGE = "de";
export const apiVersion = "1.15.1";

let language = DEFAULT_TEST_LANGUAGE;

export function getLanguage(): string {
  return language;
}

export function setLanguage(code: string): void {
  language = code;
}

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: process.platform === "darwin",
  isWin: process.platform === "win32",
  isLinux: process.platform === "linux",
  isSafari: false,
} satisfies Omit<typeof ObsidianPlatform, "resourcePathPrefix">;
