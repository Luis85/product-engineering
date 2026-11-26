import { useForm } from "@tanstack/vue-form";
import {
  aiCapability,
  copilotRouteSource,
  copilotSourceChanges,
  loadCopilot,
  newCopilotThreadId,
  sameAiCapability,
  saveCopilot,
  scopedChatMessages,
} from "../../application/integrations";
import type { ChatFailure, ChatMessage, CopilotProposal } from "../../application/integrations";
import type { Project } from "../../application/projects";
import type { Route } from "../../application/routes";
import type {
  CopilotComposer,
  CopilotDraftKind,
  CopilotMode,
  CopilotThread,
} from "../../domain/integrations";
import type { AiMode } from "../../domain/shell";
import { createChatSession } from "./chat-session";
import { completeReply, replyCitations } from "./copilot-replies";
import { useCopilotProposal } from "./use-copilot-proposal";
import { useProviderChat } from "./use-provider-chat";

import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  useAsyncStream,
  useAutosave,
  useMessages,
  useQuery,
  useRoute,
  useSettings,
} from "../shell";

type Turn = {
  readonly prompt: string;
  readonly provider: AiMode;
  readonly task: CopilotMode;
  readonly sources: readonly string[];
  readonly existing: CopilotThread | undefined;
};

export function useCopilotWorkspace(
  project: Project,
  review: boolean,
  destination: (route: Route) => void,
) {
  const catalog = useMessages().integrations;
  const text = catalog.copilot;
  const capability = computed(() => aiCapability(settings.value));
  const settings = useSettings();
  const route = useRoute();
  const options = useAsyncStream([], copilotSourceChanges(project.id));
  const mode = ref<CopilotMode>(review ? "review" : "ask");
  const draftKind = ref<CopilotDraftKind>("prd");
  const routeSource = computed(() => copilotRouteSource(route.value, project.id));
  const selected = ref<string[]>(routeSource.value ? [routeSource.value] : []);
  const revisionTarget = ref(routeSource.value ?? "");
  const availableTargets = computed(() =>
    mode.value === "revise"
      ? options.value.filter((option) => option.kind === "knowledge" && option.record.editable)
      : options.value,
  );
  const editedSources = ref(false);
  const thread = ref("");
  const instructions = ref("");
  const instructionsOpen = ref(false);
  const threads = shallowRef<readonly CopilotThread[]>([]);
  const loaded = ref(false);
  const load = useQuery(loadCopilot);
  const write = useAutosave(saveCopilot);
  const nextThread = useQuery(() => newCopilotThreadId);
  const query = useQuery(scopedChatMessages);
  const { prepare, apply, proposal, staleProposal, captureProposal, applyProposal } =
    useCopilotProposal(project.id, destination);
  const responseIssue = ref<ChatFailure>();
  const session = createChatSession(useProviderChat());
  const state = shallowRef(session.getState());
  const working = shallowRef<Turn>();
  const stopped = ref(false);
  onScopeDispose(
    session.subscribe((updated) => {
      state.value = updated;
    }),
  );
  onScopeDispose(() => {
    working.value = undefined;
    session.dispose();
  });
  watch(
    capability,
    (next, previous) => {
      if (!sameAiCapability(next, previous)) stop();
    },
    { flush: "sync" },
  );
  watch(
    routeSource,
    (source) => {
      stop();
      if (!thread.value && !editedSources.value) chooseContext(source);
    },
    { flush: "sync" },
  );
  watch(options, () => {
    if (!thread.value && !editedSources.value && !working.value) chooseContext(routeSource.value);
  });
  const form = useForm({
    defaultValues: { message: review ? text.reviewPrompt : "" },
    onSubmit({ value }) {
      if (canSend.value) void sendTurn(value.message);
    },
  });
  const message = form.useSelector((snapshot) => snapshot.values.message);
  const hasTarget = computed(() => {
    const key = revisionTarget.value;
    return (
      selected.value.includes(key) && availableTargets.value.some((source) => source.key === key)
    );
  });
  const canSend = computed(
    () =>
      capability.value.enabled &&
      loaded.value &&
      !working.value &&
      (!needsTarget(mode.value) || hasTarget.value) &&
      Boolean(message.value.trim()),
  );

  function savedThread() {
    return threads.value.find(({ id }) => id === thread.value);
  }

  function chooseContext(source: string | undefined) {
    const valid = source && options.value.some(({ key }) => key === source);
    selected.value = valid ? [source] : [];
    revisionTarget.value = valid ? source : "";
  }
  const citations = computed(() => replyCitations(savedThread()?.messages ?? [], options.value));

  function restorePrompt(prompt: string) {
    if (!form.getFieldValue("message")) form.setFieldValue("message", prompt);
  }

  function stop() {
    const turn = working.value;
    if (!turn) return;
    working.value = undefined;
    session.reset(savedThread()?.messages);
    restorePrompt(turn.prompt);
    stopped.value = true;
  }

  async function sendTurn(prompt: string) {
    const turn: Turn = {
      prompt,
      provider: capability.value.mode,
      task: mode.value,
      sources: selected.value,
      existing: savedThread(),
    };
    working.value = turn;
    stopped.value = false;
    responseIssue.value = undefined;
    try {
      await executeTurn(turn);
    } finally {
      if (working.value === turn) working.value = undefined;
    }
  }

  async function executeTurn(turn: Turn) {
    const prepared = await prepareTurn(turn);
    if (!prepared || working.value !== turn) return;
    const { id, proposed, messages } = prepared;
    const reply = await callProvider(turn, messages, proposed);
    if (working.value !== turn) return;
    const content = acceptedReply(reply, proposed);
    if (content === undefined) {
      restorePrompt(turn.prompt);
      return;
    }
    saveReply(id, turn, content);
  }

  async function prepareTurn(turn: Turn) {
    const proposed = await proposalContext(turn);
    if (proposed === false || working.value !== turn) return;
    const scoped = await scopedMessages(turn, proposed);
    if (scoped._tag !== "success" || working.value !== turn) return;
    const id = turn.existing?.id ?? (await newThreadId());
    if (id) return { id, proposed, messages: scoped.value };
  }

  function acceptedReply(reply: string | undefined, proposed: CopilotProposal | undefined) {
    if (reply === undefined || !proposed) return reply;
    if (captureProposal(proposed, reply)) return text.proposalReady;
    responseIssue.value = "invalid-proposal";
    session.reset(savedThread()?.messages);
  }

  function scopedMessages(turn: Turn, proposed: CopilotProposal | undefined) {
    return query.run({
      projectId: project.id,
      provider: turn.provider,
      prompt: turn.prompt,
      mode: turn.task,
      selected: turn.sources,
      history: turn.existing?.messages ?? [],
      instructions: instructions.value,
      ...(proposed && {
        proposal: {
          kind: proposed.kind,
          ...(proposed.base && { target: "knowledge:" + proposed.base.id }),
        },
      }),
      ...(turn.task === "review" && revisionTarget.value && { reviewTarget: revisionTarget.value }),
    });
  }

  async function newThreadId() {
    const result = await nextThread.run();
    return result._tag === "success" ? result.value : undefined;
  }

  function callProvider(
    turn: Turn,
    messages: readonly ChatMessage[],
    proposed: CopilotProposal | undefined,
  ) {
    session.reset(turn.existing?.messages);
    const purpose = turn.task === "draft" ? "copilot-draft" : "copilot-revise";
    const sending = session.send(turn.provider, turn.prompt, {
      messages,
      ...(proposed && { purpose }),
    });
    form.setFieldValue("message", "");
    return sending;
  }

  function saveReply(id: string, turn: Turn, content: string) {
    const { prompt, sources } = turn;
    const saved: CopilotThread = {
      id,
      selected: sources,
      messages: completeReply(turn.existing?.messages ?? [], prompt, content, sources),
      mode: mode.value,
      target: revisionTarget.value,
    };
    threads.value = [saved, ...threads.value.filter((entry) => entry.id !== id)];
    thread.value = id;
    session.reset(saved.messages);
    void write.run(project.id, { thread: saved, composer: composer() });
  }

  async function proposalContext(turn: Turn) {
    if (turn.task === "ask" || turn.task === "review") return;
    const result = await prepare.run({
      projectId: project.id,
      kind: draftKind.value,
      provider: turn.provider,
      selected: turn.sources,
      ...(turn.task === "revise" && { revise: revisionTarget.value }),
    });
    return result._tag === "success" ? result.value : false;
  }

  function composer() {
    return {
      activeId: thread.value,
      prompt: message.value,
      mode: mode.value,
      selected: selected.value,
      locked: editedSources.value,
      kind: draftKind.value,
      target: revisionTarget.value,
    };
  }
  function restoreComposer(draft: CopilotComposer) {
    thread.value = draft.activeId;
    mode.value = draft.mode;
    draftKind.value = draft.kind ?? "prd";
    revisionTarget.value = draft.target ?? "";
    selected.value = [...draft.selected];
    editedSources.value = draft.locked;
    form.setFieldValue("message", draft.prompt);
    session.reset(savedThread()?.messages);
  }

  function matchesEntry(draft: CopilotComposer) {
    if (!review || !routeSource.value) return true;
    return draft.mode === "review" && draft.target === routeSource.value;
  }

  void load.run(project.id).then((result) => {
    if (result._tag !== "success") return;
    const stored = result.value;
    threads.value = stored?.threads ?? [];
    instructions.value = stored?.instructions ?? "";
    if (stored?.composer && matchesEntry(stored.composer)) restoreComposer(stored.composer);
    loaded.value = true;
  });

  function saveComposer() {
    if (loaded.value) void write.run(project.id, { composer: composer() });
  }

  function updateSources(key: string, checked: boolean) {
    stop();
    editedSources.value = true;
    selected.value = checked ? [...selected.value, key] : selected.value.filter((id) => id !== key);
    if (!checked && revisionTarget.value === key) revisionTarget.value = "";
    if (checked && key === routeSource.value) selectContextTarget();
    saveComposer();
  }

  function showThread(id: string) {
    stop();
    proposal.value = undefined;
    const saved = threads.value.find((entry) => entry.id === id);
    thread.value = id;
    if (saved) {
      selected.value = [...saved.selected];
      mode.value = saved.mode ?? mode.value;
      revisionTarget.value = saved.target ?? saved.selected[0] ?? "";
    } else chooseContext(routeSource.value);
    editedSources.value = Boolean(saved);
    session.reset(saved?.messages);
    form.setFieldValue("message", "");
    saveComposer();
  }
  function chooseMode(task: CopilotMode) {
    stop();
    mode.value = task;
    selectContextTarget();
    saveComposer();
  }
  function selectContextTarget() {
    const source = routeSource.value;
    if (!source || !needsTarget(mode.value) || revisionTarget.value) return;
    if (selected.value.includes(source) && availableTargets.value.some(({ key }) => key === source))
      revisionTarget.value = source;
  }
  function chooseDraftKind(kind: CopilotDraftKind) {
    stop();
    draftKind.value = kind;
    saveComposer();
  }
  function chooseTarget(target: string) {
    stop();
    revisionTarget.value = target;
    if (target && !selected.value.includes(target)) selected.value = [...selected.value, target];
    editedSources.value = true;
    saveComposer();
  }
  const failure = computed(() => {
    const current = state.value.failure;
    if (current) return catalog.chatFailures[current.reason](catalog.providers[current.provider]);
    if (responseIssue.value)
      return catalog.chatFailures[responseIssue.value](catalog.providers[capability.value.mode]);
    return (
      apply.message.value ??
      prepare.message.value ??
      query.message.value ??
      load.message.value ??
      write.message.value
    );
  });
  const missingExecutable = computed(() => {
    const current = state.value.failure;
    return current?.reason === "provider-not-found" && current.provider !== "demo"
      ? current.provider
      : undefined;
  });
  return {
    catalog,
    text,
    capability,
    options,
    mode,
    draftKind,
    selected,
    revisionTarget,
    availableTargets,
    thread,
    threads,
    instructions,
    instructionsOpen,
    write,
    form,
    state,
    working,
    stopped,
    proposal,
    staleProposal,
    apply,
    citations,
    failure,
    missingExecutable,
    saveComposer,
    updateSources,
    showThread,
    chooseMode,
    chooseDraftKind,
    chooseTarget,
    applyProposal,
    stop,
    canSend,
  };
}

function needsTarget(mode: CopilotMode) {
  return mode === "review" || mode === "revise";
}
