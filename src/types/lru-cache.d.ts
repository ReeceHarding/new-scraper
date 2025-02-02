declare module 'lru-cache' {
  export interface LRUCacheOptions<K = any, V = any> {
    max?: number
    ttl?: number
    allowStale?: boolean
    updateAgeOnGet?: boolean
    maxSize?: number
    sizeCalculation?: (value: V, key: K) => number
    dispose?: (value: V, key: K) => void
    noDisposeOnSet?: boolean
    ttlResolution?: number
    ttlAutopurge?: boolean
    maxEntrySize?: number
  }

  export class LRUCache<K = any, V = any> {
    constructor(options?: LRUCacheOptions<K, V>)
    set(key: K, value: V, options?: { ttl?: number }): boolean
    get(key: K): V | undefined
    peek(key: K): V | undefined
    has(key: K): boolean
    delete(key: K): boolean
    clear(): void
    keys(): IterableIterator<K>
    values(): IterableIterator<V>
    entries(): IterableIterator<[K, V]>
    forEach(callbackfn: (value: V, key: K, cache: this) => void, thisArg?: any): void
    load(arr: Array<[K, V]>): void
    dump(): Array<[K, V]>
    reset(): void
    getRemainingTTL(key: K): number
    size: number
  }
} 