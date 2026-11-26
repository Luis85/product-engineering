import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { env as hostEnvironment } from "node:process";
import { ArtifactGitError, gitCommitMessage } from "../../application/git";
import type { GitHead, GitJournal } from "../../application/git";
import { gitCommand } from "./command";
import { commitFile } from "./commit";
import type { GitCommand } from "./command";
import { compareRevision, history, readBlob } from "./history";

type NativeGitOptions = {
  readonly vaultRoot: () => string;
  readonly binary?: string;
  readonly env?: NodeJS.ProcessEnv;
};

function scopedPath(root: string, file: string) {
  const path = relative(root, file);
  if (!path || isAbsolute(path) || path.split(sep).some((part) => /^\.\.$|^\.git$/i.test(part))) {
    throw new ArtifactGitError({ reason: "path" });
  }
  return path.split(sep).join("/");
}

async function regularVaultFile(vaultRoot: string, path: string) {
  try {
    const root = await realpath(vaultRoot);
    const requested = resolve(root, path);
    scopedPath(root, requested);
    const file = await realpath(requested);
    if (relative(file, requested) || !(await lstat(file)).isFile()) {
      throw new ArtifactGitError({ reason: "path" });
    }
    return file;
  } catch {
    throw new ArtifactGitError({ reason: "path" });
  }
}

async function discover(path: string, { vaultRoot, binary = "git", env }: NativeGitOptions) {
  if (
    !/\.md$/i.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    path.includes("\\")
  ) {
    throw new ArtifactGitError({ reason: "path" });
  }
  const file = await regularVaultFile(vaultRoot(), path);
  const safeEnv =
    env ??
    Object.fromEntries(
      Object.entries(hostEnvironment).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
    );
  const probe = gitCommand(binary, dirname(file), safeEnv);
  const worktree = (await probe(["rev-parse", "--show-toplevel"], { reason: "repository" }))
    .toString()
    .replace(/\r?\n$/, "");
  const worktreePath = scopedPath(worktree, file);
  return { file, worktree, path: worktreePath, git: gitCommand(binary, worktree, safeEnv) };
}

async function headOf(git: GitCommand): Promise<GitHead> {
  const [head, ref] = await Promise.all([
    git(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"], { absent: [1] }),
    git(["symbolic-ref", "--quiet", "HEAD"], { absent: [1] }),
  ]);
  return { head: head.toString().trim() || undefined, ref: ref.toString().trim() || "HEAD" };
}

export function createNativeGit(options: NativeGitOptions) {
  async function select(path: string, oid: string) {
    const { git, path: requested } = await discover(path, options);
    const { head } = await headOf(git);
    const revision =
      head && (await history(git, head, requested)).find((entry) => entry.oid === oid);
    if (!revision) throw new ArtifactGitError({ reason: "path" });
    return { git, revision };
  }
  return {
    async commit(path: string, review: GitJournal, draft: string) {
      const message = gitCommitMessage(draft);
      if (!message) throw new ArtifactGitError({ reason: "message" });
      const target = await discover(path, options);
      if (target.worktree !== review.worktree || target.path !== review.current.path) {
        throw new ArtifactGitError({ reason: "conflict" });
      }
      const checkReview = async () => {
        const { head, ref } = await headOf(target.git);
        if (head !== review.head || ref !== review.ref) {
          throw new ArtifactGitError({ reason: "conflict" });
        }
        const file = await regularVaultFile(options.vaultRoot(), path);
        if (file !== target.file || !(await readFile(file)).equals(review.current.bytes)) {
          throw new ArtifactGitError({ reason: "conflict" });
        }
      };
      await checkReview();
      return commitFile(
        target.git,
        target.path,
        review,
        review.current.bytes,
        message,
        checkReview,
      );
    },
    async inspect(path: string): Promise<GitJournal> {
      const target = await discover(path, options);
      const snapshot = await headOf(target.git);
      const [bytes, base, revisions] = await Promise.all([
        readFile(target.file),
        snapshot.head ? readBlob(target.git, snapshot.head, target.path) : undefined,
        snapshot.head ? history(target.git, snapshot.head, target.path) : [],
      ]);
      return {
        ...snapshot,
        worktree: target.worktree,
        state: !base ? "new" : bytes.equals(base.bytes) ? "clean" : "changed",
        base,
        current: { path: target.path, bytes },
        revisions,
      };
    },
    async compare(path: string, oid: string) {
      const { git, revision } = await select(path, oid);
      return compareRevision(git, revision);
    },
    async readRevision(path: string, oid: string) {
      const { git, revision } = await select(path, oid);
      const file = await readBlob(git, revision.oid, revision.path);
      if (!file) throw new ArtifactGitError({ reason: "path" });
      return file;
    },
  };
}
