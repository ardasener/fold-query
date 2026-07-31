export function isMacOS(): boolean {
  return /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);
}
