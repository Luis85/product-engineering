import { Context, Effect, Layer } from "effect";
import type { ProjectId } from "../../domain/projects";
import type { ArtifactGitError, GitComparison, GitFile, GitJournal } from "./model";
import { ArtifactGitError as Failure } from "./model";

export type GitArtifactTarget = {
  readonly projectId: ProjectId;
  readonly path: string;
  readonly repository: string;
  readonly branch: string;
};

export class ArtifactGit extends Context.Service<
  ArtifactGit,
  {
    readonly inspect: (target: GitArtifactTarget) => Effect.Effect<GitJournal, ArtifactGitError>;
    readonly compare: (
      target: GitArtifactTarget,
      oid: string,
    ) => Effect.Effect<GitComparison, ArtifactGitError>;
    readonly readRevision: (
      target: GitArtifactTarget,
      oid: string,
    ) => Effect.Effect<GitFile, ArtifactGitError>;
    readonly commit: (
      target: GitArtifactTarget,
      review: GitJournal,
      message: string,
    ) => Effect.Effect<string, ArtifactGitError>;
  }
>()("product-engineering/application/ArtifactGit") {}

const unavailable = () => Effect.fail(new Failure({ reason: "unavailable" }));

export const unavailableArtifactGit = Layer.succeed(ArtifactGit, {
  inspect: unavailable,
  compare: unavailable,
  readRevision: unavailable,
  commit: unavailable,
});
