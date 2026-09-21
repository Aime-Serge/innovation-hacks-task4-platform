"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    /** The webpack/Turbopack convention that style-injecting libraries read. */
    __webpack_nonce__?: string;
  }
}

/**
 * react-remove-scroll (inside every Radix dialog) injects a <style> tag to lock
 * page scroll. That tag needs the request's nonce to pass `style-src`, and the
 * library reads it from `window.__webpack_nonce__` (ADR-011).
 */
export function NonceBridge({ nonce }: { nonce: string | undefined }) {
  useEffect(() => {
    if (nonce !== undefined) window.__webpack_nonce__ = nonce;
  }, [nonce]);
  return null;
}
