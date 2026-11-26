import { access, copyFile, mkdtemp, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ArtifactGitError } from "../../application/git";
import type { GitHead } from "../../application/git";
import type { GitCommand } from "./command";
import { blobEntry } from "./history";

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

const gitOperations = [
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "rebase-merge",
  "rebase-apply",
  "sequencer",
];

async function assertIdleIndex(git: GitCommand, gitDir: string) {
  const [unmerged, ...active] = await Promise.all([
    git(["ls-files", "--unmerged", "-z"]),
    ...gitOperations.map((marker) =>
      access(join(gitDir, marker)).then(
        () => true,
        () => false,
      ),
    ),
  ]);
  if (unmerged.length || active.some(Boolean)) {
    throw new ArtifactGitError({ reason: "conflict" });
  }
}

async function updateHead(
  git: GitCommand,
  { ref }: GitHead,
  oid: string | undefined,
  expected: string,
) {
  const update = oid ? [ref, oid, expected] : ["-d", ref, expected];
  await git(["update-ref", "-m", "product-engineering: commit note", ...update], {
    reason: "conflict",
  });
}

async function prepareCommit(
  git: GitCommand,
  path: string,
  head: string | undefined,
  bytes: Uint8Array,
  message: string,
  indexFile: string,
  temp: string,
) {
  const commitIndex = join(temp, "commit");
  const stagedIndex = join(temp, "staged");
  const previous = head ? await blobEntry(git, head, path) : undefined;
  const mode = previous?.mode ?? "100644";
  await Promise.all([
    git(["read-tree", ...(head ? [head] : ["--empty"])], { index: commitIndex }),
    copyFile(indexFile, stagedIndex).catch((error: unknown) => {
      if (!missing(error)) throw error;
    }),
  ]);
  const blob = (await git(["hash-object", "-w", "--no-filters", "--stdin"], { input: bytes }))
    .toString()
    .trim();
  if (blob === previous?.blob) throw new ArtifactGitError({ reason: "clean" });
  await Promise.all(
    [commitIndex, stagedIndex].map((index) =>
      git(["update-index", "--add", "--cacheinfo", mode, blob, path], { index }),
    ),
  );
  const tree = (await git(["write-tree"], { index: commitIndex })).toString().trim();
  const oid = (
    await git(["commit-tree", "--no-gpg-sign", tree, ...(head ? ["-p", head] : []), "-F", "-"], {
      input: message,
      reason: "author",
    })
  )
    .toString()
    .trim();
  return { oid, stagedIndex };
}

export async function commitFile(
  git: GitCommand,
  path: string,
  review: GitHead,
  bytes: Uint8Array,
  message: string,
  beforePublish: () => Promise<void>,
) {
  const indexFile = (await git(["rev-parse", "--path-format=absolute", "--git-path", "index"]))
    .toString()
    .replace(/\r?\n$/, "");
  const lockPath = indexFile + ".lock";
  const lock = await open(lockPath, "wx").catch(() => {
    throw new ArtifactGitError({ reason: "conflict" });
  });
  let temp: string | undefined;
  let installed = false;
  try {
    const gitDir = dirname(indexFile);
    await assertIdleIndex(git, gitDir);
    temp = await mkdtemp(join(gitDir, "pe-index-"));
    const { head } = review;
    const { oid, stagedIndex } = await prepareCommit(
      git,
      path,
      head,
      bytes,
      message,
      indexFile,
      temp,
    );
    await lock.writeFile(await readFile(stagedIndex));
    await lock.close();
    await beforePublish();
    await updateHead(git, review, oid, head ?? "0".repeat(oid.length));
    try {
      await rename(lockPath, indexFile);
      installed = true;
    } catch {
      await updateHead(git, review, head, oid);
      throw new ArtifactGitError({ reason: "git" });
    }
    return oid;
  } finally {
    await lock.close();
    await Promise.all([
      installed ? undefined : rm(lockPath, { force: true }),
      temp ? rm(temp, { recursive: true, force: true }) : undefined,
    ]);
  }
}
