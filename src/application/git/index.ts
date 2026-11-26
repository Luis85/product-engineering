export { artifactGitModule } from "./module";
export { ArtifactGitError, gitCommitMessage } from "./model";
export type { GitComparison, GitFile, GitHead, GitJournal, GitRevision } from "./model";
export { ArtifactGit, unavailableArtifactGit } from "./port";
export type { GitArtifactTarget } from "./port";
export {
  commitArtifactGit,
  compareArtifactGit,
  inspectArtifactGit,
  readArtifactRevision,
} from "./use-cases";
export type { ArtifactJournal, GitArtifactSource } from "./use-cases";
