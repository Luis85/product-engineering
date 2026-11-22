<script setup lang="ts">
import UApp from "@nuxt/ui/components/App.vue";
import { de, en } from "@nuxt/ui/locale";
import type { Component } from "vue";
import { provideModalRegistry } from "../modal";
import { useMessages } from "../runtime/use-runtime";

defineProps<{ portal: HTMLElement; content: Component }>();

const locale = { de, en }[useMessages().shell.language];
const modalOpen = provideModalRegistry();
</script>

<template>
  <UApp :portal="portal" :toaster="null" :locale="locale">
    <div :inert="modalOpen">
      <component :is="content" />
    </div>
  </UApp>
</template>
