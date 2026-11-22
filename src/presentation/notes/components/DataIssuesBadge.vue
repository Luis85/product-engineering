<script setup lang="ts">
import { unindexedChanges, unindexedSnapshot } from "../../../application/notes";
import { useMessages, useStream } from "../../shell";

const messages = useMessages().notes.unindexed;
const index = useStream(unindexedSnapshot, unindexedChanges);
</script>

<template>
  <span
    v-if="index.notes.length > 0"
    data-testid="data-issues-badge"
    :aria-label="messages.count(index.notes.length)"
    class="pe:rounded-full pe:bg-warning/15 pe:px-1.5 pe:text-xs pe:tabular-nums"
    >{{ index.notes.length }}</span
  >
</template>
