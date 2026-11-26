import { Schema } from "effect";

export class ArtifactGitError extends Schema.TaggedError<ArtifactGitError>()("ArtifactGitError", {
  reason: Schema.Literals([
    "unavailable",
    "repository",
    "path",
    "author",
    "conflict",
    "message",
    "clean",
    "git",
  ]),
}) {}

export type GitFile = {
  readonly path: string;
  readonly bytes: Uint8Array;
};

export type GitRevision = {
  readonly oid: string;
  readonly parents: readonly string[];
  readonly path: string;
  readonly parentPath?: string;
  readonly author: string;
  readonly time: string;
  readonly message: string;
};

export type GitHead = { readonly ref: string; readonly head: string | undefined };

export type GitJournal = GitHead & {
  readonly worktree: string;
  readonly state: "new" | "changed" | "clean";
  readonly current: GitFile;
  readonly base: GitFile | undefined;
  readonly revisions: readonly GitRevision[];
};

export type GitComparison = {
  readonly current: GitFile | undefined;
  readonly base: GitFile | undefined;
  readonly parent: string | undefined;
  readonly merge: boolean;
};

export function gitCommitMessage(message: string) {
  const trimmed = message.trim();
  return trimmed && !trimmed.includes("\0") ? trimmed : undefined;
}
