<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { DeliverableRecord } from "../../../application/backlog";
import type { KnowledgeRecord } from "../../../application/knowledge";
import { deliverableStatuses } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import DeliverableNoteCell from "./DeliverableNoteCell.vue";
import type { DeliverableRow } from "./register-rows";

const { rows, changing } = defineProps<{
  readonly rows: readonly DeliverableRow[];
  readonly changing: boolean;
}>();
const emit = defineEmits<{
  edit: [record: DeliverableRecord, event: MouseEvent, focusLink?: boolean];
  openNote: [record: DeliverableRecord, note: KnowledgeRecord, event: MouseEvent];
  createNote: [record: DeliverableRecord, event: MouseEvent];
  status: [record: DeliverableRecord, event: Event];
}>();
const texts = useMessages();
const text = texts.backlog.deliverables;
</script>

<template>
  <div class="pe-deliverable-results">
    <div class="pe-deliverable-columns" aria-hidden="true">
      <span>{{ text.result }}</span>
      <span>{{ texts.knowledge.title }}</span>
      <span>{{ text.progress }}</span>
    </div>
    <ul>
      <li
        v-for="row in rows"
        :key="row.record.id"
        class="pe-deliverable-row"
        :data-deliverable-id="row.record.id"
      >
        <div class="pe-deliverable-summary">
          <small class="pe:text-muted">{{ row.record.displayId }}</small>
          <UButton
            type="button"
            variant="link"
            data-testid="deliverable-row-title"
            :data-pe-focus-key="'deliverable-' + row.record.id"
            :label="row.record.values.title"
            @click="emit('edit', row.record, $event)"
          />
          <p>{{ row.record.values.outcome }}</p>
        </div>
        <DeliverableNoteCell
          :row="row"
          @open="(note, event) => emit('openNote', row.record, note, event)"
          @edit="emit('edit', row.record, $event, true)"
          @create="emit('createNote', row.record, $event)"
        />
        <div class="pe-deliverable-progress">
          <select
            :aria-label="text.statusFor(row.record.displayId)"
            :aria-busy="changing"
            :value="row.record.values.status"
            data-testid="deliverable-row-status"
            :data-pe-focus-key="'deliverable-status-' + row.record.id"
            @change="emit('status', row.record, $event)"
          >
            <option v-for="status in deliverableStatuses" :key="status" :value="status">
              {{ text.statuses[status] }}
            </option>
          </select>
          <small class="pe:text-muted">
            <span data-testid="deliverable-row-owner">{{ row.owner ?? text.unassigned }}</span>
            <template v-if="row.record.values.due">
              · {{ text.due }}
              <time :datetime="row.record.values.due">{{ text.date(row.record.values.due) }}</time>
            </template>
          </small>
        </div>
      </li>
    </ul>
  </div>
</template>
