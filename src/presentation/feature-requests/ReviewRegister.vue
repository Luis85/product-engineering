<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { reviewsRoute } from "../../application/feature-requests";
import type { ReviewRegisterRow } from "../../application/feature-requests";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate } from "../shell";

defineProps<{ readonly rows: readonly ReviewRegisterRow[] }>();
const text = useMessages()["feature-requests"];
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();

async function open(event: MouseEvent, { projectId, requestId, revision }: ReviewRegisterRow) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(reviewsRoute(projectId, { requestId, revision })))) remember(undefined);
}
</script>

<template>
  <table class="pe-request-register" :aria-label="text.reviews.title">
    <thead data-testid="review-register-headings">
      <tr>
        <th scope="col">{{ text.reviews.request }}</th>
        <th scope="col">{{ text.reviews.business }}</th>
        <th scope="col">{{ text.reviews.technical }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key" :data-review-row="row.displayId">
        <td>
          <div class="pe-request-identity">
            <UButton
              type="button"
              variant="link"
              class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
              :data-pe-focus-key="'review-row-' + row.key"
              :label="row.title"
              @click="open($event, row)"
            />
            <div class="pe-request-row-meta">{{ row.displayId }} · {{ row.runId }}</div>
          </div>
        </td>
        <td data-testid="review-business">
          <span class="pe-request-field-label">{{ text.reviews.business }}</span>
          <div class="pe-request-column">
            <span class="pe-request-state">{{ text.states[row.business] }}</span>
            <span
              v-if="row.stale"
              class="pe-request-state pe-review-stale"
              data-testid="review-stale"
            >
              {{ text.reviews.stale }}
            </span>
            <span v-else-if="row.stale === undefined">{{ text.reviews.baselineUnavailable }}</span>
          </div>
        </td>
        <td data-testid="review-technical">
          <span class="pe-request-field-label">{{ text.reviews.technical }}</span>
          <div class="pe-request-column">
            <span class="pe-request-state">
              {{ row.technicalApproved ? text.reviews.approved : text.reviews.pending }}
            </span>
            <span>{{ row.ciPassed ? text.reviews.ciPassed : text.reviews.ciUnavailable }}</span>
            <span v-if="row.testedCommit" class="pe-request-row-meta">
              {{ text.reviews.commit }}
              <code :title="row.testedCommit">{{ row.testedCommit.slice(0, 7) }}</code>
            </span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
