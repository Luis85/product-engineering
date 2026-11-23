<script setup lang="ts">
import { computed } from "vue";
import { ownerName } from "../../application/backlog";
import type { BacklogItem } from "../../application/backlog";
import type { BacklogBase, ProjectMember } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogParentFields from "./BacklogParentFields.vue";

const { kind, items, base, members, disabled, creating, fixedParent } = defineProps<{
  readonly kind: BacklogKind;
  readonly items: readonly BacklogItem[];
  readonly base: BacklogBase;
  readonly members: readonly ProjectMember[];
  readonly disabled: boolean;
  readonly creating: boolean;
  readonly fixedParent: boolean;
}>();
const title = defineModel<string>("title", { required: true });
const parent = defineModel<string>("parent", { required: true });
const state = defineModel<string>("state", { required: true });
const priority = defineModel<string>("priority", { required: true });
const owner = defineModel<string>("owner", { required: true });
const epic = defineModel<string>("epic", { required: true });
const epicTitle = defineModel<string>("epicTitle", { required: true });
const featureTitle = defineModel<string>("featureTitle", { required: true });
const text = useMessages().backlog;
const setOf = (configured: readonly string[], current: string) =>
  current && !configured.includes(current) ? [current, ...configured] : configured;
const externalOwner = computed(() =>
  Boolean(owner.value && !members.some(({ id, name }) => [id, name].includes(owner.value))),
);
</script>

<template>
  <fieldset :disabled="disabled" class="pe-backlog-fields">
    <label class="pe-backlog-title">
      {{ text.titleField }}
      <input v-model="title" name="title" type="text" data-autofocus required maxlength="160" />
    </label>
    <BacklogParentFields
      v-if="!fixedParent"
      :kind="kind"
      :items="items"
      :creating="creating"
      v-model:parent="parent"
      v-model:epic="epic"
      v-model:epic-title="epicTitle"
      v-model:feature-title="featureTitle"
    />
    <label>
      {{ text.owner }}
      <select v-model="owner" name="owner">
        <option value="">{{ text.unassigned }}</option>
        <option v-if="externalOwner" :value="owner">{{ ownerName(owner) }}</option>
        <option v-for="member in members" :key="member.id" :value="member.name">
          {{ member.name }}
        </option>
      </select>
    </label>
    <label>
      {{ text.status }}
      <select v-model="state" name="state">
        <option value="">{{ text.unset }}</option>
        <option v-for="option in setOf(base.states, state)" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>
    <label>
      {{ text.priority }}
      <select v-model="priority" name="priority">
        <option value="">{{ text.unset }}</option>
        <option v-for="option in setOf(base.priorities, priority)" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>
  </fieldset>
</template>
