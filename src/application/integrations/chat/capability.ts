import type { AiMode, Settings } from "../../../domain/shell";

interface AiCapability {
  readonly enabled: boolean;
  readonly mode: AiMode;
  readonly executablePath: string | undefined;
}

export function aiCapability(settings: Settings): AiCapability {
  const mode = settings.aiMode ?? "demo";
  const paths = { codex: settings.codexPath, "claude-code": settings.claudeCodePath };
  return {
    enabled: settings.aiEnabled === true,
    mode,
    executablePath: mode === "demo" ? undefined : paths[mode],
  };
}

export function sameAiCapability(left: AiCapability, right: AiCapability): boolean {
  return (
    left.enabled === right.enabled &&
    left.mode === right.mode &&
    left.executablePath === right.executablePath
  );
}
