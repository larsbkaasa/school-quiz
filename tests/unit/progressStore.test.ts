import { describe, expect, it, vi } from "vitest";
import { LocalProgressStore, MemoryProgressStore, storageKey } from "../../src/data/progressStore";

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const s1 = { seen: 1, correct: 0, lastWrong: true, lastSeen: "2026-10-04" };

describe("progressStore", () => {
  it("uses a versioned key per subject", () => {
    expect(storageKey("MHE01-03")).toBe("skolequiz:v1:MHE01-03:stats");
  });

  it("round-trips through storage", () => {
    const storage = new FakeStorage();
    const store = new LocalProgressStore(storage);
    store.update("S", "q-0001", () => s1);
    expect(JSON.parse(storage.getItem(storageKey("S"))!)).toEqual({ "q-0001": s1 });
    expect(new LocalProgressStore(storage).get("S")).toEqual({ "q-0001": s1 });
    store.reset("S");
    expect(store.get("S")).toEqual({});
  });

  it("ignores corrupt data", () => {
    const storage = new FakeStorage();
    storage.setItem(storageKey("S"), "{not json");
    expect(new LocalProgressStore(storage).get("S")).toEqual({});
    storage.setItem(storageKey("S"), JSON.stringify({ a: s1, b: { seen: "x" }, c: null }));
    expect(new LocalProgressStore(storage).get("S")).toEqual({ a: s1 });
  });

  it("falls back to memory when storage throws, keeping existing progress", () => {
    const storage = new FakeStorage();
    const store = new LocalProgressStore(storage);
    store.update("S", "a", () => s1);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => store.update("S", "b", () => s1)).not.toThrow();
    expect(store.get("S")).toEqual({ a: s1, b: s1 });
  });

  it("works with no storage at all", () => {
    const store = new LocalProgressStore(null);
    store.update("S", "a", () => s1);
    expect(store.get("S")).toEqual({ a: s1 });
  });

  it("MemoryProgressStore returns copies", () => {
    const store = new MemoryProgressStore();
    store.update("S", "a", () => s1);
    store.get("S").b = s1;
    expect(Object.keys(store.get("S"))).toEqual(["a"]);
  });
});
