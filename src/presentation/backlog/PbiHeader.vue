<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { BacklogItem, PbiDetail } from "../../application/backlog";
import { useMessages } from "../shell";

const { detail, parent, nativePending } = defineProps<{
  readonly detail: PbiDetail;
  readonly parent: BacklogItem | undefined;
  readonly nativePending: boolean;
}>();
const emit = defineEmits<{ open: [MouseEvent]; parent: [BacklogItem, MouseEvent] }>();
const text = useMessages().backlog;
</script>

<template>
  <header class="pe:grid pe:min-w-0 pe:gap-3">
    <div class="pe-backlog-actions pe:justify-between">
      <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">
        {{ detail.edit.item.title }}
      </h1>
      <UButton
        type="button"
        variant="soft"
        color="neutral"
        data-testid="pbi-open-note"
        :label="text.nativeNote"
        :loading="nativePending"
        @click="emit('open', $event)"
      />
    </div>
    <div class="pe-backlog-actions">
      <span class="pe-backlog-badge" data-testid="pbi-id">PBI {{ detail.pbiId }}</span>
      <UButton
        v-if="parent?.id && !parent.conflict"
        type="button"
        variant="link"
        class="pe:p-0 pe:text-start pe:wrap-anywhere"
        data-testid="pbi-parent"
        data-pe-focus-key="pbi-parent"
        @click="emit('parent', parent, $event)"
        >{{ text.types[parent.kind] }} {{ parent.id }} · {{ parent.title }}</UButton
      >
      <span v-else class="pe:text-sm pe:text-muted">{{
        parent ? text.types[parent.kind] + " · " + parent.title : text.suppliedParent
      }}</span>
    </div>
    <div class="pe-backlog-actions">
      <span class="pe-backlog-badge" data-testid="pbi-stage"
        >{{ text.title }} · {{ detail.edit.item.state || text.unset }}</span
      >
      <span class="pe-backlog-badge" data-testid="pbi-business-status"
        >{{ text.pbiStatus.business }} · {{ text.pbiStatus[detail.approval] }}</span
      >
      <span class="pe-backlog-badge" data-testid="pbi-factory-status"
        >{{ text.pbiStatus.factory }} · {{ text.pbiStatus.noRequest }}</span
      >
      <span class="pe:text-xs pe:text-muted">{{ text.pbiStatus.revision(detail.revision) }}</span>
    </div>
  </header>
</template>
