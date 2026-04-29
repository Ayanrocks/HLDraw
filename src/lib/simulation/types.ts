export interface ComponentCustomData {
  componentType?: string;
  name?: string;
  instanceType?: string;
  maxCapacity?: number;
  lbStrategy?: string;
  wasSimulating?: boolean;
  originalColor?: string;
  [key: string]: unknown;
}
