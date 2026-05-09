import { describe, it, expect } from "vitest";
import {
  COMPONENT_REGISTRY,
  COMPONENT_CATEGORIES,
  ALL_COMPONENT_TYPES,
  getComponentsByCategory,
  getDefaultInstanceForType,
  isClientType,
  isLoadBalancerType,
} from "./ComponentRegistry";

// ===========================================================================
// Registry integrity
// ===========================================================================

describe("ComponentRegistry — Registry integrity", () => {
  it("contains all expected categories", () => {
    const categories = [
      "Clients",
      "Compute",
      "Databases",
      "Storage",
      "Networking",
      "Messaging",
      "Security",
    ];
    expect([...COMPONENT_CATEGORIES]).toEqual(categories);
  });

  it("has entries for all listed component types", () => {
    for (const key of ALL_COMPONENT_TYPES) {
      expect(COMPONENT_REGISTRY[key]).toBeDefined();
    }
  });

  it("every registered component has required fields", () => {
    for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(def.label, `${key} missing label`).toBeTruthy();
      expect(def.category, `${key} missing category`).toBeTruthy();
      expect(def.description, `${key} missing description`).toBeTruthy();
      expect(def.instanceType, `${key} missing instanceType`).toBeTruthy();
      expect(def.instanceName, `${key} missing instanceName`).toBeTruthy();
      expect(
        typeof def.maxCapacity,
        `${key} maxCapacity is not a number`
      ).toBe("number");
      expect(
        typeof def.acceptsIncoming,
        `${key} acceptsIncoming not boolean`
      ).toBe("boolean");
      expect(
        typeof def.forwardsOutgoing,
        `${key} forwardsOutgoing not boolean`
      ).toBe("boolean");
      expect(
        ["all", "round-robin", "broadcast", "none"],
        `${key} invalid routingStrategy`
      ).toContain(def.routingStrategy);
    }
  });

  it("every component belongs to a valid category", () => {
    const validCategories = new Set(COMPONENT_CATEGORIES);
    for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(
        validCategories.has(def.category),
        `${key} has invalid category "${def.category}"`
      ).toBe(true);
    }
  });
});

// ===========================================================================
// isClientType
// ===========================================================================

describe("ComponentRegistry — isClientType", () => {
  it("returns true for Client", () => {
    expect(isClientType("Client")).toBe(true);
  });

  it("returns true for Mobile Client", () => {
    expect(isClientType("Mobile Client")).toBe(true);
  });

  it("returns true for Web Application", () => {
    expect(isClientType("Web Application")).toBe(true);
  });

  it("returns false for non-client types", () => {
    expect(isClientType("App Server")).toBe(false);
    expect(isClientType("Database")).toBe(false);
    expect(isClientType("Load Balancer")).toBe(false);
    expect(isClientType("CDN")).toBe(false);
  });

  it("returns false for unknown types", () => {
    expect(isClientType("")).toBe(false);
    expect(isClientType("NonExistent")).toBe(false);
  });
});

// ===========================================================================
// isLoadBalancerType
// ===========================================================================

describe("ComponentRegistry — isLoadBalancerType", () => {
  it("returns true for Load Balancer", () => {
    expect(isLoadBalancerType("Load Balancer")).toBe(true);
  });

  it("returns true for ALB (legacy alias)", () => {
    expect(isLoadBalancerType("ALB")).toBe(true);
  });

  it("returns false for non-LB types", () => {
    expect(isLoadBalancerType("App Server")).toBe(false);
    expect(isLoadBalancerType("Client")).toBe(false);
    expect(isLoadBalancerType("CDN")).toBe(false);
    expect(isLoadBalancerType("DNS")).toBe(false);
  });

  it("returns false for empty/unknown types", () => {
    expect(isLoadBalancerType("")).toBe(false);
    expect(isLoadBalancerType("NLB")).toBe(false);
  });
});

// ===========================================================================
// getDefaultInstanceForType
// ===========================================================================

describe("ComponentRegistry — getDefaultInstanceForType", () => {
  it("returns correct defaults for App Server", () => {
    const result = getDefaultInstanceForType("App Server");
    expect(result.instanceType).toBe("t3.medium");
    expect(result.instanceName).toBe("t3.medium");
    expect(result.maxCapacity).toBe(500);
  });

  it("returns correct defaults for Database", () => {
    const result = getDefaultInstanceForType("Database");
    expect(result.instanceType).toBe("db.m5.large");
    expect(result.maxCapacity).toBe(2000);
  });

  it("returns correct defaults for Load Balancer", () => {
    const result = getDefaultInstanceForType("Load Balancer");
    expect(result.instanceType).toBe("alb.standard");
    expect(result.maxCapacity).toBe(10000);
  });

  it("returns generic fallback for unknown types", () => {
    const result = getDefaultInstanceForType("SomethingUnknown");
    expect(result.instanceType).toBe("generic");
    expect(result.instanceName).toBe("Generic");
    expect(result.maxCapacity).toBe(500);
  });

  it("returns generic fallback for empty string", () => {
    const result = getDefaultInstanceForType("");
    expect(result.instanceType).toBe("generic");
  });
});

// ===========================================================================
// getComponentsByCategory
// ===========================================================================

describe("ComponentRegistry — getComponentsByCategory", () => {
  it("returns groups in category order", () => {
    const groups = getComponentsByCategory();
    const categoryNames = groups.map((g) => g.category);

    // Should preserve COMPONENT_CATEGORIES order
    for (let i = 0; i < categoryNames.length; i++) {
      const catIndex = COMPONENT_CATEGORIES.indexOf(
        categoryNames[i] as typeof COMPONENT_CATEGORIES[number]
      );
      expect(catIndex).toBeGreaterThanOrEqual(0);

      if (i > 0) {
        const prevCatIndex = COMPONENT_CATEGORIES.indexOf(
          categoryNames[i - 1] as typeof COMPONENT_CATEGORIES[number]
        );
        expect(catIndex).toBeGreaterThan(prevCatIndex);
      }
    }
  });

  it("includes at least one component per returned category", () => {
    const groups = getComponentsByCategory();

    for (const group of groups) {
      expect(group.components.length).toBeGreaterThan(0);
    }
  });

  it("does not include empty categories", () => {
    const groups = getComponentsByCategory();

    for (const group of groups) {
      expect(group.components.length).toBeGreaterThan(0);
    }
  });

  it("all components across groups cover the full registry", () => {
    const groups = getComponentsByCategory();
    const allKeysFromGroups = groups.flatMap((g) =>
      g.components.map((c) => c.key)
    );

    expect(allKeysFromGroups.sort()).toEqual(ALL_COMPONENT_TYPES.sort());
  });
});
