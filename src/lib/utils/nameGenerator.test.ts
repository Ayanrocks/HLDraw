import { describe, it, expect } from 'vitest';
import { getNextNameForType } from './nameGenerator';
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

describe('nameGenerator', () => {
  it('should generate "Type 1" when there are no elements of that type', () => {
    const elements: ExcalidrawElement[] = [];
    const nextName = getNextNameForType('Client', elements);
    expect(nextName).toBe('Client 1');
  });

  it('should find the highest number and increment it', () => {
    const elements: ExcalidrawElement[] = [
      { id: '1', customData: { componentType: 'Client', name: 'Client 1' } } as unknown as ExcalidrawElement,
      { id: '2', customData: { componentType: 'Client', name: 'Client 4' } } as unknown as ExcalidrawElement,
      { id: '3', customData: { componentType: 'Client', name: 'Client 2' } } as unknown as ExcalidrawElement,
    ];

    const nextName = getNextNameForType('Client', elements);
    expect(nextName).toBe('Client 5');
  });

  it('should ignore elements of different types', () => {
    const elements: ExcalidrawElement[] = [
      { id: '1', customData: { componentType: 'ALB', name: 'ALB 2' } } as unknown as ExcalidrawElement,
      { id: '2', customData: { componentType: 'Client', name: 'Client 1' } } as unknown as ExcalidrawElement,
    ];

    const nextName = getNextNameForType('ALB', elements);
    expect(nextName).toBe('ALB 3');
  });

  it('should safely handle types with special regex characters', () => {
    const typeWithSpecialChars = 'Node (Special) [Type]';
    const elements: ExcalidrawElement[] = [
      { id: '1', customData: { componentType: typeWithSpecialChars, name: 'Node (Special) [Type] 2' } } as unknown as ExcalidrawElement,
    ];

    const nextName = getNextNameForType(typeWithSpecialChars, elements);
    expect(nextName).toBe('Node (Special) [Type] 3');
  });

  it('should ignore names that do not match the exact pattern', () => {
    const elements: ExcalidrawElement[] = [
      { id: '1', customData: { componentType: 'Client', name: 'Client 1 Backup' } } as unknown as ExcalidrawElement,
      { id: '2', customData: { componentType: 'Client', name: 'My Custom Client' } } as unknown as ExcalidrawElement,
    ];

    const nextName = getNextNameForType('Client', elements);
    expect(nextName).toBe('Client 1'); // Since there are no valid "Client X" names, it starts at 1
  });
});
