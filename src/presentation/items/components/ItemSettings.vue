<script setup lang="ts">
import { useMessages } from "../../shell";

const messages = useMessages();
</script>

<template>
  <p class="pe:text-sm pe:text-muted" data-testid="items-screen">
    {{ messages.items.settings.empty }}
  </p>
</template>
