<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useNavigate, useRouting } from "../navigation";
import { useMessages } from "../runtime/use-runtime";

const { definition } = useRouting();
const navigate = useNavigate();
const text = useMessages().shell.notFound;
</script>

<template>
  <div data-testid="not-found" class="pe:grid pe:justify-items-start pe:gap-2">
    <div role="alert" class="pe:space-y-1">
      <h2 class="pe:text-base pe:font-semibold">{{ text.title }}</h2>
      <p class="pe:text-sm pe:text-muted">{{ text.detail }}</p>
    </div>
    <UButton
      color="neutral"
      variant="outline"
      type="button"
      size="sm"
      @click="navigate(definition.start)"
    >
      {{ text.back }}
    </UButton>
  </div>
</template>
