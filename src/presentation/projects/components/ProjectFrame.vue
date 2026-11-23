<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import USlideover from "@nuxt/ui/components/Slideover.vue";
import { computed, nextTick, onScopeDispose, ref, watch } from "vue";
import {
  PROJECT_RECORD,
  projectAdministrationRoute,
  projectChanges,
  projectOverviewRoute,
  projectsRoute,
  projectSnapshot,
} from "../../../application/projects";
import type { Project } from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { PRODUCT_NAME } from "../../../application/shell";
import {
  frameMenu,
  RouteOutlet,
  useHistory,
  useMessages,
  useModal,
  useNavigate,
  useRoute,
  useRouting,
  useStream,
} from "../../shell";
import { useProjectRecordScreens } from "../record-screens";
import { provideProjectSearchSources } from "../search-sources";
import type { ProjectSearchSource } from "../search-sources";
import { provideProjectTemplateFactories } from "../template-factories";
import type { ProjectTemplateFactory } from "../template-factories";
import { projectGroups } from "../sections";
import { useWorkspacePosition } from "../workspace-position";
import ProjectCreateDialog from "./ProjectCreateDialog.vue";
import ProjectCopilot from "./ProjectCopilot.vue";
import ProjectNavigation from "./ProjectNavigation.vue";
import ProjectPickerDialog from "./ProjectPickerDialog.vue";
import ProjectSearchDialog from "./ProjectSearchDialog.vue";

const { sources, templates } = defineProps<{
  readonly sources: readonly ProjectSearchSource[];
  readonly templates: readonly ProjectTemplateFactory[];
}>();
provideProjectTemplateFactories(templates);
const catalog = useMessages();
const text = catalog.projects;
const route = useRoute();
const navigate = useNavigate();
const { definition, history, navigation } = useRouting();
const { canGoBack, canGoForward, back, forward } = useHistory();
const snapshot = useStream(projectSnapshot, projectChanges);
provideProjectSearchSources((projectId) => {
  const project = snapshot.value.projects.find(({ id }) => id === projectId);
  return project
    ? [
        {
          projectId,
          recordId: projectId,
          kind: "project",
          title: project.name,
          route: projectAdministrationRoute(projectId),
        },
      ]
    : [];
}, sources);
const activeProject = computed(() => {
  const current = route.value;
  const scoped =
    "projectId" in current ? current : history.value.back.findLast((entry) => "projectId" in entry);
  return scoped && "projectId" in scoped
    ? snapshot.value.projects.find(({ id }) => id === scoped.projectId)
    : undefined;
});
const extras = frameMenu(definition).map((entry) => ({ ...entry, label: entry.label(catalog) }));
const groups = computed(() => projectGroups(catalog, activeProject.value?.id, extras));
const recordScreen = useProjectRecordScreens();
const section = computed(() => {
  const current = route.value;
  return current.name === PROJECT_RECORD
    ? (recordScreen(current.reference.kind)?.section ?? current.name)
    : current.name;
});
const breadcrumb = computed(() => {
  if (!activeProject.value) return text.title;
  const active = groups.value
    .flatMap(({ items }) => items)
    .find((entry) => entry.route.name === section.value);
  return active?.label ?? text.overview;
});

const collapsed = ref(navigation.railCollapsed());
onScopeDispose(
  navigation.onRailChange((value) => {
    collapsed.value = value;
  }),
);
function toggleRail() {
  navigation.setRailCollapsed(!collapsed.value);
}
const rail = computed(() =>
  collapsed.value
    ? {
        name: text.expand,
        icon: "i-lucide-panel-left-open",
        columns: "pe:@min-[780px]:grid-cols-[3.5rem_minmax(0,1fr)]",
      }
    : {
        name: text.collapse,
        icon: "i-lucide-panel-left-close",
        columns: "pe:@min-[780px]:grid-cols-[14rem_minmax(0,1fr)]",
      },
);
const drawer = ref(false);
const picker = ref(false);
const creating = ref(false);
const search = ref(false);
const frame = ref<HTMLElement>();
const content = ref<HTMLElement>();
const searchButton = ref<{ $el: HTMLElement }>();
const position = useWorkspacePosition(frame, content);
let pickerTrigger: HTMLElement | undefined;
let drawerTrigger: HTMLElement | undefined;
let searchTrigger: HTMLElement | undefined;
let searchDestination: Route | undefined;
let skipPickerFocus = false;

const drawerModal = useModal(drawer, () => drawerTrigger?.focus({ preventScroll: true }));
function restorePickerFocus() {
  if (skipPickerFocus) return;
  const target = pickerTrigger?.isConnected ? pickerTrigger : drawerTrigger;
  target?.focus({ preventScroll: true });
}

function openPicker(trigger?: HTMLElement) {
  skipPickerFocus = false;
  pickerTrigger = trigger;
  picker.value = true;
}

const requestedSearch = ref(false);
onScopeDispose(
  navigation.onSignal("project-search", () => {
    requestedSearch.value = true;
  }),
);
watch(
  [requestedSearch, () => snapshot.value.ready],
  ([requested, ready]) => {
    if (!requested || !ready) return;
    requestedSearch.value = false;
    if (activeProject.value) openSearch();
    else openPicker();
  },
  { immediate: true },
);

function openDrawer(event: MouseEvent) {
  drawerTrigger = event.currentTarget as HTMLElement;
  drawer.value = true;
}

async function openCreate() {
  skipPickerFocus = true;
  picker.value = false;
  drawer.value = false;
  await nextTick();
  if (await navigation.confirmProjectCreation(projectsRoute)) creating.value = true;
}

function cancelCreate() {
  skipPickerFocus = false;
  picker.value = true;
  creating.value = false;
}

