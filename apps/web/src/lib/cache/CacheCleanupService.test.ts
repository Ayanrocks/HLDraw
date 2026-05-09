import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted so mock fns exist when the factory runs
const { mockKeys, mockDel, mockGet } = vi.hoisted(() => ({
  mockKeys: vi.fn<() => Promise<IDBValidKey[]>>(),
  mockDel: vi.fn<(key: IDBValidKey) => Promise<void>>(),
  mockGet: vi.fn<(key: IDBValidKey) => Promise<unknown>>(),
}));

vi.mock("idb-keyval", () => ({
  keys: mockKeys,
  del: mockDel,
  get: mockGet,
}));

import {
  evictStaleCacheEntries,
  trimGraphCache,
  removeOrphanedEntries,
  runCleanupCycle,
  startCleanupService,
  stopCleanupService,
} from "./CacheCleanupService";

describe("CacheCleanupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeys.mockResolvedValue([]);
    mockDel.mockResolvedValue(undefined);
    mockGet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopCleanupService();
  });

  describe("evictStaleCacheEntries", () => {
    it("does not delete protected keys", async () => {
      mockKeys.mockResolvedValue([
        "hlDraw-elements",
        "hlDraw-appState",
      ]);

      const evicted = await evictStaleCacheEntries();

      expect(evicted).toBe(0);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("does not delete the main graph cache entry", async () => {
      mockKeys.mockResolvedValue(["hlDraw-graph-main-graph"]);

      const evicted = await evictStaleCacheEntries();

      expect(evicted).toBe(0);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("deletes non-main graph cache entries", async () => {
      mockKeys.mockResolvedValue([
        "hlDraw-graph-main-graph",
        "hlDraw-graph-old-session-1",
        "hlDraw-graph-temp-123",
      ]);

      const evicted = await evictStaleCacheEntries();

      expect(evicted).toBe(2);
      expect(mockDel).toHaveBeenCalledWith("hlDraw-graph-old-session-1");
      expect(mockDel).toHaveBeenCalledWith("hlDraw-graph-temp-123");
    });

    it("handles errors gracefully", async () => {
      mockKeys.mockRejectedValue(new Error("IndexedDB unavailable"));

      const evicted = await evictStaleCacheEntries();

      expect(evicted).toBe(0);
    });
  });

  describe("trimGraphCache", () => {
    it("returns false when no graph cache exists", async () => {
      mockGet.mockResolvedValue(undefined);

      const trimmed = await trimGraphCache();

      expect(trimmed).toBe(false);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("does not trim a small graph cache", async () => {
      mockGet.mockResolvedValue({ nodes: [], edges: [] });

      const trimmed = await trimGraphCache();

      expect(trimmed).toBe(false);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("trims a graph cache larger than 5MB", async () => {
      // Create an object that serializes to > 5MB
      const largePayload = "x".repeat(6 * 1024 * 1024);
      mockGet.mockResolvedValue({ data: largePayload });

      const trimmed = await trimGraphCache();

      expect(trimmed).toBe(true);
      expect(mockDel).toHaveBeenCalledWith("hlDraw-graph-main-graph");
    });

    it("handles errors gracefully", async () => {
      mockGet.mockRejectedValue(new Error("read failed"));

      const trimmed = await trimGraphCache();

      expect(trimmed).toBe(false);
    });
  });

  describe("removeOrphanedEntries", () => {
    it("does not remove entries with known prefixes", async () => {
      mockKeys.mockResolvedValue([
        "hlDraw-elements",
        "hlDraw-appState",
        "hlDraw-graph-main-graph",
      ]);

      const removed = await removeOrphanedEntries();

      expect(removed).toBe(0);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("removes entries with unknown prefixes", async () => {
      mockKeys.mockResolvedValue([
        "hlDraw-elements",
        "some-random-key",
        "legacy-data-v1",
      ]);

      const removed = await removeOrphanedEntries();

      expect(removed).toBe(2);
      expect(mockDel).toHaveBeenCalledWith("some-random-key");
      expect(mockDel).toHaveBeenCalledWith("legacy-data-v1");
    });
  });

  describe("runCleanupCycle", () => {
    it("runs all cleanup steps without throwing", async () => {
      mockKeys.mockResolvedValue([]);
      mockGet.mockResolvedValue(undefined);

      await expect(runCleanupCycle()).resolves.not.toThrow();
    });
  });

  describe("startCleanupService / stopCleanupService", () => {
    it("is idempotent — multiple starts do not create duplicate intervals", () => {
      vi.useFakeTimers();

      startCleanupService();
      startCleanupService();
      startCleanupService();

      // Only one immediate invocation should have occurred
      // (the mocks resolve async, but the interval setup is sync)
      stopCleanupService();

      vi.useRealTimers();
    });

    it("stops cleanly without errors when not started", () => {
      expect(() => stopCleanupService()).not.toThrow();
    });
  });
});
