<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { projectBaseChecks } from "../../../application/projects";
import type { ProjectCriterion, ProjectGatePhase } from "../../../application/projects";
import { useMessages } from "../../shell";

defineProps<{ readonly phase: ProjectGatePhase; readonly criteria: readonly ProjectCriterion[] }>();
const emit = defineEmits<{ edit: [event: MouseEvent, criterion?: ProjectCriterion] }>();
const text = useMessages().projects.definitions;
</script>

<template>
  <section
    :data-phase="phase"
    class="pe:grid pe:min-w-0 pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4"
  >
    <div class="pe:flex pe:flex-wrap pe:items-center pe:justify-between pe:gap-2">
      <h3 class="pe:font-semibold">{{ text.phases[phase] }}</h3>
      <UButton type="button" size="sm" variant="soft" @click="emit('edit', $event)">{{
        text.add
      }}</UButton>
    </div>
    <ul class="pe:list-disc pe:space-y-1 pe:pl-5 pe:text-sm pe:text-muted">
      <li v-for="check in projectBaseChecks[phase]" :key="check">{{ text.baseChecks[check] }}</li>
    </ul>
    <p v-if="!criteria.length" class="pe:text-sm pe:text-muted">{{ text.empty }}</p>
    <ul v-else class="pe:divide-y pe:divide-default">
      <li
        v-for="criterion in criteria"
        :key="criterion.id"
        class="pe:flex pe:flex-wrap pe:items-center pe:justify-between pe:gap-2 pe:py-2 pe:[overflow-wrap:anywhere]"
      >
        <div class="pe:min-w-0 pe:flex-1 pe:basis-32">
          <strong>{{ criterion.title }}</strong>
          <p class="pe:text-sm pe:text-muted">
            {{ text.types[criterion.type] }} ·
            {{ criterion.enabled ? text.enabled : text.disabled }}
          </p>
        </div>
        <UButton
          type="button"
          size="sm"
          variant="outline"
          color="neutral"
          :aria-label="`${text.edit} ${criterion.title}`"
          @click="emit('edit', $event, criterion)"
          >{{ text.edit }}</UButton
        >
      </li>
    </ul>
  </section>
</template>
