export function parseObject<T, P extends T | ((is: boolean) => T)>(obj: P, is: boolean): T {
  return typeof obj === 'function' ? obj(is) : is
}

/**
 * auto load target worker
 *
 * **only basic worker options**
 */
export function defaultWorker(support: boolean) {
  return support
    ? new Worker(new URL('worker.mjs', import.meta.url), { type: 'module' })
    : new Worker(new URL('worker.js', import.meta.url))
}

/**
 * auto load target wasm
 */
export function defaultWasmURL(useAsyncWasm: boolean) {
  return useAsyncWasm
    ? new URL('wa-sqlite-async.wasm', import.meta.url).href
    : new URL('wa-sqlite.wasm', import.meta.url).href
}
