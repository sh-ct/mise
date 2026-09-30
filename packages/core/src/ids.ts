// Web Crypto is available in browsers, Deno and Node 19+, but `lib: es2022` has no typings for it.
declare const crypto: { randomUUID(): string };

export type IdFactory = () => string;

export const newId: IdFactory = () => crypto.randomUUID();
