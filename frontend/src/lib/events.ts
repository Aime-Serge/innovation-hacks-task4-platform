// Browser events the HTTP adapter raises so the layout can tell people what is happening, without
// the layout importing an adapter (NFR-403, TC-459).
export const WAKING_EVENT = "bff:waking";
export const AWAKE_EVENT = "bff:awake";
