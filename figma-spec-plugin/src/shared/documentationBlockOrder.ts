/**
 * Canonical generated documentation block order (inside the specification frame).
 * UI toggle order may differ; generation must always follow this sequence.
 */
export const DOCUMENTATION_BLOCK_ORDER = [
  'componentsProperties',
  'anatomy',
  'behavior',
  'useCase',
  'spec',
  'accessibility',
  'themes',
] as const;

export type DocumentationBlockId = (typeof DOCUMENTATION_BLOCK_ORDER)[number];
