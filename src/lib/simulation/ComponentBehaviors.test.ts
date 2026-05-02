import { describe, it, expect } from "vitest";
import {
  COMPONENT_BEHAVIORS,
  getBehavior,
  getDefinition,
} from "./ComponentBehaviors";
import { COMPONENT_REGISTRY } from "./ComponentRegistry";

// ===========================================================================
// COMPONENT_BEHAVIORS map
// ===========================================================================

describe("ComponentBehaviors — COMPONENT_BEHAVIORS map", () => {
  it("has an entry for every component in the registry", () => {
    for (const key of Object.keys(COMPONENT_REGISTRY)) {
      expect(
        COMPONENT_BEHAVIORS[key],
        `Missing behavior for "${key}"`
      ).toBeDefined();
    }
  });

  it("mirrors the registry's acceptsIncoming for every component", () => {
    for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(COMPONENT_BEHAVIORS[key].acceptsIncoming).toBe(
        def.acceptsIncoming
      );
    }
  });

  it("mirrors the registry's forwardsOutgoing for every component", () => {
    for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(COMPONENT_BEHAVIORS[key].forwardsOutgoing).toBe(
        def.forwardsOutgoing
      );
    }
  });

  it("mirrors the registry's routingStrategy for every component", () => {
    for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(COMPONENT_BEHAVIORS[key].routingStrategy).toBe(
        def.routingStrategy
      );
    }
  });
});

// ===========================================================================
// getBehavior
// ===========================================================================

describe("ComponentBehaviors — getBehavior", () => {
  it("returns correct behavior for App Server", () => {
    const behavior = getBehavior("App Server");

    expect(behavior.type).toBe("App Server");
    expect(behavior.acceptsIncoming).toBe(true);
    expect(behavior.forwardsOutgoing).toBe(true);
    expect(behavior.routingStrategy).toBe("round-robin");
  });

  it("returns correct behavior for Database (terminal node)", () => {
    const behavior = getBehavior("Database");

    expect(behavior.acceptsIncoming).toBe(true);
    expect(behavior.forwardsOutgoing).toBe(false);
    expect(behavior.routingStrategy).toBe("none");
  });

  it("returns correct behavior for Client (source node)", () => {
    const behavior = getBehavior("Client");

    expect(behavior.acceptsIncoming).toBe(false);
    expect(behavior.forwardsOutgoing).toBe(true);
  });

  it("returns fallback for unknown component type", () => {
    const behavior = getBehavior("TotallyFakeType");

    expect(behavior.type).toBe("TotallyFakeType");
    expect(behavior.description).toBe("Unknown component");
    expect(behavior.acceptsIncoming).toBe(true);
    expect(behavior.forwardsOutgoing).toBe(true);
    expect(behavior.routingStrategy).toBe("round-robin");
  });

  it("returns fallback for empty string", () => {
    const behavior = getBehavior("");

    expect(behavior.type).toBe("");
    expect(behavior.description).toBe("Unknown component");
  });
});

// ===========================================================================
// getDefinition
// ===========================================================================

describe("ComponentBehaviors — getDefinition", () => {
  it("returns definition for a known component type", () => {
    const def = getDefinition("Load Balancer");

    expect(def).toBeDefined();
    expect(def?.label).toBe("Load Balancer");
    expect(def?.maxCapacity).toBe(10000);
    expect(def?.routingStrategy).toBe("round-robin");
  });

  it("returns definition with all required fields", () => {
    const def = getDefinition("Cache");

    expect(def).toBeDefined();
    expect(def?.label).toBe("Cache");
    expect(def?.category).toBe("Storage");
    expect(def?.instanceType).toBe("cache.t3.medium");
    expect(def?.maxCapacity).toBe(5000);
    expect(def?.acceptsIncoming).toBe(true);
    expect(def?.forwardsOutgoing).toBe(true);
  });

  it("returns undefined for unknown component type", () => {
    expect(getDefinition("DoesNotExist")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getDefinition("")).toBeUndefined();
  });
});
