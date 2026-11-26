function updateDescription(input: HTMLInputElement, id: string, invalid: boolean): void {
  const describedBy = new Set(input.getAttribute("aria-describedby")?.match(/\S+/g));
  if (invalid) {
    input.setAttribute("aria-invalid", "true");
    describedBy.add(id);
  } else if (describedBy.delete(id)) {
    input.removeAttribute("aria-invalid");
  }
  if (describedBy.size) input.setAttribute("aria-describedby", [...describedBy].join(" "));
  else input.removeAttribute("aria-describedby");
}

export function observeSettingValidation(tab: HTMLElement): () => void {
  const owner = tab.ownerDocument.defaultView;
  if (!owner) return () => undefined;
  let errorId = 0;
  const observer = new owner.MutationObserver(() => {
    for (const error of tab.querySelectorAll<HTMLElement>(
      ".setting-item-control > .setting-item-error",
    )) {
      const input = error.parentElement?.querySelector<HTMLInputElement>('input[type="text"]');
      if (!input) continue;
      const invalid = error.closest(".setting-item")?.classList.contains("is-invalid") === true;
      if (invalid && !error.id) {
        error.id = `pe-setting-error-${++errorId}`;
        error.setAttribute("role", "alert");
      }
      if (error.id) updateDescription(input, error.id, invalid);
    }
  });
  observer.observe(tab, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
