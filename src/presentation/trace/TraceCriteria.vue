<script setup lang="ts">
import type { TraceCriterion } from "../../application/trace";
import { useMessages } from "../shell";

const { rows } = defineProps<{ readonly rows: readonly TraceCriterion[] }>();
const text = useMessages().trace;
</script>

<template>
  <table v-if="rows.length" class="pe-trace-criteria">
    <thead>
      <tr>
        <th scope="col">{{ text.criterion }}</th>
        <th scope="col">{{ text.ci }}</th>
        <th scope="col">{{ text.business }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.id + '/' + row.scenario_id"
        :data-trace-criterion="row.id"
        :data-trace-scenario="row.scenario_id"
      >
        <th scope="row">
          <small
            ><code>{{ row.id }} · {{ row.scenario_id }}</code></small
          ><span>{{ row.text }}</span>
        </th>
        <td>
          <span v-if="row.ci"
            >{{ row.ci.outcome === "passed" ? text.passed : text.failed }} ·
            <code>{{ row.ci.checkId }}</code></span
          >
          <span v-else class="pe:text-muted">{{ text.noCi }}</span>
        </td>
        <td>{{ row.confirmed ? text.confirmed : text.noCheck }}</td>
      </tr>
    </tbody>
  </table>
  <p v-else class="pe:text-muted">{{ text.noCriteria }}</p>
</template>
