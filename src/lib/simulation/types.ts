export interface ComponentCustomData {
  componentType?: string;
  name?: string;
  instanceType?: string;
  maxCapacity?: number;
  sourceRps?: number;
  lbStrategy?: string;
  wasSimulating?: boolean;
  originalColor?: string;
  [key: string]: unknown;
}
