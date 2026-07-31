/// <reference types="vite/client" />

declare module "feross-buffer" {
  export const Buffer: typeof import("buffer").Buffer;
  const _default: { Buffer: typeof import("buffer").Buffer };
  export default _default;
}