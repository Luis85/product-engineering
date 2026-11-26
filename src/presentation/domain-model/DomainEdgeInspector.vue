<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";

defineProps<{
  readonly edge: DomainEdge;
  readonly names: ReadonlyMap<string, KnowledgeRecord>;
  readonly editable: boolean;
}>();
const emit = defineEmits<{ select: [string]; edit: [Event]; remove: [Event] }>();
const text = useMessages()["domain-model"];
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-3">
    <div>
      <h2 class="pe:wrap-anywhere pe:text-xl pe:font-semibold">{{ edge.verb }}</h2>
      <p class="pe:wrap-anywhere pe:text-sm pe:text-muted">{{ edge.id }}</p>
    </div>
    <dl class="pe:grid pe:min-w-0 pe:gap-3">
      <div v-for="end in ['source', 'target'] as const" :key="end">
        <dt class="pe:text-sm pe:font-medium">{{ text[end] }}</dt>
        <dd>
          <UButton
            type="button"
            variant="link"
            class="pe:min-w-0 pe:max-w-full pe:text-start"
            @click="emit('select', edge[end])"
          >
            <span class="pe:min-w-0 pe:wrap-anywhere pe:whitespace-normal">
              {{ names.get(edge[end])?.title ?? edge[end] }}
              <template v-if="names.get(edge[end])?.values.domain_archived">
                · {{ text.archived }}</template
              >
            </span>
          </UButton>
          <small class="pe:block pe:wrap-anywhere pe:text-muted">
            {{ end === "source" ? edge.sourceCardinality : edge.targetCardinality }} ·
            {{
              text.cardinalities[end === "source" ? edge.sourceCardinality : edge.targetCardinality]
            }}
          </small>
        </dd>
      </div>
    </dl>
    <p v-if="edge.rule" class="pe:wrap-anywhere pe:whitespace-pre-wrap">{{ edge.rule }}</p>
    <div v-if="editable" class="pe:flex pe:flex-wrap pe:gap-2">
      <UButton
        type="button"
        variant="soft"
        data-testid="domain-edit-edge"
        @click="emit('edit', $event)"
        >{{ text.editEdge }}</UButton
      >
      <UButton type="button" color="error" variant="ghost" @click="emit('remove', $event)">{{
        text.deleteEdge
      }}</UButton>
    </div>
  </div>
</template>
