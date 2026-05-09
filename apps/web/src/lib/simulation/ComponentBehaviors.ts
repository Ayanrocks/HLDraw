/**
 * Component behavior lookup.
 *
 * Delegates to the centralized ComponentRegistry for all definitions.
 * This module re-exports a backwards-compatible `COMPONENT_BEHAVIORS` map
 * so existing simulation engine code continues to work.
 */
import {
  COMPONENT_REGISTRY,
  type RoutingStrategy,
  type ComponentDefinition,
} from "./ComponentRegistry";

export type ComponentType = string;

export interface ComponentBehavior {
  type: ComponentType;
  description: string;
  acceptsIncoming: boolean;
  forwardsOutgoing: boolean;
  routingStrategy: RoutingStrategy;
}

/**
 * Builds the behaviours map from the registry so every registered
 * component type automatically gets a behaviour entry.
 */
function buildBehaviors(): Record<string, ComponentBehavior> {
  const behaviors: Record<string, ComponentBehavior> = {};
  for (const [key, def] of Object.entries(COMPONENT_REGISTRY)) {
    behaviors[key] = {
      type: key,
      description: def.description,
      acceptsIncoming: def.acceptsIncoming,
      forwardsOutgoing: def.forwardsOutgoing,
      routingStrategy: def.routingStrategy,
    };
  }
  return behaviors;
}

export const COMPONENT_BEHAVIORS: Record<string, ComponentBehavior> =
  buildBehaviors();

/**
 * Resolves the behaviour for a given component type key.
 * Falls back to a sensible "passthrough" default for unknown types.
 */
export function getBehavior(componentType: string): ComponentBehavior {
  return (
    COMPONENT_BEHAVIORS[componentType] ?? {
      type: componentType,
      description: "Unknown component",
      acceptsIncoming: true,
      forwardsOutgoing: true,
      routingStrategy: "round-robin" as RoutingStrategy,
    }
  );
}

/**
 * Returns the full definition from the registry, or undefined if unknown.
 */
export function getDefinition(
  componentType: string
): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY[componentType];
}
