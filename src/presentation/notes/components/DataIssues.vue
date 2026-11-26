<script setup lang="ts">
import {
  describeUnindexedIssue,
  unindexedChanges,
  unindexedSnapshot,
} from "../../../application/notes";
import { ErrorNotice, useMessages, useStream } from "../../shell";
import { useIndexStatus } from "../use-record-screen";
import OpenNoteButton from "./OpenNoteButton.vue";

const messages = useMessages().notes;
const index = useStream(unindexedSnapshot, unindexedChanges);
const { failure, loading, retry } = useIndexStatus(() => index.value);
</script>

<template>
  <section
    :aria-label="messages.unindexed.label"
    :aria-busy="!index.ready && !index.failure"
    class="pe:grid pe:min-w-0 pe:gap-3"
  >
    <ErrorNotice v-if="failure" :message="failure" :handlers="{ retry }" />
    <p v-if="loading" role="status" class="pe:text-sm pe:text-muted">
      {{ messages.unindexed.loading }}
    </p>
    <p
      v-else-if="index.ready && !index.failure && index.notes.length === 0"
      class="pe:text-sm pe:text-muted"
    >
      {{ messages.unindexed.empty }}
    </p>
    <ul
      v-if="index.notes.length > 0"
      data-testid="data-issues-list"
      class="pe:divide-y pe:divide-default"
    >
      <li
        v-for="note in index.notes"
        :key="note.path"
        class="pe:flex pe:flex-wrap pe:items-center pe:justify-between pe:gap-2 pe:py-3"
      >
        <div class="pe:min-w-0 pe:flex-1 pe:text-sm">
          <p class="pe:font-medium pe:break-all">{{ note.path }}</p>
          <p class="pe:text-muted">{{ describeUnindexedIssue(note.issue, messages) }}</p>
        </div>
        <OpenNoteButton :path="note.path" />
      </li>
    </ul>
  </section>
</template>
