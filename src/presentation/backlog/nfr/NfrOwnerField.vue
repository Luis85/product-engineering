<script setup lang="ts">
import { computed } from "vue";
import type { ProjectMember, ProjectMemberId } from "../../../application/projects";
import { useMessages } from "../../shell";

const { members } = defineProps<{ readonly members: readonly ProjectMember[] }>();
const owner = defineModel<ProjectMemberId | undefined>({ required: true });
const text = useMessages().backlog.nfr;
const unavailable = computed(() => owner.value && !members.some(({ id }) => id === owner.value));

function select(event: Event) {
  const id = (event.currentTarget as HTMLSelectElement).value;
  owner.value = members.find((member) => member.id === id)?.id;
}
</script>

<template>
  <label>
    {{ text.owner }}
    <select name="owner_id" data-testid="nfr-owner" :value="owner ?? ''" @change="select">
      <option value="">{{ text.unassigned }}</option>
      <option v-if="unavailable" :value="owner">{{ text.ownerMissing }}</option>
      <option v-for="member in members" :key="member.id" :value="member.id">
        {{ member.name }}
      </option>
    </select>
  </label>
</template>
