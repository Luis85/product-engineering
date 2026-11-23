import { execFile } from "node:child_process";
import { ArtifactGitError } from "../../application/git";

export type GitCommand = ReturnType<typeof gitCommand>;

export function gitCommand(binary: string, cwd: string, env: NodeJS.ProcessEnv) {
  return (
    args: readonly string[],
    options: {
      readonly absent?: readonly number[];
      readonly input?: Uint8Array | string;
      readonly index?: string;
      readonly reason?: ArtifactGitError["reason"];
    } = {},
  ) =>
    new Promise<Buffer>((resolve, reject) => {
      const child = execFile(
        binary,
        [
          "--literal-pathspecs",
          "-c",
          "core.hooksPath=/dev/null",
          "-c",
          "core.fsmonitor=false",
          ...args,
        ],
        {
          cwd,
          env: {
            ...env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_NO_LAZY_FETCH: "1",
            GIT_NO_REPLACE_OBJECTS: "1",
            GIT_INDEX_FILE: options.index,
          },
          encoding: "buffer",
          windowsHide: true,
          maxBuffer: 32 * 1024 * 1024,
          timeout: 30_000,
        },
        (error, stdout) => {
          if (!error) resolve(stdout);
          else if (typeof error.code === "number" && options.absent?.includes(error.code))
            resolve(Buffer.alloc(0));
          else
            reject(
              new ArtifactGitError({
                reason: error.code === "ENOENT" ? "unavailable" : (options.reason ?? "git"),
              }),
            );
        },
      );
      if (options.input !== undefined) {
        child.stdin?.on("error", () => undefined);
        child.stdin?.end(options.input);
      }
    });
}
