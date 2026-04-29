import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ComponentCustomData } from "@/lib/simulation/types";

export function getNextNameForType(type: string, elements: readonly ExcalidrawElement[]): string {
  let maxNum = 0;
  elements.forEach(el => {
    const data = el.customData as ComponentCustomData;
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
