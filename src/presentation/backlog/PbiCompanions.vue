<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { computed, ref, shallowRef, useId } from "vue";
import {
  companionKinds,
  ownerName,
  pbiCompanions,
  readBacklogItem,
} from "../../application/backlog";
import type {
  BacklogEdit,
  BacklogItem,
  BacklogSnapshot,
  CompanionKind,
} from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { leafModalUi } from "../projects";
import { ErrorNotice, useMessages, useModal, useQuery } from "../shell";
import BacklogEditor from "./BacklogEditor.vue";

const { project, item, snapshot } = defineProps<{
  readonly project: ProjectId;
  readonly item: BacklogItem;
  readonly snapshot: BacklogSnapshot;
}>();
const text = useMessages().backlog;
const chooserId = useId();
const icons = {
  TASK: "i-lucide-check",
  ISS: "i-lucide-info",
  Q: "i-lucide-circle-help",
  BUG: "i-lucide-flag",
} satisfies Record<CompanionKind, string>;
const read = useQuery(readBacklogItem);
const children = computed(() => pbiCompanions(snapshot.items, item));
const chooserOpen = ref(false);
const editor = ref<BacklogKind>();
const entry = shallowRef<BacklogEdit>();
let trigger: HTMLElement | undefined;
let nextCompanion: CompanionKind | undefined;
const chooser = useModal(
  chooserOpen,
  () => {
    editor.value = nextCompanion;
    if (!nextCompanion) trigger?.focus({ preventScroll: true });
    nextCompanion = undefined;
  },
  () => {
    chooserOpen.value = false;
  },
);

function summary(child: BacklogItem) {
  return [
    text.types[child.kind],
    child.id,
    child.priority || text.unset,
    ownerName(child.owner) || text.unassigned,
    child.state || text.unset,
  ]
    .filter(Boolean)
    .join(" · ");
}

function choose(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  chooserOpen.value = true;
}

function create(kind: CompanionKind) {
  nextCompanion = kind;
  chooserOpen.value = false;
}

async function edit(key: string, event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  const result = await read.run(project, key);
  if (result._tag !== "success" || result.value.item.parent !== item.key) return;
  entry.value = result.value;
  editor.value = result.value.item.kind;
}

function dismiss(reason?: "native-note") {
  editor.value = undefined;
  entry.value = undefined;
  if (!reason) trigger?.focus({ preventScroll: true });
}
</script>

<template>
  <section class="pe:grid pe:min-w-0 pe:gap-3" :aria-label="text.pbiTabs.companions">
    <div class="pe-backlog-actions pe:justify-between">
      <h2 class="pe:font-semibold">{{ text.pbiTabs.companions }}</h2>
      <UButton
        type="button"
        data-testid="pbi-add-companion"
        :label="text.companions.add"
        @click="choose"
      />
    </div>
    <p class="pe:text-muted" data-testid="pbi-companion-count">
      {{ text.companions.count(children.open, children.total) }}
    </p>
    <p v-if="!children.total">{{ text.companions.empty }}</p>
    <ul v-else class="pe:grid pe:gap-2" data-testid="pbi-companion-list">
      <li
        v-for="child in children.items"
        :key="child.key"
        class="pe:grid pe:gap-1 pe:rounded-md pe:border pe:border-default pe:p-3"
        :data-pbi-companion="child.id"
      >
        <UButton
          type="button"
          variant="link"
          class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
          :disabled="child.conflict"
          :label="child.title"
          @click="edit(child.key, $event)"
        />
        <span class="pe:text-xs pe:wrap-anywhere pe:text-muted">{{ summary(child) }}</span>
      </li>
    </ul>
    <ErrorNotice v-if="read.message.value" :message="read.message.value" />
  </section>
  <UModal
    v-model:open="chooserOpen"
    :title="text.companions.add"
    :description="text.companions.context(item.key, item.title)"
    :content="chooser"
    :ui="{ ...leafModalUi, description: 'pe:wrap-anywhere' }"
  >
    <template #body>
      <div class="pe:grid pe:grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] pe:gap-2">
        <UButton
          v-for="kind in companionKinds"
          :key="kind"
          type="button"
          variant="soft"
          class="pe-pbi-companion-choice pe:flex pe:min-w-0 pe:items-start pe:text-start pe:whitespace-normal"
          :aria-labelledby="chooserId + '-label-' + kind"
          :aria-describedby="chooserId + '-purpose-' + kind"
          :data-testid="'pbi-companion-' + kind"
          :data-autofocus="kind === 'TASK' || undefined"
          @click="create(kind)"
        >
          <UIcon :name="icons[kind]" aria-hidden="true" class="pe:size-5 pe:shrink-0" />
          <span class="pe:grid pe:min-w-0 pe:gap-0.5 pe:wrap-anywhere">
            <strong :id="chooserId + '-label-' + kind">{{ text.companions.labels[kind] }}</strong>
            <span :id="chooserId + '-purpose-' + kind" class="pe:text-xs">{{
              text.companions.purpose[kind]
            }}</span>
          </span>
        </UButton>
      </div>
    </template>
  </UModal>
  <BacklogEditor
    v-if="editor && snapshot.base"
    :project="project"
    :base="snapshot.base"
    :items="snapshot.items"
    :kind="editor"
    :edit="entry"
    :fixed-parent="item.key"
    @dismiss="dismiss"
  />
</template>
