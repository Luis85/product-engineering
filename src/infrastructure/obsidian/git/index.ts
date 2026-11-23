import { Effect, Layer } from "effect";
import { FileSystemAdapter } from "obsidian";
import type { Vault } from "obsidian";
import { ArtifactGit, ArtifactGitError } from "../../../application/git";
import { createNativeGit } from "../../git";

function nativeOperation<A>(run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (error) =>
      error instanceof ArtifactGitError ? error : new ArtifactGitError({ reason: "git" }),
  });
}

export function artifactGitLayer(vault: Vault) {
  const native = createNativeGit({
    vaultRoot: () => {
      if (!(vault.adapter instanceof FileSystemAdapter)) {
        throw new ArtifactGitError({ reason: "unavailable" });
      }
      return vault.adapter.getBasePath();
    },
  });
  return Layer.succeed(ArtifactGit, {
    inspect: ({ path }) => nativeOperation(() => native.inspect(path)),
    compare: ({ path }, oid) => nativeOperation(() => native.compare(path, oid)),
    readRevision: ({ path }, oid) => nativeOperation(() => native.readRevision(path, oid)),
    commit: ({ path }, review, message) =>
      nativeOperation(() => native.commit(path, review, message)),
  });
}
