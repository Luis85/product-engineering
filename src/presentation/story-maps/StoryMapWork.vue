<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { computed, ref, shallowRef } from "vue";
import { ownerName, readBacklogItem } from "../../application/backlog";
import type { BacklogEdit, BacklogItem, BacklogSnapshot } from "../../application/backlog";
import { projectMemberChoices } from "../../application/projects";
import { storyMapWorkScope } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapCard, StoryMapWork } from "../../domain/story-maps";
import { leafModalUi } from "../projects";
import { ErrorNotice, useMessages, useModal, useQuery } from "../shell";
import StoryMapWorkEditor from "./StoryMapWorkEditor.vue";

const { map, card, backlog } = defineProps<{
  readonly map: StoryMapRecord;
  readonly card: StoryMapCard;
  readonly backlog: BacklogSnapshot;
}>();
const catalogs = useMessages();
const text = catalogs["story-maps"].work;
const backlogText = catalogs.backlog;
const scope = computed(() => storyMapWorkScope(map, card.id, backlog.items));
const open = ref(false);
const editing = ref(false);
const panel = ref<HTMLElement>();
const owned = shallowRef<StoryMapWork>();
const existing = shallowRef<BacklogEdit>();
const read = useQuery(readBacklogItem);
const team = useQuery(projectMemberChoices);
let opener: HTMLElement | undefined;
let editorTrigger: HTMLElement | undefined;
const modal = useModal(open, () => opener?.focus({ preventScroll: true }), close);
const attached = computed(() => [
  { name: text.attached, testId: "story-map-work-attached", items: scope.value.attached },
  { name: text.related, testId: "story-map-work-related", items: scope.value.related },
]);
const count = computed(() => scope.value.owned.length + scope.value.attached.length);
const empty = computed(() => !count.value && !scope.value.related.length);

function summary(work: Pick<BacklogItem, "kind" | "id" | "state" | "owner" | "parent">) {
  const owner =
    team.value.value?.find(({ id }) => id === work.owner)?.name ?? ownerName(work.owner);
  return [
    backlogText.types[work.kind],
    work.id,
    work.parent ?? text.storyOnly,
    work.state,
    owner || backlogText.unassigned,
  ]
    .filter(Boolean)
    .join(" · ");
}

function show(event: MouseEvent) {
  opener = event.currentTarget as HTMLElement;
  open.value = true;
  void team.run(map.projectId);
}

function edit(event: MouseEvent, work?: StoryMapWork) {
  editorTrigger = event.currentTarget as HTMLElement;
  owned.value = work;
  editing.value = true;
}

async function editItem(item: BacklogItem, event: MouseEvent) {
  editorTrigger = event.currentTarget as HTMLElement;
  const result = await read.run(map.projectId, item.key);
  if (result._tag !== "success" || !open.value) return;
  existing.value = result.value;
  editing.value = true;
}

function finishEdit() {
  existing.value = undefined;
  owned.value = undefined;
  editing.value = false;
  if (editorTrigger?.isConnected) editorTrigger.focus({ preventScroll: true });
  else
    panel.value
      ?.querySelector<HTMLElement>("[data-story-work-add]")
      ?.focus({ preventScroll: true });
}

function close() {
  if (!editing.value) open.value = false;
}
</script>

<template>
  <UButton
    type="button"
    variant="soft"
    color="neutral"
    size="xs"
    class="pe:justify-self-start pe:max-w-full pe:whitespace-normal"
    data-testid="story-map-work"
    :aria-label="text.forStory(card.title)"
    @click="show"
  >
    {{ text.label }}<span v-if="count"> · {{ count }}</span>
  </UButton>
  <UModal
    :open="open"
    :title="text.heading"
    :description="card.title"
    :content="modal"
    :ui="leafModalUi"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <div ref="panel" class="pe:grid pe:min-w-0 pe:gap-3">
        <UButton
          type="button"
          icon="i-lucide-plus"
          class="pe:justify-self-start"
          data-autofocus
          data-story-work-add
          data-testid="story-map-work-add"
          :label="text.add"
          @click="edit($event)"
        />
        <section
          v-if="scope.owned.length"
          data-testid="story-map-owned-work"
          :aria-label="text.storyOnly"
        >
          <h3>{{ text.storyOnly }}</h3>
          <ul class="pe:grid pe:min-w-0 pe:gap-2">
            <li v-for="work in scope.owned" :key="work.id">
              <UButton
                type="button"
                variant="link"
                class="pe:p-0 pe:wrap-anywhere pe:text-start"
                @click="edit($event, work)"
                >{{ work.title }}</UButton
              >
              <p class="pe:wrap-anywhere pe:text-sm pe:text-muted">{{ summary(work) }}</p>
            </li>
          </ul>
        </section>
        <section
          v-for="group in attached.filter(({ items }) => items.length)"
          :key="group.name"
          :data-testid="group.testId"
          :aria-label="group.name"
        >
          <h3>{{ group.name }}</h3>
          <ul class="pe:grid pe:min-w-0 pe:gap-2">
            <li v-for="item in group.items" :key="item.key">
              <UButton
                type="button"
                variant="link"
                class="pe:p-0 pe:wrap-anywhere pe:text-start"
                :loading="read.pending.value"
                @click="editItem(item, $event)"
                >{{ item.title }}</UButton
              >
              <p class="pe:wrap-anywhere pe:text-sm pe:text-muted">{{ summary(item) }}</p>
            </li>
          </ul>
        </section>
        <p v-if="empty">
          {{ text.empty }}
        </p>
        <ErrorNotice v-if="read.message.value" :message="read.message.value" />
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="pe:justify-self-end"
          :label="text.close"
          @click="close"
        />
        <StoryMapWorkEditor
          v-if="editing"
          :map="map"
          :card="card"
          :backlog="backlog"
          :parents="scope.parents"
          :owned="owned"
          :existing="existing"
          @dismiss="finishEdit"
        />
      </div>
    </template>
  </UModal>
</template>
