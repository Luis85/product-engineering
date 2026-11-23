import { Effect } from "effect";
import type { ProjectId } from "../../domain/projects";
import type { AppError } from "../errors";
import type { NotesServices } from "../notes";
import { projectDeliverySettings } from "../projects";
import { ArtifactGitError } from "./model";
import type { GitJournal } from "./model";
import { ArtifactGit } from "./port";
import type { GitArtifactTarget } from "./port";

export type GitArtifactSource = {
  readonly projectId: ProjectId;
  readonly resolvePath: Effect.Effect<string | undefined, AppError, NotesServices>;
};

export type ArtifactJournal = GitJournal & { readonly target: GitArtifactTarget };

function resolveArtifact({ projectId, resolvePath }: GitArtifactSource) {
  return Effect.gen(function* () {
    const delivery = yield* projectDeliverySettings(projectId);
    const path = yield* resolvePath;
    if (!path || !delivery) return yield* new ArtifactGitError({ reason: "path" });
    const { repository, branch } = delivery;
    return { projectId, path, repository, branch };
  });
}

export function inspectArtifactGit(source: GitArtifactSource) {
  return Effect.gen(function* () {
    const target = yield* resolveArtifact(source);
    const git = yield* ArtifactGit;
    const journal = yield* git.inspect(target);
    return { ...journal, target };
  });
}

export function compareArtifactGit(source: GitArtifactSource, oid: string) {
  return Effect.flatMap(resolveArtifact(source), (target) =>
    ArtifactGit.use((git) => git.compare(target, oid)),
  );
}

export function readArtifactRevision(source: GitArtifactSource, oid: string) {
  return Effect.flatMap(resolveArtifact(source), (target) =>
    ArtifactGit.use((git) => git.readRevision(target, oid)),
  );
}

export function commitArtifactGit(
  source: GitArtifactSource,
  review: ArtifactJournal,
  message: string,
) {
  return Effect.gen(function* () {
    const target = yield* resolveArtifact(source);
    if (target.projectId !== review.target.projectId || target.path !== review.target.path) {
      return yield* new ArtifactGitError({ reason: "conflict" });
    }
    const git = yield* ArtifactGit;
    return yield* git.commit(target, review, message);
  });
}
