import assert from 'node:assert/strict';
import test from 'node:test';
import { detectMobileDevice, needsMobileGate } from './deviceSupport.js';

const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36';
const view = { innerWidth: 320, screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }) };

test('phone and tablet UAs, including Chrome on iOS and Android without Mobile, are gated', () => {
  for (const userAgent of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/144.0.0.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/144.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 18_0) Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/144.0.0.0 Safari/537.36'
  ]) assert.equal(needsMobileGate({ userAgent }, view), true, userAgent);
});

test('iPadOS Macintosh UA uses multiple touch points, not viewport width', () => {
  assert.equal(needsMobileGate({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(needsMobileGate({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 0 }, view), false);
});

test('desktop platforms and touch laptops stay eligible, even at a narrow viewport', () => {
  for (const userAgent of [mac, linux, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/144 Safari/537.36', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/144.0']) {
    for (const maxTouchPoints of [0, 1, 10]) {
      if (userAgent === mac && maxTouchPoints > 1) continue;
      assert.equal(needsMobileGate({ userAgent, maxTouchPoints }, view), false);
    }
  }
  assert.equal(needsMobileGate({}, view), false);
  assert.equal(needsMobileGate(undefined, undefined), false);
});

test('Android desktop-site mode uses surviving platform or form-factor hints', async () => {
  assert.equal(needsMobileGate({ userAgent: linux, userAgentData: { mobile: false, platform: 'Android' } }), true);
  assert.equal(needsMobileGate({ userAgent: linux, userAgentData: { mobile: true, platform: 'Linux' } }), true);
  assert.equal(await detectMobileDevice({ userAgent: linux, userAgentData: {
    mobile: false, platform: 'Linux', getHighEntropyValues: async () => ({ platform: 'Linux', formFactors: ['Tablet'] })
  } }), true);
  assert.equal(await detectMobileDevice({ userAgent: linux, userAgentData: {
    mobile: false, platform: 'Linux', getHighEntropyValues: async () => ({ platform: 'Linux', formFactors: ['Mobile'] })
  } }), true);
});

test('touch/screen fallback requires ARM Linux and absence of a fine pointer', () => {
  const nav = { userAgent: linux, platform: 'Linux armv8l', maxTouchPoints: 5 };
  const coarseOnly = { ...view, matchMedia: query => ({ matches: query === '(pointer: coarse)' }) };
  assert.equal(needsMobileGate(nav, coarseOnly), true);
  assert.equal(needsMobileGate(nav, view), false);
  assert.equal(needsMobileGate({ ...nav, platform: 'Linux x86_64' }, coarseOnly), false);
});

test('missing, denied or stalled Client Hints do not block desktop startup', async () => {
  assert.equal(await detectMobileDevice({ userAgent: mac }), false);
  assert.equal(await detectMobileDevice({ userAgent: linux, userAgentData: { getHighEntropyValues: async () => { throw Error('Denied'); } } }), false);
  assert.equal(await detectMobileDevice({ userAgent: linux, userAgentData: { getHighEntropyValues: () => new Promise(() => {}) } }), false);
});

test('fully spoofed desktop signals are indistinguishable, not a security boundary', () => {
  assert.equal(needsMobileGate({ userAgent: linux, platform: 'Linux x86_64', maxTouchPoints: 10,
    userAgentData: { platform: 'Linux', mobile: false, formFactors: ['Desktop'] } }, view), false);
});
