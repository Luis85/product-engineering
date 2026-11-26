import { Effect } from "effect";
import { nfrType } from "../../domain/backlog";
import type { NfrId } from "../../domain/backlog";
import { nfrSnapshot } from "../backlog";
import type { NfrRecord } from "../backlog";
import { NoteStore } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";

function currentValues(note: Note | undefined, { id, projectId }: NfrRecord) {
  if (!note) return;
  const current = nfrType.decode(note);
  if (
    current.kind === "editable" &&
    !current.issues.length &&
    current.id === id &&
    current.values.project_id === projectId
  )
    return current.values;
}

function readNfr(record: NfrRecord) {
  return Effect.gen(function* () {
    const store = yield* NoteStore;
    const note = yield* store
      .readFresh(record.path)
      .pipe(
        Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () =>
          Effect.succeed(undefined),
        ),
      );
    const values = currentValues(note, record);
    if (!values) return;
    const { title, requirement, acceptance, categories, targets, owner_id } = values;
    if (title === undefined || requirement === undefined || acceptance === undefined) return;
    return {
      id: record.id,
      projectId: record.projectId,
      title,
      requirement,
      acceptance,
      categories: categories ?? [],
      targets: targets ?? [],
      ...(owner_id && { owner_id }),
    };
  });
}

export function readPrototypeNfrs(project: ProjectId, selected?: NfrId) {
  return Effect.gen(function* () {
    const { records } = yield* nfrSnapshot(project);
    const candidates = selected ? records.filter(({ id }) => id === selected) : records;
    const current = yield* Effect.forEach(candidates, readNfr, { concurrency: 4 });
    return current.filter((record) => record !== undefined);
  });
}
