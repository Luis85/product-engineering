<script setup lang="ts">
import { computed } from "vue";
import { projectArtifactRules, setProjectArtifactRule } from "../../../application/projects";
import type { ProjectSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages } from "../../shell";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const messages = useMessages().projects;
const text = messages.artifacts;
const rules = computed(() => projectArtifactRules(project));
const { run, pending, message } = useCommand(setProjectArtifactRule);

async function change(rule: (typeof rules.value)[number], event: Event) {
  if (!rule.field) return;
  const control = event.currentTarget as HTMLInputElement;
  if (pending.value || (await run(project, rule.field, control.checked))._tag !== "success") {
    control.checked = rules.value.find(({ id }) => id === rule.id)?.required === true;
  }
}
</script>

<template>
  <div class="pe:grid pe:max-w-3xl pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4">
    <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
    <p class="pe:text-sm pe:text-muted">{{ text.help }}</p>
    <ul class="pe:divide-y pe:divide-default">
      <li v-for="rule in rules" :key="rule.id">
        <label class="pe:flex pe:items-start pe:gap-3 pe:py-3">
          <input
            type="checkbox"
            :name="rule.field"
            :checked="rule.required"
            :disabled="rule.fixed"
            :aria-disabled="!rule.fixed && pending"
            class="pe:mt-1"
            @change="change(rule, $event)"
          />
          <span class="pe:grid pe:gap-0.5">
            <strong>{{ text.labels[rule.id] }}</strong>
            <small class="pe:text-muted"
              >{{ messages.team.roles[rule.role]
              }}<template v-if="rule.fixed"> · {{ text.fixed }}</template></small
            >
            <small v-if="rule.required === undefined" role="alert">{{ text.unavailable }}</small>
          </span>
        </label>
      </li>
    </ul>
    <ErrorNotice v-if="message" :message="message" />
  </div>
</template>
