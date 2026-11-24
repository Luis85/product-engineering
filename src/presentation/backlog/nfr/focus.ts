export function focusNfrLink(event: Event, selector: string | undefined) {
  const panel = event.currentTarget as HTMLElement | null;
  const link = selector ? panel?.querySelector<HTMLElement>(selector) : undefined;
  if (!link) return false;
  event.preventDefault();
  link.focus();
  return true;
}
