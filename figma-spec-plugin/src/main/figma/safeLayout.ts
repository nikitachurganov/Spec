/// <reference types="@figma/plugin-typings" />

/** Minimum visual height for Spec container cards (Container card / Container preview card). */
export const SPEC_CARD_MIN_HEIGHT = 360;

/** Minimum visual height for Container card content (Hug + floor). */
export const CONTAINER_CARD_CONTENT_MIN_HEIGHT = 300;

export type CounterAxisAlign = 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';

type LayoutAlignTarget = FrameNode | ComponentNode | InstanceNode;

export function safeSetCounterAxisAlignItems(
  node: LayoutAlignTarget,
  value: CounterAxisAlign,
  context: string
): void {
  try {
    node.counterAxisAlignItems = value;
  } catch (error) {
    console.warn(
      `[Layout] Failed to set counterAxisAlignItems for ${context} to ${value}`,
      error
    );
  }
}

/** Maps invalid legacy values; never passes STRETCH to counterAxisAlignItems. */
export function normalizeCounterAxisAlignItems(
  value: string | undefined,
  context: string
): CounterAxisAlign | undefined {
  if (value === undefined) return undefined;
  if (value === 'STRETCH') {
    console.warn(
      `[Layout] counterAxisAlignItems STRETCH is invalid for ${context}; using CENTER`
    );
    return 'CENTER';
  }
  if (value === 'MIN' || value === 'MAX' || value === 'CENTER' || value === 'BASELINE') {
    return value;
  }
  console.warn(
    `[Layout] counterAxisAlignItems "${value}" is invalid for ${context}; using MIN`
  );
  return 'MIN';
}

export function ensureMinHeight(node: FrameNode, minHeight: number): void {
  if (!(minHeight > 0) || node.height >= minHeight) return;

  try {
    node.resizeWithoutConstraints(node.width, minHeight);
  } catch {
    try {
      node.resize(node.width, minHeight);
    } catch (error) {
      console.warn(
        `[Layout] Failed to apply min height ${minHeight} to ${node.name || 'frame'}`,
        error
      );
    }
  }
}
