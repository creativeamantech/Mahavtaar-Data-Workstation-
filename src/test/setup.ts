// Vitest test environment setup
import '@testing-library/jest-dom/vitest';

// Ensure crypto and crypto.subtle are available in jsdom environment if missing
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error polyfill for test environment
  globalThis.crypto = {};
}
