<script setup lang="ts">
import type { FeatureRequestRevision } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { events, decision } = defineProps<{
  readonly events: FeatureRequestRevision["events"];
  readonly decision: FeatureRequestRevision["decision"];
}>();
const { factory, states } = useMessages()["feature-requests"];
function eventDetail(event: FeatureRequestRevision["events"][number]) {
  if (event.kind === "reply" || event.kind === "scope-change") return event.reply;
  if (event.kind === "question") return event.scope;
}
</script>

<template>
  <details
    v-if="events.length || decision"
    class="pe-request-disclosure"
    data-testid="request-run-history"
  >
    <summary>{{ factory.eventHistory }}</summary>
    <ol>
      <li v-for="event in events" :key="event.id" class="pe:py-1">
        {{ factory.attempt(event.attempt) }} · {{ factory.event[event.kind] }}
        <p v-if="eventDetail(event)" class="pe:whitespace-pre-wrap">{{ eventDetail(event) }}</p>
      </li>
      <li v-if="decision" class="pe:py-1" data-testid="request-business-history">
        {{ states[decision.decision] }} · {{ factory.attempt(decision.attempt) }}
        <p>
          <code>{{ decision.commit }}</code>
        </p>
        <p v-if="decision.explanation" class="pe:whitespace-pre-wrap">{{ decision.explanation }}</p>
      </li>
    </ol>
  </details>
</template>
