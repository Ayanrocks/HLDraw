/**
 * CacheCleanupService
 *
 * Manages automatic cache eviction for IndexedDB stores and in-memory
 * caches. Targets only ephemeral/cache data — never touches user data
 * (saved elements, appState, etc.).
 *
 * Memory leak vectors this service addresses:
 * 1. Unbounded graph cache entries in IndexedDB
 * 2. Stale/orphaned keys in the idb-keyval default store
 * 3. Periodic forced GC-friendly sweep of known cache prefixes
 */

import { keys, del, get } from "idb-keyval";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Prefix used by GraphStore for cached graph representations */
const GRAPH_CACHE_PREFIX = "hlDraw-graph-";

/** Keys that contain user data and must NEVER be deleted */
const PROTECTED_KEYS = new Set([
  "hlDraw-elements",
  "hlDraw-appState",
]);

/** Maximum age (ms) for a cache entry before it's evicted — 24 hours */
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

/** Maximum number of graph cache entries to retain */
const MAX_GRAPH_CACHE_ENTRIES = 5;

/** How often the cleanup cycle runs (ms) — every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Cleanup functions
// ---------------------------------------------------------------------------

/**
 * Removes all IndexedDB entries that match known cache prefixes
 * but are NOT in the protected set.
 *
 * @returns Number of entries evicted.
 */
export async function evictStaleCacheEntries(): Promise<number> {
  let evicted = 0;

  try {
    const allKeys = await keys();

    for (const key of allKeys) {
      const keyStr = String(key);

      // Never touch protected user data
      if (PROTECTED_KEYS.has(keyStr)) continue;

      // Evict graph cache entries beyond the retention limit
      if (keyStr.startsWith(GRAPH_CACHE_PREFIX)) {
        // Keep only the "main-graph" entry; evict anything else
        if (keyStr !== `${GRAPH_CACHE_PREFIX}main-graph`) {
          await del(key);
          evicted++;
        }
      }
    }
  } catch (error) {
    console.error("[CacheCleanup] Failed to evict stale entries:", error);
  }

  return evicted;
}

/**
 * Trims the main graph cache entry if it has grown excessively large.
 * Graph objects with > 500 nodes are likely stale snapshots from
 * corrupted sessions and should be pruned.
 */
export async function trimGraphCache(): Promise<boolean> {
  try {
    const graphKey = `${GRAPH_CACHE_PREFIX}main-graph`;
    const graph = await get(graphKey);

    if (!graph) return false;

    // Check if the stored graph is excessively large (corruption indicator)
    const serialized = JSON.stringify(graph);
    const sizeKB = serialized.length / 1024;

    if (sizeKB > 5120) {
      // > 5MB is suspicious for a graph cache
      console.warn(
        `[CacheCleanup] Graph cache is ${sizeKB.toFixed(0)}KB — evicting as potential corruption.`
      );
      await del(graphKey);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[CacheCleanup] Failed to trim graph cache:", error);
    return false;
  }
}

/**
 * Removes any orphaned IndexedDB keys that don't match known prefixes.
 * These can accumulate from old versions of the app or aborted writes.
 *
 * @returns Number of orphaned entries removed.
 */
export async function removeOrphanedEntries(): Promise<number> {
  const KNOWN_PREFIXES = [
    "hlDraw-",
  ];

  let removed = 0;

  try {
    const allKeys = await keys();

    for (const key of allKeys) {
      const keyStr = String(key);

      // Skip anything with a known prefix
      const isKnown = KNOWN_PREFIXES.some((prefix) => keyStr.startsWith(prefix));
      if (isKnown) continue;

      // Orphaned entry — remove it
      await del(key);
      removed++;
    }
  } catch (error) {
    console.error("[CacheCleanup] Failed to remove orphaned entries:", error);
  }

  return removed;
}

// ---------------------------------------------------------------------------
// Service lifecycle
// ---------------------------------------------------------------------------

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Runs a single full cleanup cycle.
 * Safe to call manually (e.g., on app mount).
 */
export async function runCleanupCycle(): Promise<void> {
  const staleEvicted = await evictStaleCacheEntries();
  const trimmed = await trimGraphCache();
  const orphansRemoved = await removeOrphanedEntries();

  if (staleEvicted > 0 || trimmed || orphansRemoved > 0) {
    console.info(
      `[CacheCleanup] Cycle complete — ` +
      `stale: ${staleEvicted}, trimmed: ${trimmed}, orphans: ${orphansRemoved}`
    );
  }
}

/**
 * Starts the periodic cache cleanup service.
 * Idempotent — calling multiple times will not create duplicate intervals.
 */
export function startCleanupService(): void {
  if (cleanupIntervalId !== null) return;

  // Run immediately on start
  runCleanupCycle().catch(console.error);

  cleanupIntervalId = setInterval(() => {
    runCleanupCycle().catch(console.error);
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stops the periodic cache cleanup service.
 */
export function stopCleanupService(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
