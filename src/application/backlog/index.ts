export { backlogModule } from "./module";
export {
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
  backlogBoardRoute,
  backlogRoute,
  backlogTabs,
  deliverablesRoute,
  nfrCatalogRoute,
  pbiDetailRoute,
  pbiTabs,
} from "./routes";
export type { BacklogTab, PbiTab } from "./routes";
export {
  backlogChanges,
  backlogInputs,
  backlogSnapshot,
  adoptBacklogItem,
  openBacklogBase,
} from "./service";
export type { BacklogItem, BacklogSnapshot } from "./model";
export { createBacklogItem, newBacklogCreation } from "./creation";
export type { BacklogCreateDraft, BacklogCreation } from "./creation";
export { initialBacklogDraft, backlogTitleIssue, ownerName } from "./draft";
export type { BacklogDraft } from "./draft";
export { readBacklogItem, saveBacklogItem } from "./edit";
export type { BacklogEdit } from "./edit";
export { moveBacklogItem, rankingPeers, undoBacklogMove } from "./placement";
export type { BacklogPlacement } from "./placement";
export {
  backlogAncestors,
  backlogDescendants,
  backlogDomainContribution,
  backlogGitSource,
  backlogPrdOrigins,
  resolveBacklogItem,
} from "./contributions";
export { companionKinds, pbiCompanions } from "./companions";
export type { CompanionKind } from "./companions";
export { newPbiCriterionIdentity, savePbiCriterion } from "./pbi-criteria";
export type { PbiCriterionIdentity } from "./pbi-criteria";
export { readPbiDetail, savePbiDraft, savePbiReferences } from "./pbi-detail";
export type { PbiDetail, PbiDraft } from "./pbi-detail";
export { pbiSourceDraft, pbiSourceFields, pbiSourceKinds } from "./pbi-sources";
export type { PbiSourceKind } from "./pbi-sources";
export { approvePbi, inspectPbiPreparation } from "./pbi-preparation";
export type { PbiPreparation, PbiPreparationGap } from "./pbi-preparation";
export { boardRequestDestination, boardRequestHandoff, pbiBoardStage } from "./board-requests";
export type { BoardRequest, BoardRequestHandoff } from "./board-requests";
export { inspectBoardPreparation, moveBoardCard } from "./board";
export { directNfrs, nfrTargets, resolveNfrScope, saveNfr, setTargetNfrs } from "./nfr/assignments";
export type { NfrMapContributor } from "./nfr/assignments";
export { confirmNfrImport, planNfrImport } from "./nfr/import";
export type { NfrImportPlan, NfrRecord, NfrSnapshot, NfrTargetOption } from "./nfr/model";
export { nfrTargetKey, nfrsForScope } from "./nfr/scope";
export type { NfrMap, NfrOrigin, NfrScopeSource, ScopedNfr } from "./nfr/scope";
export { newNfrId, nfrChanges, nfrSnapshot } from "./nfr/storage";
export {
  deliverablesChanges,
  deliverablesSnapshot,
  newDeliverableId,
} from "./deliverables/storage";
export type { DeliverableRecord } from "./deliverables/storage";
export { saveDeliverable, setDeliverableStatus } from "./deliverables/write";
export {
  deliverableBacklinks,
  deliverableNote,
  prepareDeliverableNote,
} from "./deliverables/knowledge";
