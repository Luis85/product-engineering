<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import {
  featureRequestsChanges,
  featureRequestsSnapshot,
  PROJECT_REVIEWS,
  readReviewWorkspace,
  reviewRegisterChanges,
  requestInputChanges,
  reviewsRoute,
} from "../../application/feature-requests";
import type {
  ReviewRegisterSnapshot,
  ReviewsRoute,
  ReviewWorkspace,
} from "../../application/feature-requests";
import { projectChanges, projectSnapshot } from "../../application/projects";
import { useRestoreWorkspacePosition } from "../projects";
import {
  useAsyncStream,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
  useStream,
} from "../shell";
import ReviewDecision from "./ReviewDecision.vue";
import ReviewRegister from "./ReviewRegister.vue";

const { route } = defineProps<{ readonly route: ReviewsRoute }>();
const project = route.projectId;
const text = useMessages()["feature-requests"];
const navigate = useNavigate();
const { back } = useHistory();
const { history } = useRouting();
const projects = useStream(projectSnapshot, projectChanges);
const requests = useStream(featureRequestsSnapshot(project), featureRequestsChanges(project));
const register = useAsyncStream<ReviewRegisterSnapshot, never>(
  { rows: [], ready: false, failed: false },
  reviewRegisterChanges(project),
);
const registered = computed(() => projects.value.projects.some(({ id }) => id === project));
const review = useQuery(readReviewWorkspace);
const settled = shallowRef<ReviewWorkspace>();
const checked = shallowRef(false);
const waitingHeading = useTemplateRef<HTMLElement>("waitingReviewHeading");
const focusRequested = shallowRef(false);
const changes = useAsyncStream<symbol | undefined, never>(undefined, requestInputChanges(project));
const selectedRecord = computed(() => {
  const id = route.selection?.requestId;
  const record = requests.value.records.find((entry) => entry.id === id);
  return record && JSON.stringify(record);
});
const selected = computed(() =>
  settled.value?.record.id === route.selection?.requestId &&
  settled.value?.entry.revision === route.selection?.revision
    ? settled.value
    : undefined,
);
async function refresh() {
  const selection = route.selection;
  if (!registered.value || !selection) return;
  const result = await review.run(project, selection.requestId, selection.revision);
  if (result._tag === "interrupted") return;
  focusRequested.value = waitingHeading.value?.matches(":focus") ?? false;
  settled.value = result._tag === "success" ? result.value : undefined;
  checked.value = true;
}
watch(
  () => route.selection,
  () => {
    checked.value = false;
  },
);
watch([() => route.selection, registered, selectedRecord, changes], () => void refresh(), {
  immediate: true,
});
const source = computed(() => (route.selection ? requests.value : register.value));
const unavailable = computed(() =>
  Boolean(projects.value.failed || source.value.failed || review.message.value),
);
const loading = computed(() => {
  if (!projects.value.ready || !source.value.ready) return true;
  return Boolean(registered.value && route.selection && !checked.value);
});
const status = computed(() => {
  if (unavailable.value) return { text: text.reviews.unavailable, alert: true };
  if (loading.value) return { text: text.reviews.loading };
  if (!registered.value || route.selection) return { text: text.reviews.missing };
  if (!register.value.rows.length) return { text: text.reviews.empty };
  return undefined;
});

function close() {
  const previous = history.value.back.at(-1);
  if (previous?.name === PROJECT_REVIEWS && previous.projectId === project && !previous.selection)
    return back();
  return navigate(reviewsRoute(project));
}

const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch([register, selected], () => restore(), { flush: "post" });
</script>

<template>
  <section
    v-if="selected"
    :key="selected.record.id + '/' + selected.entry.revision"
    class="pe-feature-requests"
    data-testid="request-detail"
  >
    <UButton
      type="button"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      :label="text.reviews.open"
      class="pe:justify-self-start pe:p-0"
      data-testid="review-return"
      @click="close"
    />
    <ReviewDecision :review="selected" :focus-requested="focusRequested" @refresh="refresh" />
  </section>
  <section v-else class="pe-feature-requests" data-testid="review-register">
    <header class="pe:grid pe:min-w-0 pe:gap-1">
      <h1 ref="waitingReviewHeading" tabindex="-1" class="pe:text-2xl pe:font-semibold">
        {{ text.reviews.title }}
      </h1>
      <p v-if="!route.selection" class="pe:text-sm pe:text-muted">{{ text.reviews.intro }}</p>
    </header>
    <p
      v-if="status"
      class="pe-request-empty"
      :role="status.alert ? 'alert' : 'status'"
      data-testid="review-status"
    >
      {{ status.text }}
    </p>
    <ReviewRegister v-else :rows="register.rows" />
    <UButton
      v-if="route.selection"
      type="button"
      variant="link"
      :label="text.reviews.open"
      class="pe:justify-self-start pe:p-0"
      data-testid="review-return"
      @click="close"
    />
  </section>
</template>
