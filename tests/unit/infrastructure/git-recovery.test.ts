import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createNativeGit } from "../../../src/infrastructure/git";
import { gitFixture } from "../../support/git-fixture";

vi.setConfig({ testTimeout: 30_000 });

const path = "Fixture source.md";
let repo: ReturnType<typeof gitFixture>;
let git: ReturnType<typeof createNativeGit>;

beforeEach(() => {
  repo = gitFixture();
  git = createNativeGit({ vaultRoot: () => repo.vault, env: repo.env });
  writeFileSync(join(repo.vault, path), "Initial fixture source\r\n");
});
afterEach(() => repo.close());

it("reports absent repository and executable as different recoverable states", async () => {
  await expect(git.inspect(path)).rejects.toMatchObject({ reason: "repository" });
  const missing = createNativeGit({
    vaultRoot: () => repo.vault,
    binary: join(repo.vault, "no-git"),
    env: repo.env,
  });
  await expect(missing.inspect(path)).rejects.toMatchObject({ reason: "unavailable" });
  repo.init();
  expect((await git.inspect(path)).state).toBe("new");
});

it("requires an explicit Git identity and preserves the worktree and staged index on failure", async () => {
  repo.init();
  repo.git("config", "--unset", "user.name");
  repo.git("config", "--unset", "user.email");
  repo.git("config", "user.useConfigOnly", "true");
  const review = await git.inspect(path);
  await expect(git.commit(path, review, "Author unavailable")).rejects.toMatchObject({
    reason: "author",
  });
  expect(repo.git("ls-files", "--stage", "-z").toString()).toBe("");
  expect((await git.inspect(path)).head).toBeUndefined();
  repo.git("config", "user.name", "Fixture Ready");
  repo.git("config", "user.email", "fixture@example.invalid");
  const newOid = await git.commit(path, review, "Retried with author");
  expect(repo.git("show", "-s", "--format=%an", newOid).toString().trim()).toBe("Fixture Ready");
});

it("rejects a linked directory outside the vault and another path with the same reviewed bytes", async () => {
  const outside = join(repo.vault, "..", "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, path), "Secret fixture source");
  symlinkSync(
    outside,
    join(repo.vault, "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  repo.init();
  await expect(git.inspect("linked/" + path)).rejects.toMatchObject({ reason: "path" });
  await expect(git.inspect("../outside/" + path)).rejects.toMatchObject({ reason: "path" });
  await expect(git.inspect(".git/config")).rejects.toMatchObject({ reason: "path" });

  const review = await git.inspect(path);
  const second = "Independent.md";
  writeFileSync(join(repo.vault, second), review.current.bytes);
  await expect(git.commit(second, review, "Wrong note")).rejects.toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("ls-files", "--stage", "-z").toString()).toBe("");
});

it("serializes competing writes and retains the exact prior revision after a later save and commit", async () => {
  repo.init();
  const review = await git.inspect(path);
  const results = await Promise.allSettled([
    git.commit(path, review, "Submission A"),
    git.commit(path, review, "Submission B"),
  ]);
  const first = results.find((result) => result.status === "fulfilled")?.value;
  expect(first).toMatch(/^[a-f0-9]{40,64}$/);
  expect(results.find((result) => result.status === "rejected")?.reason).toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("rev-list", "--count", "HEAD").toString().trim()).toBe("1");
  if (!first) throw new Error("Missing committed revision");

  const frozen = await git.readRevision(path, first);
  const changed = Buffer.from("Later saved source\r\n\r\n");
  writeFileSync(join(repo.vault, path), changed);
  const second = await git.commit(path, await git.inspect(path), "Later revision");
  expect(repo.git("show", second + ":" + path)).toEqual(changed);
  expect(repo.git("rev-parse", "HEAD^").toString().trim()).toBe(first);
  await expect(git.readRevision(path, first)).resolves.toEqual(frozen);
  expect(frozen.bytes).toEqual(review.current.bytes);
});

it("rejects an advanced HEAD before publishing a reviewed saved file", async () => {
  repo.init();
  const first = await git.commit(path, await git.inspect(path), "Initial");
  writeFileSync(join(repo.vault, path), "Pending file\n");
  const review = await git.inspect(path);
  expect(review.head).toBe(first);
  repo.git("commit", "--quiet", "--allow-empty", "-m", "External HEAD change");
  const advanced = repo.git("rev-parse", "HEAD");
  await expect(git.commit(path, review, "Stale HEAD")).rejects.toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("rev-parse", "HEAD")).toEqual(advanced);
  expect(repo.git("diff", "--cached", "--name-only").toString()).toBe("");
});

it("keeps fixture Git initialization in its own vault despite an inherited Git directory", () => {
  repo.init();
  vi.stubEnv("GIT_DIR", join(repo.vault, ".git"));
  const isolated = gitFixture();
  try {
    isolated.init();
    expect(existsSync(join(isolated.vault, ".git", "HEAD"))).toBe(true);
  } finally {
    vi.unstubAllEnvs();
    isolated.close();
  }
});
