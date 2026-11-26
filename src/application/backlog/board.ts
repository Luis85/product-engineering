import { Effect, Result } from "effect";
import { mappedBoardStage } from "../../domain/backlog";
import type { BoardStage } from "../../domain/backlog";
import { NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import { manualPbiStageFields } from "./draft";
import { BacklogError } from "./model";
import { readPbiDetail } from "./pbi-detail";
import { inspectPbiPreparation } from "./pbi-preparation";
import {
  BacklogWrites,
  frontmatterPatch,
  matchesFields,
  scopedBacklog,
  stillInBacklog,
  writableRow,
} from "./service";

export const inspectBoardPreparation = (project: ProjectId, id: string) =>
  Effect.flatMap(readPbiDetail(project, id), inspectPbiPreparation);

export const moveBoardCard = (
  project: ProjectId,
  id: string,
  observedState: string,
  stage: BoardStage,
) =>
  BacklogWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const context = yield* scopedBacklog(project);
        const { row } = yield* writableRow(context, id);
        if (row.kind !== "UC" || !row.adopted || row.id !== id)
          return yield* new BacklogError({ reason: "identity" });
        if (row.state !== observedState) return yield* new BacklogError({ reason: "conflict" });
        const { base } = context;
        const fields = manualPbiStageFields(base, mappedBoardStage(stage, base.states));
        const store = yield* NoteStore;
        const saved = yield* store.updateContent(row.path, ({ frontmatter }) =>
          stillInBacklog(context, row, frontmatter) &&
          matchesFields(frontmatter, row.fields, fields)
            ? Result.succeed({ patch: frontmatterPatch(fields) })
            : Result.fail(new BacklogError({ reason: "conflict" })),
        );
        recent.set(saved.path, saved);
        return saved;
      }),
    ),
  );
