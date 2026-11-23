import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createNativeGit } from "../../../src/infrastructure/git";
import { gitFixture } from "../../support/git-fixture";

vi.setConfig({ testTimeout: 30_000 });

const path = "Notizen/Über gabe [01].md";
let repo: ReturnType<typeof gitFixture>;
let native: ReturnType<typeof createNativeGit>;

beforeEach(() => {
  repo = gitFixture();
  native = createNativeGit({ vaultRoot: () => repo.vault, env: repo.env });
  mkdirSync(join(repo.vault, "Notizen"));
});
afterEach(() => repo.close());

it("discovers an unborn repository from the real Unicode Vault path and compares exact bytes", async () => {
  repo.init();
  const bytes = Buffer.from("---\r\ntitle: Übergabe\r\n---\r\nOhne Schlussumbruch");
  writeFileSync(join(repo.vault, path), bytes);
  const journal = await native.inspect(path);
  expect(journal).toMatchObject({
    state: "new",
    revisions: [],
    head: undefined,
    ref: "refs/heads/main",
    current: { path, bytes },
    base: undefined,
  });
});

it("reports ordered revisions, real parents, author dates and clean bytes after reopening", async () => {
  repo.init();
  const first = Buffer.from("Common\r\nOriginal title\r\n");
  const second = Buffer.from("Common\r\nEdited title\r\nVorschlag");
  const diskFile = join(repo.vault, path);
  writeFileSync(diskFile, first);
  repo.git("add", "--", path);
  repo.git("commit", "--quiet", "-m", "Initial version");
  const old = repo.git("rev-parse", "HEAD").toString().trim();
  writeFileSync(diskFile, second);
  repo.git("commit", "--quiet", "-a", "-m", "Second version");
  const head = repo.git("rev-parse", "HEAD").toString().trim();
  const reopened = createNativeGit({ vaultRoot: () => repo.vault, env: repo.env });
  const journal = await reopened.inspect(path);
  expect(journal).toMatchObject({
    state: "clean",
    head,
    base: { path, bytes: second },
    current: { path, bytes: second },
    revisions: [
      {
        oid: head,
        parents: [old],
        message: "Second version",
        author: "Vault Fixture",
        time: repo.git("show", "-s", "--format=%aI", head).toString().trim(),
      },
      { oid: old, parents: [], message: "Initial version" },
    ],
  });
  await expect(reopened.compare(path, old)).resolves.toMatchObject({
    current: { path, bytes: first },
    base: undefined,
  });
  await expect(reopened.compare(path, head)).resolves.toMatchObject({
    current: { path, bytes: second },
    base: { path, bytes: first },
    parent: old,
  });
  await expect(reopened.readRevision(path, old)).resolves.toEqual({ path, bytes: first });
});

it("follows a checked-in rename and uses the old path in its parent", async () => {
  repo.init();
  const oldPath = "Notizen/Original [01].md";
  const bytes = Buffer.from("Übergabe\n");
  writeFileSync(join(repo.vault, oldPath), bytes);
  repo.git("add", "--", oldPath);
  repo.git("commit", "--quiet", "-m", "Original path");
  const old = repo.git("rev-parse", "HEAD").toString().trim();
  renameSync(join(repo.vault, oldPath), join(repo.vault, path));
  repo.git("add", "-A");
  repo.git("commit", "--quiet", "-m", "Rename note");
  const journal = await native.inspect(path);
  expect(journal.revisions).toMatchObject([
    { path, parentPath: oldPath },
    { path: oldPath, oid: old },
  ]);
  const rename = journal.revisions[0]?.oid;
  if (!rename) throw new Error("Missing rename revision");
  await expect(native.compare(path, rename)).resolves.toMatchObject({
    current: { path, bytes },
    base: { path: oldPath, bytes },
    parent: old,
  });
  await expect(native.readRevision(path, old)).resolves.toEqual({ path: oldPath, bytes });
});

