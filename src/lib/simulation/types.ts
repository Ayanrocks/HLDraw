export interface ComponentCustomData {
  componentType?: string;
  name?: string;
  instanceType?: string;
  maxCapacity?: number;
  /** Number of replica instances (horizontal scaling). Defaults to 1. */
  replicas?: number;
  sourceRps?: number;
  lbStrategy?: string;
  wasSimulating?: boolean;
  originalColor?: string;
  [key: string]: unknown;
}
