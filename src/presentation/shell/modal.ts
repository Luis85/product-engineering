import { computed, inject, nextTick, onScopeDispose, provide, ref, watch } from "vue";
import type { InjectionKey, Ref } from "vue";

const modalCount: InjectionKey<Ref<number>> = Symbol("surface-modal-count");

export function provideModalRegistry() {
  const count = ref(0);
  provide(modalCount, count);
  return computed(() => count.value > 0);
}

function focusMarkedControl(event: Event): void {
  const panel = event.currentTarget;
  if (!panel || !("querySelector" in panel)) return;
  const target = (panel as Element).querySelector<HTMLElement>("[data-autofocus]");
  if (!target) return;
  event.preventDefault();
  target.focus();
}

export function useModal(
  open: Readonly<Ref<boolean>>,
  afterClose: () => void,
  closeOnEscape?: () => void,
) {
  const count = inject(modalCount);
  if (!count) throw new Error("useModal requires a surface modal registry");

  let registered = false;
  const update = (next: boolean): void => {
    if (registered === next) return;
    registered = next;
    count.value += next ? 1 : -1;
  };

  watch(open, update, { immediate: true, flush: "sync" });
  onScopeDispose(() => update(false));

  return {
    "aria-modal": "true" as const,
    ...(closeOnEscape && {
      onKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        closeOnEscape();
      },
    }),
    onOpenAutoFocus: focusMarkedControl,
    onCloseAutoFocus(event: Event) {
      event.preventDefault();
      void nextTick(() => {
        if (!open.value) afterClose();
      });
    },
  };
}
