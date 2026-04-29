import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export function getNextNameForType(type: string, elements: readonly ExcalidrawElement[]): string {
  let maxNum = 0;
  elements.forEach(el => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = el.customData as any;
    if (data?.componentType === type && data?.name) {
      // Escape type string for regex to avoid regex errors if type has special characters
      const escapedType = type.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const match = data.name.match(new RegExp(`^${escapedType} (\\d+)$`));
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    }
  });
  return `${type} ${maxNum + 1}`;
}
