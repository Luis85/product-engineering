import { Effect, Result, Stream } from "effect";
import {
  clashName,
  followsTitle,
  MAX_NAME_ATTEMPTS,
  parseSchemaMarker,
  recordFileName,
} from "../../domain/notes";
import type {
  Frontmatter,
  NoteFields,
  NoteIssue,
  NoteKey,
  NoteType,
  WriteRefusal,
} from "../../domain/notes";
import { Logger, Messages, Notifier, SettingsService } from "../shell";
import { NotePathTakenError, NoteWriteRefusedError } from "./errors";
import { recordFolder } from "./folders";
import { noteChanges, noteSnapshot } from "./index-use-cases";
import type { IndexedNote, NoteIndexSnapshot } from "./note-index";
import { NoteStore } from "./ports";
import type { Note } from "./ports";
import { fileNameOf, shownRecordName, toRecordList } from "./record-list";
import type { RecordListOptions, RecordRow } from "./record-list";
import { editChange, newRecordFrontmatter } from "./records";

interface RecordsOptions<Fields extends NoteFields, Issue extends NoteIssue> extends Pick<
  RecordListOptions<Fields, Issue>,
  "issue" | "between"
> {
  readonly type: NoteType<Fields>;
  readonly title: NoteKey<Fields>;
  readonly fallbackName: () => string;
  readonly log: string;
}

function titleOf(values: Frontmatter, key: string): string | undefined {
  const title = values[key];
  return typeof title === "string" ? title : undefined;
}

function locateRecord(store: NoteStore["Service"], type: NoteType, row: RecordRow) {
  return Effect.gen(function* () {
    const { id } = row;
    if (id === undefined) return yield* new NoteWriteRefusedError({ reason: "identity" });

    const notes = yield* store.list;
    const matches = notes.filter(({ frontmatter }) => {
      if (frontmatter.id !== id) return false;
      const marker = parseSchemaMarker(frontmatter.schema);
      return marker._tag === "record" && marker.type === type.type;
    });
    if (matches.length > 1) return yield* new NoteWriteRefusedError({ reason: "duplicate-id" });

    // With no matching ID, the atomic callback checks the current file at the old path.
    return { path: matches[0]?.path ?? row.path, id };
  });
}

function deletionRefusal(
  note: ReturnType<NoteType["decode"]>,
  id: string,
): WriteRefusal | undefined {
  if (note.kind === "not-this-type") return "other-type";
  if (note.kind === "read-only" && note.issue.code === "schema.newer") return "newer-version";
  if (note.id !== id) return "identity";
  if (note.kind === "read-only") {
    return note.issue.code === "id.duplicate" ? "duplicate-id" : "migration-failed";
  }
}

function renameAvailable(store: NoteStore["Service"], path: string, name: string) {
  return Effect.gen(function* () {
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
      const renamed = yield* Effect.result(store.rename(path, clashName(name, attempt)));
      if (Result.isSuccess(renamed)) return renamed.success.path;
      if (renamed.failure._tag !== "NotePathTakenError") return yield* Effect.fail(renamed.failure);
    }
    return yield* new NotePathTakenError();
  });
}

function renameFollowingTitle(
  store: NoteStore["Service"],
  note: Note,
  previousTitle: string,
  currentTitle: string,
  fallback: string,
  log: string,
) {
  return Effect.gen(function* () {
    const nextName = recordFileName(currentTitle, fallback);
    if (nextName === recordFileName(previousTitle, fallback)) return note;
    if (!followsTitle(fileNameOf(note.path), previousTitle, fallback)) return note;

    const renamed = yield* Effect.result(renameAvailable(store, note.path, nextName));
    if (Result.isSuccess(renamed)) return { ...note, path: renamed.success };

    const logger = yield* Logger;
    yield* logger.log({ level: "warn", event: `${log}.rename.failed` });
    return note;
  });
}

function confirm(kind: "created" | "saved" | "deleted", name: string) {
  return Effect.gen(function* () {
    const { notes } = yield* Messages;
    const notifier = yield* Notifier;
    yield* notifier.notify({ severity: "info", title: notes.notices[kind](name), detail: "" });
  });
}

export function defineRecords<Fields extends NoteFields, Issue extends NoteIssue = never>(
  options: RecordsOptions<Fields, Issue>,
) {
  const { type, fallbackName, log } = options;
  const title = (values: Frontmatter) => titleOf(values, options.title);
  const shownName = (row: RecordRow<Fields, Issue>) => shownRecordName(row, title);
  const toList = (snapshot: NoteIndexSnapshot<IndexedNote<Fields>>, collation = "de") =>
    toRecordList(snapshot, { ...options, title, collation });
  const list = Effect.map(noteSnapshot(type), (snapshot) => toList(snapshot));
  const changes = Stream.map(noteChanges(type), (snapshot) => toList(snapshot));

  function decodedTitle(note: Note): string | undefined {
    const decoded = type.decode(note);
    return decoded.kind === "not-this-type" ? undefined : title(decoded.values);
  }

  function create(values: Frontmatter) {
    return Effect.uninterruptible(
      Effect.gen(function* () {
        const settings = yield* SettingsService;
        const store = yield* NoteStore;
        const { rootFolder } = yield* settings.current;
        const frontmatter = yield* newRecordFrontmatter(type, values);
        const wanted = title(frontmatter);
        const created = yield* store.create({
          folder: recordFolder(rootFolder, type),
          name: recordFileName(wanted ?? "", fallbackName()),
          frontmatter,
        });
        yield* confirm("created", wanted || fileNameOf(created.path));
        return created;
      }),
    );
  }

  function update(row: RecordRow<Fields, Issue>, values: Frontmatter) {
    return Effect.uninterruptible(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        const { path } = yield* locateRecord(store, type, row);
        const apply = editChange(type, row.frontmatter, values);
        let previousTitle = "";

        const saved = yield* store.update(path, (frontmatter) => {
          const change = apply(frontmatter);
          if (Result.isSuccess(change)) previousTitle = decodedTitle({ path, frontmatter }) ?? "";
          return change;
        });
        const currentTitle = decodedTitle(saved) ?? "";
        const note = yield* renameFollowingTitle(
          store,
          saved,
          previousTitle,
          currentTitle,
          fallbackName(),
          log,
        );
        yield* confirm("saved", currentTitle || fileNameOf(note.path));
        return note;
      }),
    );
  }

  function remove(row: RecordRow<Fields, Issue>) {
    return Effect.uninterruptible(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        const { id, path } = yield* locateRecord(store, type, row);
        const verified = yield* store.update(path, (frontmatter) => {
          const refusal = deletionRefusal(type.decode({ path, frontmatter }), id);
          return refusal
            ? Result.fail(new NoteWriteRefusedError({ reason: refusal }))
            : Result.succeed({});
        });
        yield* store.trash(verified.path);
        yield* confirm("deleted", decodedTitle(verified) || fileNameOf(verified.path));
      }),
    );
  }

  return { list, changes, toList, shownName, create, update, remove };
}
