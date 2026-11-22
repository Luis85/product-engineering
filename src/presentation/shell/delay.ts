import { readonly, ref, watch } from "vue";
import type { WatchSource } from "vue";

export const LOADING_DELAY_MS = 300;

export function useDelayed(source: WatchSource<boolean>) {
  const delayed = ref(false);
  watch(
    source,
    (pending, previous, cleanup) => {
      if (!pending) {
        delayed.value = false;
        return;
      }
      const timer = window.setTimeout(() => {
        delayed.value = true;
      }, LOADING_DELAY_MS);
      cleanup(() => window.clearTimeout(timer));
    },
    { immediate: true, flush: "sync" },
  );
  return readonly(delayed);
}
