<script setup lang="ts">
import type { BacklogSnapshot } from "../../application/backlog";
import type { FeatureRequest } from "../../application/feature-requests";
import type { DeliveryStage } from "../../domain/feature-requests";
import { useMessages } from "../shell";
import FeatureRequestRegisterRow from "./FeatureRequestRegisterRow.vue";

defineProps<{
  readonly records: readonly FeatureRequest[];
  readonly stage: DeliveryStage | undefined;
  readonly backlog: BacklogSnapshot;
}>();
const text = useMessages()["feature-requests"];
</script>

<template>
  <table class="pe-request-register" :aria-label="text.title">
    <thead data-testid="request-register-headings">
      <tr>
        <th scope="col">{{ text.request }}</th>
        <th scope="col">{{ text.delivery }}</th>
        <th scope="col">{{ text.gateProgress }}</th>
      </tr>
    </thead>
    <tbody>
      <FeatureRequestRegisterRow
        v-for="record in records"
        :key="record.id"
        :record="record"
        :stage="stage"
        :backlog="backlog"
      />
    </tbody>
  </table>
</template>
