export function downloadPrototypeFile(
  owner: Document,
  name: string,
  type: string,
  contents: string,
) {
  const browser = owner.defaultView;
  if (!browser) return;
  const link = owner.createElement("a");
  const url = browser.URL.createObjectURL(new browser.Blob([contents], { type }));
  link.href = url;
  link.download = name;
  link.click();
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 0);
}
