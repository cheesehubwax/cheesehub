import { Buffer } from "buffer";

(globalThis as any).global = globalThis;
(globalThis as any).Buffer = Buffer;

export {};
