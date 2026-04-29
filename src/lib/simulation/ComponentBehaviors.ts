export type ComponentType = "Client" | "ALB" | "Web Server" | "App Server" | "DB" | "Cache" | "Message Queue";

export interface ComponentBehavior {
  type: ComponentType;
  description: string;
  acceptsIncoming: boolean;
  forwardsOutgoing: boolean;
  routingStrategy: "all" | "round-robin" | "hash" | "none" | "broadcast";
}

export const COMPONENT_BEHAVIORS: Record<string, ComponentBehavior> = {
  "Client": {
    type: "Client",
    description: "Generates initial traffic/requests. Does not accept incoming traffic.",
    acceptsIncoming: false,
    forwardsOutgoing: true,
    routingStrategy: "all", // Clients push traffic to whatever they are connected to
  },
  "ALB": {
    type: "ALB",
    description: "Application Load Balancer. Distributes traffic across connected targets using a specified strategy.",
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin", // User mentioned "algorithm specified". Defaults to round-robin.
  },
  "Web Server": {
    type: "Web Server",
    description: "Handles HTTP requests and serves static content, forwards dynamic requests to App Servers.",
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin", // Send traffic forward equally in alternate fashion
  },
  "App Server": {
    type: "App Server",
    description: "Executes business logic. Interacts with DBs and Caches.",
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "round-robin", // Send traffic forward equally in alternate fashion
  },
  "DB": {
    type: "DB",
    description: "Database for persistent storage. Only accepts connections, does not forward traffic.",
    acceptsIncoming: true,
    forwardsOutgoing: false,
    routingStrategy: "none",
  },
  "Cache": {
    type: "Cache",
    description: "In-memory data store. Returns cached responses or falls back to DB.",
    acceptsIncoming: true,
    forwardsOutgoing: true, // Only forwards cache misses
    routingStrategy: "all",
  },
  "Message Queue": {
    type: "Message Queue",
    description: "Asynchronous message broker. Accepts messages and distributes to consumers.",
    acceptsIncoming: true,
    forwardsOutgoing: true,
    routingStrategy: "broadcast", // Messages are pulled or pushed to consumers
  }
};
