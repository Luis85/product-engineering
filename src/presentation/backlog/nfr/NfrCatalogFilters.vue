<script setup lang="ts">
import { nfrCategories, nfrStandards } from "../../../domain/backlog";
import { useMessages } from "../../shell";

const query = defineModel<string>("query", { required: true });
const category = defineModel<string>("category", { required: true });
const text = useMessages().backlog.nfr;
</script>

<template>
  <section class="pe-nfr-filters" :aria-label="text.search">
    <label>
      {{ text.search }}
      <input
        v-model="query"
        type="search"
        data-testid="nfr-search"
        data-pe-focus-key="nfr-search"
        :placeholder="text.placeholder"
      />
    </label>
    <label>
      {{ text.filter }}
      <select v-model="category" data-testid="nfr-filter">
        <option value="">{{ text.all }}</option>
        <option value="unclassified">{{ text.unclassified }}</option>
        <optgroup
          v-for="(name, standard) in nfrStandards"
          :key="standard"
          :label="`${name} · ${text.groups[standard]}`"
        >
          <option :value="standard">{{ text.allStandard(name) }}</option>
          <template v-for="[id, group] in nfrCategories" :key="id">
            <option v-if="group === standard" :value="id">{{ text.category[id] }}</option>
          </template>
        </optgroup>
      </select>
    </label>
  </section>
</template>
