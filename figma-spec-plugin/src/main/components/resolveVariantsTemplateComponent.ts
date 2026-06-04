/// <reference types="@figma/plugin-typings" />

import { DEBUG_COMPONENTS_PROPERTIES_PERF } from './componentsPropertiesPerf';
import { resolveVariantsTemplateCached } from './templateLookupCache';
import {
  VARIANTS_TEMPLATE_MISSING_WARNING,
  VARIANTS_TEMPLATE_NAME,
  VARIANTS_TEMPLATE_UNAVAILABLE_MESSAGE,
} from './variantAxes';

const LOG_PREFIX = '[Components & properties]';

/** Set true to log all DS-Template-related local components in the file. */
export const DEBUG_TEMPLATE_LOOKUP = false;

let variantsTemplateMissingWarned = false;

export function resetVariantsTemplateLookupWarnings(): void {
  variantsTemplateMissingWarned = false;
}

export function normalizeTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^component\//, '')
    .replace(/^components\//, '');
}

export function isTemplateNameMatch(nodeName: string, targetName: string): boolean {
  const normalizedNode = normalizeTemplateName(nodeName);
  const normalizedTarget = normalizeTemplateName(targetName);
  const targetWithoutDot = normalizedTarget.replace(/^\./, '');

  return (
    normalizedNode === normalizedTarget ||
    normalizedNode.includes(targetWithoutDot) ||
    normalizedNode.endsWith(targetWithoutDot)
  );
}

function findNodePageName(node: BaseNode): string {
  let current: BaseNode | null = node.parent;
  while (current) {
    if (current.type === 'PAGE') return current.name;
    current = current.parent;
  }
  return 'unknown';
}

export function pickVariantFromComponentSet(setNode: ComponentSetNode): ComponentNode | null {
  const defaultVariant = setNode.defaultVariant;
  if (defaultVariant?.type === 'COMPONENT') {
    return defaultVariant;
  }

  const firstComponent = setNode.children.find(
    (child): child is ComponentNode => child.type === 'COMPONENT'
  );
  return firstComponent ?? null;
}


export function logTemplateCandidates(): void {
  if (!DEBUG_TEMPLATE_LOOKUP) return;

  const candidates = figma.root.findAll((node) => {
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false;
    const name = node.name.toLowerCase();
    return (
      name.includes('ds-template') ||
      name.includes('template') ||
      name.includes('variants') ||
      name.includes('asset-group') ||
      name.includes('bracket')
    );
  });

  console.debug(
    `${LOG_PREFIX} Template candidates`,
    candidates.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      page: findNodePageName(node),
    }))
  );
}

/** Logs similar names once when the exact template was not resolved. */
export function logSimilarTemplateCandidatesOnMiss(): void {
  if (!DEBUG_COMPONENTS_PROPERTIES_PERF) return;
  const candidates = figma.root.findAll((node) => {
    if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false;
    const name = node.name.toLowerCase();
    return (
      name.includes('ds-template') ||
      name.includes('template-variants') ||
      name.includes('ds-template-variants') ||
      (name.includes('variants') && name.includes('template'))
    );
  });

  if (candidates.length === 0) {
    console.warn(`${LOG_PREFIX} No similar DS-Template candidates found in the file.`);
    return;
  }

  console.warn(
    `${LOG_PREFIX} Similar template candidates in file:`,
    candidates.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      page: findNodePageName(node),
    }))
  );
}

export const VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE = `[Components & properties] Template "${VARIANTS_TEMPLATE_NAME}" was not found locally, by configured key, or among available published library components.`;

export function warnVariantsTemplateMissing(): void {
  if (variantsTemplateMissingWarned) return;
  variantsTemplateMissingWarned = true;
  console.warn(VARIANTS_TEMPLATE_MISSING_WARNING);
  console.warn(VARIANTS_TEMPLATE_UNAVAILABLE_MESSAGE);
  logSimilarTemplateCandidatesOnMiss();
}

export async function resolveVariantsTemplateComponent(): Promise<ComponentNode | null> {
  return resolveVariantsTemplateCached();
}
