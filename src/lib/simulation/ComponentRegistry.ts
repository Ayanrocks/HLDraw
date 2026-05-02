/**
 * Centralized registry for all system design component types.
 *
 * Replaces the external SYSTEM_DESIGN_COMPONENTS library from excalidraw
 * with natively defined components that are consistent and fully controllable.
 */

// ---------------------------------------------------------------------------
// Component Categories — used to group components in the sidebar dropdown
// ---------------------------------------------------------------------------
export const COMPONENT_CATEGORIES = [
  "Clients",
  "Compute",
  "Databases",
  "Storage",
  "Networking",
  "Messaging",
  "Security",
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Routing strategies for the simulation engine
// ---------------------------------------------------------------------------
export type RoutingStrategy =
  | "all"
  | "round-robin"
  | "broadcast"
  | "none";

// ---------------------------------------------------------------------------
// Component definition
// ---------------------------------------------------------------------------
export interface ComponentDefinition {
  /** Display label used in the sidebar and dropdown */
  label: string;
  /** Grouping for the dropdown */
  category: ComponentCategory;
  /** Brief tooltip description */
  description: string;

  // --- Simulation defaults ---
  /** Default cloud instance type identifier */
  instanceType: string;
  /** Human-readable instance name */
  instanceName: string;
  /** Default maximum capacity in RPS */
  maxCapacity: number;

  // --- Simulation behaviour ---
  /** Whether this component accepts incoming traffic */
  acceptsIncoming: boolean;
  /** Whether this component forwards traffic downstream */
  forwardsOutgoing: boolean;
  /** Default routing strategy when forwarding */
  routingStrategy: RoutingStrategy;
}

// ---------------------------------------------------------------------------
// The registry — single source of truth
// ---------------------------------------------------------------------------
export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // ---- Clients ----
  Client: {
    label: "Client",
    category: "Clients",
    description:
      "Generates initial traffic/requests. Entry point for the system.",
    instanceType: "client.default",
    instanceName: "Client",
    maxCapacity: 0,
    acceptsIncoming: false,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },
  "Mobile Client": {
    label: "Mobile Client",
    category: "Clients",
    description:
      "Mobile application client that generates traffic from mobile devices.",
    instanceType: "client.mobile",
    instanceName: "Mobile Client",
    maxCapacity: 0,
    acceptsIncoming: false,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },
  "Web Application": {
    label: "Web Application",
    category: "Clients",
    description:
      "Browser-based web application that generates traffic.",
    instanceType: "client.web",
    instanceName: "Web Client",
    maxCapacity: 0,
    acceptsIncoming: false,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },

  // ---- Compute ----
  "Web Server": {
    label: "Web Server",
    category: "Compute",
    description:
      "Handles HTTP requests, serves static content, forwards dynamic requests.",
    instanceType: "m5.large",
    instanceName: "m5.large",
    maxCapacity: 1500,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },
  "App Server": {
    label: "App Server",
    category: "Compute",
    description:
      "Executes business logic. Interacts with databases and caches.",
    instanceType: "t3.medium",
    instanceName: "t3.medium",
    maxCapacity: 500,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },
  Server: {
    label: "Server",
    category: "Compute",
    description: "Generic server instance for general-purpose workloads.",
    instanceType: "t3.medium",
    instanceName: "t3.medium",
    maxCapacity: 500,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },
  "Multi Instance": {
    label: "Multi Instance",
    category: "Compute",
    description:
      "Auto-scaling group of instances behind a load balancer.",
    instanceType: "m5.large",
    instanceName: "m5.large",
    maxCapacity: 1500,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },
  Pipeline: {
    label: "Pipeline",
    category: "Compute",
    description:
      "Data processing pipeline (ETL / stream processing).",
    instanceType: "pipeline.standard",
    instanceName: "pipeline.standard",
    maxCapacity: 1000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },

  // ---- Databases ----
  Database: {
    label: "Database",
    category: "Databases",
    description:
      "Generic database for persistent storage. Terminal node — does not forward traffic.",
    instanceType: "db.m5.large",
    instanceName: "db.m5.large",
    maxCapacity: 2000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Relational DB": {
    label: "Relational DB",
    category: "Databases",
    description:
      "SQL-based relational database (PostgreSQL, MySQL, etc.).",
    instanceType: "db.m5.large",
    instanceName: "db.m5.large",
    maxCapacity: 2000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Document DB": {
    label: "Document DB",
    category: "Databases",
    description:
      "NoSQL document database (MongoDB, DynamoDB, etc.).",
    instanceType: "db.m5.large",
    instanceName: "db.m5.large",
    maxCapacity: 2000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Columnar DB": {
    label: "Columnar DB",
    category: "Databases",
    description:
      "Columnar database for analytical queries (Cassandra, ClickHouse).",
    instanceType: "db.r5.large",
    instanceName: "db.r5.large",
    maxCapacity: 3000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Graph DB": {
    label: "Graph DB",
    category: "Databases",
    description:
      "Graph database for relationship queries (Neo4j, Neptune).",
    instanceType: "db.r5.large",
    instanceName: "db.r5.large",
    maxCapacity: 2000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },

  // ---- Storage ----
  "Object Storage": {
    label: "Object Storage",
    category: "Storage",
    description:
      "Blob/object storage (S3, GCS). High-throughput terminal node.",
    instanceType: "s3.standard",
    instanceName: "s3.standard",
    maxCapacity: 10000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Cold Storage": {
    label: "Cold Storage",
    category: "Storage",
    description:
      "Archival cold storage (Glacier, Archive tier).",
    instanceType: "s3.glacier",
    instanceName: "s3.glacier",
    maxCapacity: 1000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  Archive: {
    label: "Archive",
    category: "Storage",
    description:
      "Long-term archival storage for compliance and backup.",
    instanceType: "s3.glacier",
    instanceName: "s3.glacier",
    maxCapacity: 1000,
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  Cache: {
    label: "Cache",
    category: "Storage",
    description:
      "In-memory data store (Redis, Memcached). Returns cached responses or falls back downstream.",
    instanceType: "cache.t3.medium",
    instanceName: "cache.t3.medium",
    maxCapacity: 5000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },

  // ---- Networking ----
  "Load Balancer": {
    label: "Load Balancer",
    category: "Networking",
    description:
      "Distributes traffic across targets using a configurable strategy.",
    instanceType: "alb.standard",
    instanceName: "ALB Standard",
    maxCapacity: 10000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },
  DNS: {
    label: "DNS",
    category: "Networking",
    description:
      "Domain Name System resolver (Route 53, Cloudflare DNS).",
    instanceType: "route53",
    instanceName: "route53",
    maxCapacity: 100000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },
  CDN: {
    label: "CDN",
    category: "Networking",
    description:
      "Content Delivery Network (CloudFront, Akamai). Edge caching & acceleration.",
    instanceType: "cdn.standard",
    instanceName: "cdn.standard",
    maxCapacity: 50000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },
  Cloud: {
    label: "Cloud",
    category: "Networking",
    description:
      "Cloud provider region / VPC boundary.",
    instanceType: "cloud",
    instanceName: "cloud",
    maxCapacity: 100000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },

  // ---- Messaging ----
  "Message Queue": {
    label: "Message Queue",
    category: "Messaging",
    description:
      "Asynchronous message broker (Kafka, SQS, RabbitMQ). Distributes messages to consumers sequentially.",
    instanceType: "mq.standard",
    instanceName: "MQ Standard",
    maxCapacity: 8000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin",
  },

  // ---- Security ----
  "Auth & IAM": {
    label: "Auth & IAM",
    category: "Security",
    description:
      "Authentication & Identity Access Management service.",
    instanceType: "auth.standard",
    instanceName: "auth.standard",
    maxCapacity: 5000,
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "all",
  },
};

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Ordered list of all component type keys */
export const ALL_COMPONENT_TYPES = Object.keys(COMPONENT_REGISTRY);

/** Components grouped by category (preserves category order) */
export function getComponentsByCategory(): {
  category: ComponentCategory;
  components: { key: string; def: ComponentDefinition }[];
}[] {
  return COMPONENT_CATEGORIES.map((cat) => ({
    category: cat,
    components: Object.entries(COMPONENT_REGISTRY)
      .filter(([, def]) => def.category === cat)
      .map(([key, def]) => ({ key, def })),
  })).filter((g) => g.components.length > 0);
}

/**
 * Returns the default instance config for a given component type key.
 * Falls back to a generic default if the key is unknown.
 */
export function getDefaultInstanceForType(
  componentType: string
): { instanceType: string; instanceName: string; maxCapacity: number } {
  const def = COMPONENT_REGISTRY[componentType];
  if (def) {
    return {
      instanceType: def.instanceType,
      instanceName: def.instanceName,
      maxCapacity: def.maxCapacity,
    };
  }
  // Fallback for unknown / legacy types
  return {
    instanceType: "generic",
    instanceName: "Generic",
    maxCapacity: 500,
  };
}

/**
 * Checks whether a component type is a client/source that generates traffic.
 */
export function isClientType(componentType: string): boolean {
  const def = COMPONENT_REGISTRY[componentType];
  return def ? !def.acceptsIncoming : false;
}

/**
 * Checks whether a component type acts as a load balancer.
 */
export function isLoadBalancerType(componentType: string): boolean {
  return componentType === "Load Balancer" || componentType === "ALB";
}
