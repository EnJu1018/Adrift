export function needsMobileGate(nav = globalThis.navigator, view = globalThis.window, hints = nav?.userAgentData) {
  const ua = nav?.userAgent || '';
  if (hints?.mobile || /^(Android|iOS)$/i.test(hints?.platform || '') ||
      hints?.formFactors?.some(factor => /^(Mobile|Tablet)$/i.test(factor))) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk\/|Kindle|PlayBook/i.test(ua)) return true;

  const touch = (nav?.maxTouchPoints || 0) > 1;
  // iPadOS can present a Macintosh UA while retaining multi-touch hardware.
  if (touch && (/Macintosh/.test(ua) || nav?.platform === 'MacIntel')) return true;

  // Keep desktop touch laptops eligible; only use touch/screen hints with ARM Linux evidence.
  const armLinux = /Linux.*(?:arm|aarch64)/i.test(`${ua} ${nav?.platform || ''}`);
  return Boolean(armLinux && touch && view?.matchMedia?.('(pointer: coarse)').matches &&
    !view?.matchMedia?.('(any-pointer: fine)').matches &&
    Math.min(view?.screen?.width || Infinity, view?.screen?.height || Infinity) <= 1024);
}

export async function detectMobileDevice(nav = globalThis.navigator, view = globalThis.window) {
  if (needsMobileGate(nav, view)) return true;
  if (!nav?.userAgentData?.getHighEntropyValues) return false;
  let timer;
  try {
    const hints = await Promise.race([
      nav.userAgentData.getHighEntropyValues(['formFactors', 'platform']),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 250); })
    ]);
    return needsMobileGate(nav, view, hints || nav.userAgentData);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
