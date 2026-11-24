import { Effect, Result } from "effect";
import { pbiFeature } from "../../domain/backlog";
import { sameFrontmatter } from "../../domain/notes";
import { backlogGitSource, pbiCompanions, resolveNfrScope } from "../backlog";
import type { PbiDetail, PbiPreparation } from "../backlog";
import { resolveDomainScope } from "../domain-model";
import { readArtifactRevision } from "../git";
import { knowledgeDetailRoute, knowledgeGitSource, readKnowledgeNote } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import { NoteStore } from "../notes";
import { storyMapDomainContribution, storyMapNfrContribution } from "../story-maps";
import { canonicalRequestJson } from "./delivery-package";
import type { RequestPackage } from "./delivery-package";
import { readDraftRequestGates } from "./gates";
import { packageLinks } from "./package-links";
import type { FeatureRequest } from "./records";

type DraftGates = Effect.Success<ReturnType<typeof readDraftRequestGates>>;
type Attachment = RequestPackage["attachments"][number];

function eligibleCommit(preparation: PbiPreparation | undefined, id: string) {
  const input = preparation?.inputs.find((entry) => entry.id === id);
  return input?.state === "clean" ? input.commit : undefined;
}

function committedBytesMatch(
  detail: PbiDetail,
  text: string,
  commit?: string,
  source?: KnowledgeRecord,
) {
  return Effect.gen(function* () {
    if (!commit) return;
    const target = source
      ? knowledgeGitSource(knowledgeDetailRoute(detail.projectId, source.id))
      : backlogGitSource(detail.projectId, detail.pbiId);
    const result = yield* Effect.result(readArtifactRevision(target, commit));
    if (
      Result.isSuccess(result) &&
      new TextDecoder("utf-8", { ignoreBOM: true }).decode(result.success.bytes) === text
    )
      return commit;
  });
}

function captureAttachment(
  detail: PbiDetail,
  source: KnowledgeRecord,
  verifyBytes: boolean,
  oid?: string,
) {
  return Effect.gen(function* () {
    const note = yield* Effect.result(readKnowledgeNote(detail.projectId, source.id, source.path));
    if (!Result.isSuccess(note) || !note.success?.editable) return;
    const { id, displayId, title, kind, path, body: markdown, text } = note.success;
    const commit = verifyBytes ? yield* committedBytesMatch(detail, text, oid, source) : oid;
    return { id, displayId, title, kind, markdown, ...(commit && { commit }), path };
  });
}

function linkedNotes(source: PbiDetail, preparation: PbiPreparation | undefined) {
  const selected = [preparation?.vision, ...source.sources.map((entry) => entry.record)];
  const byId = new Map(selected.flatMap((note) => (note ? [[note.id, note] as const] : [])));
  return [...byId.values()];
}

function verifiedPbiCommit(source: PbiDetail, oid: string | undefined) {
  return Effect.gen(function* () {
    const { draft, item } = source.edit;
    const current = yield* Effect.result(NoteStore.use((store) => store.readContent(item.path)));
    const content = Result.isSuccess(current) ? current.success : undefined;
    const unchanged =
      content && content.body === draft.body && sameFrontmatter(item.fields, content.frontmatter);
    if (unchanged) return yield* committedBytesMatch(source, content.text, oid);
  });
}

function captureUseCase(source: PbiDetail, verifyBytes: boolean, oid?: string) {
  return Effect.gen(function* () {
    const { pbiId, revision, criteria = [], edit } = source;
    const { path, title, owner } = edit.item;
    const commit = verifyBytes ? yield* verifiedPbiCommit(source, oid) : oid;
    return {
      id: pbiId,
      displayId: pbiId,
      title,
      markdown: edit.draft.body,
      revision,
      criteria,
      ...(owner && { owner }),
      ...(commit && { commit }),
      path,
    };
  });
}

function requestRequirement(attachments: readonly Attachment[], id: string | undefined) {
  const prd = attachments.find(({ kind }) => kind === "prd");
  if (id && prd)
    return { id, artifactId: prd.id, anchor: id, ...(prd.commit && { commit: prd.commit }) };
}

function requestDestination(preparation: PbiPreparation | undefined) {
  const delivery = preparation?.delivery;
  if (delivery?.dataClass)
    return {
      repository: delivery.repository,
      branch: delivery.branch,
      dataClass: delivery.dataClass,
    };
}