it("commits only the reviewed untracked bytes on unborn HEAD and preserves an unrelated mixed index", async () => {
  repo.init();
  repo.git("config", "core.autocrlf", "true");
  const other = "Other.md";
  const untouched = "Untracked external.md";
  writeFileSync(join(repo.vault, other), "Staged content\n");
  repo.git("add", "--", other);
  writeFileSync(join(repo.vault, other), "Working content\n");
  writeFileSync(join(repo.vault, untouched), "Untracked content\n");
  const staged = repo.git("ls-files", "--stage", "--", other);
  const bytes = Buffer.from("Übergabe\r\nZeile zwei\r\n");
  writeFileSync(join(repo.vault, path), bytes);
  const review = await native.inspect(path);
  const oid = await native.commit(path, review, "Initial note");
  expect(oid).toMatch(/^[0-9a-f]{40,64}$/);
  expect(repo.git("rev-list", "--parents", "HEAD").toString().trim()).toBe(oid);
  expect(repo.git("ls-tree", "-r", "-z", "--full-tree", "--name-only", "HEAD").toString()).toBe(
    path + "\0",
  );
  expect(repo.git("show", oid + ":" + path)).toEqual(bytes);
  expect(repo.git("diff", "--cached", "--name-only", "-z").toString()).toBe(other + "\0");
  expect(repo.git("ls-files", "--stage", "--", other)).toEqual(staged);
  expect(readFileSync(join(repo.vault, other), "utf8")).toBe("Working content\n");
  expect(readFileSync(join(repo.vault, untouched), "utf8")).toBe("Untracked content\n");
  expect(readFileSync(join(repo.vault, path))).toEqual(bytes);
  expect((await native.inspect(path)).state).toBe("clean");
});

it("refuses a second edit after review and retries against the new bytes", async () => {
  repo.init();
  const diskFile = join(repo.vault, path);
  writeFileSync(diskFile, "Original\n");
  repo.git("add", "--", path);
  repo.git("commit", "--quiet", "-m", "Initial");
  const head = repo.git("rev-parse", "HEAD");
  writeFileSync(diskFile, "Reviewed\n");
  const review = await native.inspect(path);
  writeFileSync(diskFile, "Second saved edit\n");
  await expect(native.commit(path, review, "Unreviewed save")).rejects.toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("rev-parse", "HEAD")).toEqual(head);
  expect(repo.git("diff", "--cached", "--name-only").toString()).toBe("");
  expect(readFileSync(diskFile, "utf8")).toBe("Second saved edit\n");

  const retry = await native.inspect(path);
  const oid = await native.commit(path, retry, "Reviewed second edit");
  expect(repo.git("log", "-1", "--format=%P").toString().trim()).toBe(head.toString().trim());
  expect(repo.git("show", oid + ":" + path).toString()).toBe("Second saved edit\n");
});

it("refuses to commit if the checked-out branch changed at the same SHA", async () => {
  repo.init();
  const diskFile = join(repo.vault, path);
  writeFileSync(diskFile, "Original\n");
  repo.git("add", "--", path);
  repo.git("commit", "--quiet", "-m", "Initial");
  const head = repo.git("rev-parse", "HEAD");
  writeFileSync(diskFile, "Reviewed edit\n");
  const review = await native.inspect(path);
  repo.git("switch", "--quiet", "-c", "other");
  await expect(native.commit(path, review, "Different checked-out branch")).rejects.toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("rev-parse", "refs/heads/main")).toEqual(head);
  expect(repo.git("rev-parse", "HEAD")).toEqual(head);
});

it("rejects blank commit messages without changing HEAD or staging the file", async () => {
  repo.init();
  writeFileSync(join(repo.vault, path), "New source\n");
  const review = await native.inspect(path);
  await expect(native.commit(path, review, " \t\n")).rejects.toMatchObject({ reason: "message" });
  expect(repo.git("ls-files", "--stage").toString()).toBe("");
  expect((await native.inspect(path)).head).toBeUndefined();
});

