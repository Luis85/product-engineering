<script setup lang="ts">
import { computed } from "vue";
import type { BacklogItem } from "../../application/backlog";
import { parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";

const { kind, items, creating } = defineProps<{
  readonly kind: BacklogKind;
  readonly items: readonly BacklogItem[];
  readonly creating: boolean;
}>();
const parent = defineModel<string>("parent", { required: true });
const epic = defineModel<string>("epic", { required: true });
const epicTitle = defineModel<string>("epicTitle", { required: true });
const featureTitle = defineModel<string>("featureTitle", { required: true });
const text = useMessages().backlog;
const required = computed(() => parentKind(kind));
const parents = computed(() =>
  items.filter(({ kind: type, conflict }) => type === required.value && !conflict),
);
const epics = computed(() => items.filter((entry) => entry.kind === "EP" && !entry.conflict));
const createPbi = computed(() => creating && kind === "UC");
const addFeature = computed(() => createPbi.value && !parent.value);
const parentHint = computed(() => (createPbi.value ? text.addFeature : text.noParent));
const unavailableParent = computed(
  () => parent.value && !parents.value.some(({ key }) => key === parent.value),
);
const selectEpic = computed(() => addFeature.value && epics.value.length);
const enterEpic = computed(() => addFeature.value && !epic.value);
</script>

<template>
  <label v-if="required">
    {{ text.parent }} · {{ text.types[required] }}
    <select v-model="parent" name="parent">
      <option value="">{{ parentHint }}</option>
      <option v-if="unavailableParent" :value="parent">
        {{ text.suppliedParent }}
      </option>
      <option v-for="candidate in parents" :key="candidate.key" :value="candidate.key">
        {{ candidate.title }}
      </option>
    </select>
  </label>
  <label v-if="selectEpic">
    {{ text.types.EP }}
    <select v-model="epic" name="epic">
      <option value="">{{ text.newEpic }}</option>
      <option v-for="candidate in epics" :key="candidate.key" :value="candidate.key">
        {{ candidate.title }}
      </option>
    </select>
  </label>
  <label v-if="enterEpic">
    {{ text.newEpic }}
    <input v-model="epicTitle" type="text" name="epicTitle" maxlength="160" />
  </label>
  <label v-if="addFeature">
    {{ text.newFeature }}
    <input v-model="featureTitle" type="text" name="featureTitle" maxlength="160" />
  </label>
</template>
