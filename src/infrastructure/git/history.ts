import type { GitComparison, GitFile, GitRevision } from "../../application/git";
import { ArtifactGitError } from "../../application/git";
import type { GitCommand } from "./command";

const format = "format:%x00%H%x00%P%x00%an%x00%aI%x00%s%x00";

function logEntry(fields: readonly string[], index: number) {
  const [
    oid = "",
    parents = "",
    author = "",
    time = "",
    message = "",
    status = "",
    previousPath = "",
    renamedPath = "",
  ] = fields.slice(index, index + 8);
  const moved = status.startsWith("\nR");
  const path = moved ? renamedPath : previousPath;
  if (!oid || !time || !path) throw new ArtifactGitError({ reason: "git" });
  const revision: GitRevision = {
    oid,
    parents: parents ? parents.split(" ") : [],
    author,
    time,
    message,
    path,
    ...(moved ? { parentPath: previousPath } : {}),
  };
  return { revision, length: moved ? 8 : 7 };
}

export async function history(git: GitCommand, head: string, path: string): Promise<GitRevision[]> {
  const output = await git([
    "log",
    "--follow",
    "--diff-merges=first-parent",
    "--no-decorate",
    "--no-notes",
    "--no-show-signature",
    "--encoding=UTF-8",
    "--name-status",
    "-z",
    "--format=" + format,
    head,
    "--",
    path,
  ]);
  const fields = output.toString().split("\0");
  const revisions: GitRevision[] = [];
  let index = 1;
  while (index < fields.length) {
    const entry = logEntry(fields, index);
    revisions.push(entry.revision);
    index += entry.length;
    while (fields[index] === "") index++;
  }
  return revisions;
}

export async function blobEntry(git: GitCommand, oid: string, path: string) {
  const tree = await git(["ls-tree", "-z", "--full-tree", oid, "--", path]);
  const match = /^(100(?:644|755)) blob ([a-f0-9]+)\t/.exec(tree.toString());
  const mode = match?.[1];
  const blob = match?.[2];
  return mode && blob ? { mode, blob } : undefined;
}

export async function readBlob(
  git: GitCommand,
  oid: string,
  path: string,
): Promise<GitFile | undefined> {
  const entry = await blobEntry(git, oid, path);
  return entry && { path, bytes: await git(["cat-file", "blob", entry.blob]) };
}

export async function compareRevision(
  git: GitCommand,
  revision: GitRevision,
): Promise<GitComparison> {
  const { oid, path, parents, parentPath } = revision;
  const parent = parents[0];
  const [current, base] = await Promise.all([
    readBlob(git, oid, path),
    parent ? readBlob(git, parent, parentPath ?? path) : undefined,
  ]);
  return { current, base, parent, merge: parents.length > 1 };
}
