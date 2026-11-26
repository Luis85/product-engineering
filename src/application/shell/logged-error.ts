const loggedError = Symbol("LoggedError");

export type LoggedError = {
  readonly [loggedError]: true;
  readonly name: string;
  readonly message: string;
  readonly frames: readonly string[];
};

function frameParts(line: string): readonly [string, string] | undefined {
  const v8 = /^at (?:(.*?) \((.*)\)|(.*))$/.exec(line);
  if (v8) return [v8[1] ?? "", v8[2] ?? v8[3] ?? ""];
  const web = /^([^@]*)@(.*)$/.exec(line);
  if (web) return [web[1] ?? "", web[2] ?? ""];
}

function stackFrame(line: string): string | undefined {
  const parts = frameParts(line.trim());
  if (!parts) return;
  const [fn, path] = parts;
  const location = /(?:^|[\\/])([\w.$-]+:\d+:\d+)$/.exec(path)?.[1];
  if (!location) return;
  return /^[\w.$<>-]+$/.test(fn) ? fn + " " + location : location;
}

function errorFrames(error: Error): string[] {
  const stack = error.stack ?? "";
  const header = error.message ? error.name + ": " + error.message : error.name;
  const frames = stack.startsWith(header) ? stack.slice(header.length) : stack;

  return frames
    .split(/\r?\n/)
    .map(stackFrame)
    .filter((frame) => frame !== undefined)
    .slice(0, 10);
}

function rawMessage(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "";
  }
}

export function toLoggedError(cause: unknown): LoggedError {
  if (!(cause instanceof Error)) {
    return { [loggedError]: true, name: "NonError", message: rawMessage(cause), frames: [] };
  }

  return {
    [loggedError]: true,
    name: /^[A-Za-z_$][\w$]{0,63}$/.test(cause.name) ? cause.name : "Error",
    message: cause.message,
    frames: errorFrames(cause),
  };
}
