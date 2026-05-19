import { Buffer } from "buffer";
import process from "process/browser";

globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis.global || globalThis;
globalThis.process = globalThis.process || process;
