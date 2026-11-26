<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { computed, reactive, ref, useId, watch } from "vue";
import { projectSearchMatches, searchProjectRecords } from "../../../application/projects";
import type { Project, ProjectId } from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { useMessages, useModal } from "../../shell";
import { leafModalUi } from "../overlay-ui";
import { useProjectSearchSources } from "../search-sources";
import type { NavigationGroup } from "../sections";

const { project, groups, afterClose } = defineProps<{
  readonly project: Project;
  readonly groups: readonly NavigationGroup[];
  readonly afterClose: () => void;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ select: [route: Route] }>();
const text = useMessages().projects.search;
type Filter = "all" | "sections" | "records";
type SearchState = { query: string; filter: Filter; scroll: number; selected: number };
const memories = new Map<ProjectId, SearchState>();
const results = ref<HTMLElement>();
const queryId = useId();
const state = computed(() => {
  let memory = memories.get(project.id);
  if (!memory) {
    memory = reactive<SearchState>({ query: "", filter: "all", scroll: 0, selected: 0 });
    memories.set(project.id, memory);
  }
  return memory;
});

const contributors = useProjectSearchSources();

type Match = {
  readonly label: string;
  readonly displayId?: string;
  readonly route: Route;
  readonly group: "sections" | "records";
  readonly key: string;
};
const matches = computed((): readonly Match[] => {
  const { filter, query } = state.value;
  const sections =
    filter === "records"
      ? []
      : groups.flatMap(({ label, items }) =>
          items
            .filter((item) => projectSearchMatches(query, item.label, label))
            .map((item) => ({
              label: item.label,
              route: item.route,
              group: "sections" as const,
              key: item.route.name,
            })),
        );
  const records =
    filter === "sections"
      ? []
      : searchProjectRecords(project.id, query, contributors).map((entry) => ({
          label: entry.title,
          ...(entry.displayId && { displayId: entry.displayId }),
          route: entry.route,
          group: "records" as const,
          key: JSON.stringify([entry.kind, entry.recordId]),
        }));
  return [...sections, ...records];
});

const modal = useModal(open, afterClose);
watch(
  [open, results],
  ([visible, list]) => {
    if (visible && list) list.scrollTop = state.value.scroll;
  },
  { flush: "post" },
);

function rememberScroll(event: Event) {
  const list = results.value;
  if (open.value && list && event.currentTarget === list) state.value.scroll = list.scrollTop;
}

function resetPosition() {
  state.value.selected = 0;
  state.value.scroll = 0;
  if (results.value) results.value.scrollTop = 0;
}

function updateQuery(value: string) {
  state.value.query = value;
  resetPosition();
}

function press(event: KeyboardEvent) {
  const entries = matches.value;
  const selected = state.value.selected;
  if (event.key === "Enter") {
    const entry = entries[selected];
    if (entry) {
      event.preventDefault();
      emit("select", entry.route);
    }
  }
  if (["ArrowUp", "ArrowDown"].includes(event.key) && entries.length > 0) {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    state.value.selected = (selected + step + entries.length) % entries.length;
    const controls = results.value?.querySelectorAll("button");
    controls?.item(state.value.selected)?.scrollIntoView({ block: "nearest" });
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="text.title(project.name)" :content="modal" :ui="leafModalUi">
    <template #body>
      <div class="pe:grid pe:gap-3">
        <label :for="queryId" class="pe:text-sm pe:font-medium">{{ text.query }}</label>
        <UInput
          :id="queryId"
          :model-value="state.query"
          :aria-label="text.open"
          type="search"
          data-autofocus
          class="pe:w-full"
          @update:model-value="updateQuery"
          @keydown="press"
        />
        <select
          v-model="state.filter"
          :aria-label="text.filter"
          class="pe:w-fit pe:max-w-full pe:bg-default"
          @change="resetPosition"
        >
          <option value="all">{{ text.all }}</option>
          <option value="sections">{{ text.sections }}</option>
          <option value="records">{{ text.records }}</option>
        </select>
        <ol
          ref="results"
          class="pe:grid pe:max-h-[min(45vh,20rem)] pe:gap-1 pe:overflow-auto"
          @scroll="rememberScroll"
        >
          <li v-for="(entry, index) in matches" :key="entry.key">
            <UButton
              type="button"
              color="neutral"
              :variant="index === state.selected ? 'soft' : 'ghost'"
              class="pe:w-full pe:justify-between pe:text-left"
              @click="emit('select', entry.route)"
            >
              <span
                >{{ entry.label }}
                <small v-if="entry.displayId" class="pe:text-muted">{{
                  entry.displayId
                }}</small></span
              >
              <small class="pe:text-muted">{{ text[entry.group] }}</small>
            </UButton>
          </li>
        </ol>
        <p v-if="matches.length === 0" role="status" class="pe:text-sm pe:text-muted">
          {{ text.empty }}
        </p>
      </div>
    </template>
  </UModal>
</template>