it("keeps a conflicted repository intact and retries after the Git operation is resolved", async () => {
  repo.init();
  const other = "Conflicted.md";
  const disk = (file: string) => join(repo.vault, file);
  writeFileSync(disk(path), "Initial note\n");
  writeFileSync(disk(other), "Base\n");
  repo.git("add", "--", path, other);
  repo.git("commit", "--quiet", "-m", "Base");
  repo.git("switch", "--quiet", "-c", "side");
  writeFileSync(disk(other), "Side\n");
  repo.git("commit", "--quiet", "-a", "-m", "Side");
  repo.git("switch", "--quiet", "main");
  writeFileSync(disk(other), "Main\n");
  repo.git("commit", "--quiet", "-a", "-m", "Main");
  expect(() => repo.git("merge", "--no-edit", "side")).toThrow(/Command failed/);
  writeFileSync(disk(path), "Pending saved edit\n");
  const staged = repo.git("ls-files", "--stage", "-z");
  const conflicted = readFileSync(disk(other));
  const before = repo.git("rev-parse", "HEAD");
  const review = await native.inspect(path);
  await expect(native.commit(path, review, "Conflict must be resolved")).rejects.toMatchObject({
    reason: "conflict",
  });
  expect(repo.git("rev-parse", "HEAD")).toEqual(before);
  expect(repo.git("ls-files", "--stage", "-z")).toEqual(staged);
  expect(readFileSync(disk(other))).toEqual(conflicted);

  repo.git("merge", "--abort");
  const current = await native.inspect(path);
  const oid = await native.commit(path, current, "Retry after merge abort");
  expect(repo.git("show", oid + ":" + path).toString()).toBe("Pending saved edit\n");
});

it("includes a note-changing merge and compares against its labelled first parent", async () => {
  repo.init();
  const diskFile = join(repo.vault, path);
  const base = Buffer.from("First parent note\n");
  const merged = Buffer.from("Side branch note\n");
  writeFileSync(diskFile, base);
  repo.git("add", "--", path);
  repo.git("commit", "--quiet", "-m", "Base");
  repo.git("switch", "--quiet", "-c", "side");
  writeFileSync(diskFile, merged);
  repo.git("commit", "--quiet", "-a", "-m", "Side change");
  const side = repo.git("rev-parse", "HEAD").toString().trim();
  repo.git("switch", "--quiet", "main");
  writeFileSync(join(repo.vault, "Main.md"), "Unrelated baseline\n");
  repo.git("add", "--", "Main.md");
  repo.git("commit", "--quiet", "-m", "Main branch change");
  const main = repo.git("rev-parse", "HEAD").toString().trim();
  repo.git("merge", "--quiet", "--no-ff", "-m", "Merge note revision", "side");
  const oid = repo.git("rev-parse", "HEAD").toString().trim();
  const journal = await native.inspect(path);
  expect(journal.revisions[0]).toMatchObject({
    oid,
    parents: [main, side],
    message: "Merge note revision",
  });
  await expect(native.compare(path, oid)).resolves.toMatchObject({
    current: { path, bytes: merged },
    base: { path, bytes: base },
    parent: main,
    merge: true,
  });
});

it("refuses a clean submission and leaves both the index and HEAD unchanged", async () => {
  repo.init();
  writeFileSync(join(repo.vault, path), "Already committed\n");
  repo.git("add", "--", path);
  repo.git("commit", "--quiet", "-m", "Initial");
  const journal = await native.inspect(path);
  expect(journal.state).toBe("clean");
  const index = repo.git("ls-files", "--stage", "-z");
  await expect(native.commit(path, journal, "Do not create an empty commit")).rejects.toMatchObject(
    { reason: "clean" },
  );
  expect(repo.git("rev-parse", "HEAD").toString().trim()).toBe(journal.head);
  expect(repo.git("ls-files", "--stage", "-z")).toEqual(index);
});
