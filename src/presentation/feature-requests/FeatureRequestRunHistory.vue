<script setup lang="ts">
import type { FeatureRequestRevision } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { events } = defineProps<{ readonly events: FeatureRequestRevision["events"] }>();
const { factory } = useMessages()["feature-requests"];
</script>

<template>
  <details v-if="events.length" class="pe-request-disclosure" data-testid="request-run-history">
    <summary>{{ factory.eventHistory }}</summary>
    <ol>
      <li v-for="event in events" :key="event.id" class="pe:py-1">
        {{ factory.attempt(event.attempt) }} · {{ factory.event[event.kind] }}
        <p
          v-if="event.kind === 'reply' || event.kind === 'scope-change'"
          class="pe:whitespace-pre-wrap"
        >
          {{ event.reply }}
        </p>
        <p v-else-if="event.kind === 'question'" class="pe:whitespace-pre-wrap">
          {{ event.scope }}
        </p>
      </li>
    </ol>
  </details>
</template>