function captureArtifacts(
  record: FeatureRequest,
  { source, preparation, items }: DraftGates,
  verifyBytes: boolean,
) {
  return Effect.gen(function* () {
    if (!source) return { complete: false, attachments: [], links: [], gherkin: "", workIds: [] };
    const selected = linkedNotes(source, preparation);
    const results = yield* Effect.forEach(
      selected,
      (note) => captureAttachment(source, note, verifyBytes, eligibleCommit(preparation, note.id)),
      { concurrency: 4 },
    );
    const useCase = yield* captureUseCase(
      source,
      verifyBytes,
      eligibleCommit(preparation, source.pbiId),
    );
    const present = results.filter((entry) => entry !== undefined);
    const links = yield* packageLinks(record.projectId, [useCase, ...present], items ?? []);
    const attachments: readonly Attachment[] = present.map(({ path: _path, ...note }) => note);
    const requirement = requestRequirement(attachments, preparation?.requirement);
    const workIds = pbiCompanions(items ?? [], source.edit.item)
      .items.flatMap((item) => (item.id ? [item.id] : []))
      .toSorted();
    const { path: _path, ...pbi } = useCase;
    return {
      complete:
        selected.length === present.length &&
        Boolean(pbi.commit) &&
        attachments.every((note) => note.commit),
      attachments,
      useCase: pbi,
      links,
      workIds,
      gherkin: pbiFeature(pbi, pbi.criteria, "en"),
      ...(requirement && { requirement }),
    };
  });
}

function captureScope({ projectId, pbiId }: FeatureRequest) {
  return Effect.gen(function* () {
    const target = { kind: "item", id: pbiId } as const;
    const [nfrs, domain] = yield* Effect.all(
      [
        resolveNfrScope(projectId, target, storyMapNfrContribution),
        resolveDomainScope(projectId, [target], storyMapDomainContribution),
      ],
      { concurrency: 2 },
    );
    return {
      nfrs: nfrs.map(({ owner_id, ...nfr }) => ({ ...nfr, ...(owner_id && { owner_id }) })),
      domain,
    };
  });
}

function verifiedReadyGates(gates: DraftGates["ready"], complete: boolean) {
  const committed = gates.find(({ id }) => id === "base-git")?.status === "passed";
  if (committed && !complete)
    return gates.map((gate) =>
      gate.id === "base-git" ? { ...gate, status: "unavailable" as const } : gate,
    );
  return gates;
}

export function readRequestPackagePreview(record: FeatureRequest, verifyBytes = false) {
  return Effect.gen(function* () {
    const { projectId, id, displayId, revision, title, scope } = record;
    const evaluated = yield* readDraftRequestGates(record);
    const { complete, ...artifacts } = yield* captureArtifacts(record, evaluated, verifyBytes);
    const context = yield* captureScope(record);
    const destination = requestDestination(evaluated.preparation);
    const definitions = evaluated.rules;
    const ready = verifiedReadyGates(evaluated.ready, complete);
    const payload: RequestPackage = {
      schemaVersion: 1,
      request: { projectId, id, displayId, revision, title },
      scope,
      ...artifacts,
      ...context,
      ...(destination && { destination }),
      ...(definitions && { definitions }),
      readyEvidence: ready,
    };
    return {
      package: payload,
      basis: canonicalRequestJson(payload),
      ready: Boolean(
        destination &&
        complete &&
        payload.requirement?.commit &&
        definitions &&
        ready.every(({ status }) => status === "passed"),
      ),
      gates: { ...evaluated, ready },
    };
  });
}

function sourceIdentity(input?: { revision?: number; commit?: string; id: string }) {
  return input && [input.id, input.revision, input.commit];
}

function baseline(value: RequestPackage) {
  return canonicalRequestJson([
    value.destination,
    sourceIdentity(value.useCase),
    value.requirement,
    value.attachments.map(sourceIdentity),
  ]);
}

export function requestPackageChanges(frozen: RequestPackage, live: RequestPackage) {
  return {
    stale: baseline(frozen) !== baseline(live),
    scopeChanged:
      (frozen.nfrs !== undefined &&
        canonicalRequestJson(frozen.nfrs) !== canonicalRequestJson(live.nfrs)) ||
      (frozen.domain !== undefined &&
        canonicalRequestJson(frozen.domain) !== canonicalRequestJson(live.domain)),
  };
}

export type RequestPackagePreview = Effect.Success<ReturnType<typeof readRequestPackagePreview>>;
