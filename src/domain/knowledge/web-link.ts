export function markdownWebTarget(input: string) {
  const address = input.trim();
  if (!/^https?:\/\/[^/?#]/i.test(address) || /[\s\\<>]/.test(address) || !URL.canParse(address)) {
    return undefined;
  }
  return address.replaceAll("(", "%28").replaceAll(")", "%29");
}