function openSearch(trigger: HTMLElement | undefined = searchButton.value?.$el) {
  if (!activeProject.value) return;
  searchTrigger = trigger;
  searchDestination = undefined;
  search.value = true;
}

function restoreSearchFocus() {
  if (!searchDestination) searchTrigger?.focus({ preventScroll: true });
  else if (definition.equals(searchDestination, route.value)) position.focusHeading();
}

async function selectSearchResult(destination: Route) {
  const changed = !definition.equals(route.value, destination);
  if (changed) position.rememberOrigin(searchTrigger);
  const result = navigate(destination);
  if (result === false) {
    position.rememberOrigin(undefined);
    return;
  }
  searchDestination = changed ? destination : undefined;
  search.value = false;
  if (!(await result)) {
    position.rememberOrigin(undefined);
  }
}

async function select(destination: Route) {
  const restoreToContent = picker.value || creating.value || drawer.value;
  const result = navigate(destination);
  if (result === false) return;
  if (restoreToContent) {
    skipPickerFocus = true;
    picker.value = false;
    creating.value = false;
    drawer.value = false;
  }
  if (!(await result)) return;
  if (restoreToContent) {
    await nextTick();
    position.focusHeading();
  }
}

function switchProject(project: Project) {
  return select(projectOverviewRoute(project.id));
}
</script>

<template>
  <div
    ref="frame"
    data-testid="app-frame"
    :lang="catalog.shell.language"
    class="pe:@container pe:min-w-0"
  >
    <header
      class="pe:flex pe:min-w-0 pe:items-center pe:gap-2 pe:border-b pe:border-default pe:px-3 pe:py-2 pe:@min-[780px]:px-5"
    >
      <UButton
        :aria-label="text.openNavigation"
        :aria-expanded="drawer"
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-lucide-menu"
        class="pe:@min-[780px]:hidden"
        @click="openDrawer"
      />
      <strong class="pe:hidden pe:shrink-0 pe:@min-[780px]:block">{{ PRODUCT_NAME }}</strong>
      <div class="pe:min-w-0 pe:flex-1 pe:truncate pe:text-sm" data-testid="project-breadcrumb">
        <span v-if="activeProject" class="pe:text-muted">{{ activeProject.name }} / </span>
        <span class="pe:font-medium">{{ breadcrumb }}</span>
      </div>
      <UButton
        v-if="activeProject"
        ref="searchButton"
        :aria-label="text.search.open"
        :title="text.search.open"
        icon="i-lucide-search"
        variant="outline"
        color="neutral"
        type="button"
        class="pe:shrink-0"
        data-pe-focus-key="project-search"
        @click="openSearch($event.currentTarget as HTMLElement)"
        ><span class="pe:hidden pe:@min-[780px]:inline">{{ text.search.open }}</span></UButton
      >
      <div
        v-if="canGoBack || canGoForward"
        data-testid="frame-history"
        class="pe:flex pe:shrink-0 pe:gap-1"
      >
        <UButton
          :aria-label="catalog.shell.frame.back"
          :aria-disabled="!canGoBack"
          icon="i-lucide-arrow-left"
          type="button"
          color="neutral"
          size="sm"
          variant="ghost"
          @click="back"
        />
        <UButton
          :aria-label="catalog.shell.frame.forward"
          :aria-disabled="!canGoForward"
          icon="i-lucide-arrow-right"
          type="button"
          color="neutral"
          size="sm"
          variant="ghost"
          @click="forward"
        />
      </div>
      <ProjectCopilot v-if="activeProject" :key="activeProject.id" />
    </header>
    <div class="pe:grid pe:min-w-0" :class="rail.columns">
      <aside
        data-testid="project-rail"
        class="pe:hidden pe:min-w-0 pe:content-start pe:gap-4 pe:border-r pe:border-default pe:bg-muted pe:p-3 pe:@min-[780px]:grid"
        :class="{ 'pe:px-2': collapsed }"
      >
        <UButton
          :aria-label="rail.name"
          :title="rail.name"
          :aria-expanded="!collapsed"
          :icon="rail.icon"
          type="button"
          color="neutral"
          variant="ghost"
          class="pe:justify-self-end"
          @click="toggleRail"
        />
        <ProjectNavigation
          :project="activeProject"
          :groups="groups"
          :section="section"
          :collapsed="collapsed"
          @pick="openPicker"
          @select="select"
        />
      </aside>
      <section
        ref="content"
        :aria-label="catalog.shell.frame.content"
        tabindex="-1"
        class="pe:min-w-0 pe:px-4 pe:py-5 pe:@min-[780px]:px-6"
        data-testid="project-content"
      >
        <RouteOutlet />
      </section>
    </div>
    <USlideover
      v-model:open="drawer"
      :title="text.navigation"
      :content="drawerModal"
      side="left"
      :ui="{ content: 'pe:max-w-[18rem] pe:sm:max-w-[18rem]' }"
    >
      <template #body>
        <div class="pe:grid pe:content-start pe:gap-4">
          <ProjectNavigation
            :project="activeProject"
            :groups="groups"
            :section="section"
            :collapsed="false"
            @pick="openPicker"
            @select="select"
          />
        </div>
      </template>
    </USlideover>
    <ProjectPickerDialog
      v-model:open="picker"
      :projects="snapshot.projects"
      :current="activeProject"
      :after-close="restorePickerFocus"
      @create="openCreate"
      @select="switchProject"
    />
    <ProjectCreateDialog v-if="creating" @dismiss="cancelCreate" @created="switchProject" />
    <ProjectSearchDialog
      v-if="activeProject"
      v-model:open="search"
      :project="activeProject"
      :groups="groups"
      :after-close="restoreSearchFocus"
      @select="selectSearchResult"
    />
  </div>
</template>
