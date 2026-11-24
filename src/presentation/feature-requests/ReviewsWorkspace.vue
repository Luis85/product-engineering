<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, watch } from "vue";
import {
  featureRequestReview,
  featureRequestsChanges,
  featureRequestsSnapshot,
  PROJECT_REVIEWS,
  reviewRegisterChanges,
  reviewsRoute,
} from "../../application/feature-requests";
import type { ReviewRegisterSnapshot, ReviewsRoute } from "../../application/feature-requests";
import { projectChanges, projectSnapshot } from "../../application/projects";
import { useRestoreWorkspacePosition } from "../projects";
import {
  useAsyncStream,
  useHistory,
  useMessages,
  useNavigate,
  useRouting,
  useStream,
} from "../shell";
import FeatureRequestEvidence from "./FeatureRequestEvidence.vue";
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
const selected = computed(() => {
  if (!registered.value || !route.selection) return undefined;
  const { requestId, revision } = route.selection;
  const record = requests.value.records.find(({ id }) => id === requestId);
  return record && featureRequestReview(record, revision);
});
const source = computed(() => (route.selection ? requests.value : register.value));
const status = computed(() => {
  if (projects.value.failed || source.value.failed)
    return { text: text.reviews.unavailable, alert: true };
  if (!projects.value.ready || !source.value.ready) return { text: text.reviews.loading };
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
    :key="selected.row.key"
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
    <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">
      {{ selected.row.title }}
    </h1>
    <p class="pe-request-row-meta">
      {{ text.revision(selected.row.displayId, selected.row.revision) }} · {{ selected.row.runId }}
    </p>
    <FeatureRequestEvidence :revision="selected.evidence" />
  </section>
  <section v-else class="pe-feature-requests" data-testid="review-register">
    <header class="pe:grid pe:min-w-0 pe:gap-1">
      <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ text.reviews.title }}</h1>
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
