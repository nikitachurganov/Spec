/// <reference types="@figma/plugin-typings" />

import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { VARIANTS_TEMPLATE_MISSING_WARNING, VARIANTS_TEMPLATE_NAME } from './variantAxes';

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

function pickVariantFromComponentSet(setNode: ComponentSetNode): ComponentNode | null {
  const defaultVariant = setNode.defaultVariant;
  if (defaultVariant?.type === 'COMPONENT') {
    return defaultVariant;
  }

  const firstComponent = setNode.children.find(
    (child): child is ComponentNode => child.type === 'COMPONENT'
  );
  return firstComponent ?? null;
}

function findChildVariantInSets(targetName: string): ComponentNode | null {
  const sets = figma.root.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[];

  for (const set of sets) {
    const namedChild = set.children.find(
      (child: SceneNode): child is ComponentNode =>
        child.type === 'COMPONENT' && child.name === targetName
    );
    if (namedChild) return namedChild;

    const looseChild = set.children.find(
      (child: SceneNode): child is ComponentNode =>
        child.type === 'COMPONENT' && isTemplateNameMatch(child.name, targetName)
    );
    if (looseChild) return looseChild;
  }

  return null;
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

export const VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE =
  `[Components & properties] Local template "${VARIANTS_TEMPLATE_NAME}" was not found in figma.root. Make sure the template exists in the current file as a COMPONENT or COMPONENT_SET.`;

export function warnVariantsTemplateMissing(): void {
  if (variantsTemplateMissingWarned) return;
  variantsTemplateMissingWarned = true;
  console.warn(VARIANTS_TEMPLATE_MISSING_WARNING);
  console.warn(VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE);
  logSimilarTemplateCandidatesOnMiss();
}

/**
 * Resolves `.DS-Template-variants` anywhere in the current file (all pages).
 * Supports local COMPONENT, COMPONENT_SET (default/first variant), and child variants inside sets.
 */
export async function resolveVariantsTemplateComponent(): Promise<ComponentNode | null> {
  await ensureDocumentReadyForTraversal();
  logTemplateCandidates();

  const exactComponents = figma.root.findAll(
    (node) => node.type === 'COMPONENT' && node.name === VARIANTS_TEMPLATE_NAME
  ) as ComponentNode[];
  if (exactComponents[0]) {
    if (DEBUG_TEMPLATE_LOOKUP) {
      console.debug(`${LOG_PREFIX} Resolved exact COMPONENT`, exactComponents[0].name);
    }
    return exactComponents[0];
  }

  const exactComponentSets = figma.root.findAll(
    (node) => node.type === 'COMPONENT_SET' && node.name === VARIANTS_TEMPLATE_NAME
  ) as ComponentSetNode[];
  if (exactComponentSets[0]) {
    const picked = pickVariantFromComponentSet(exactComponentSets[0]);
    if (picked) {
      if (DEBUG_TEMPLATE_LOOKUP) {
        console.debug(`${LOG_PREFIX} Resolved from exact COMPONENT_SET`, picked.name);
      }
      return picked;
    }
  }

  const childInSet = findChildVariantInSets(VARIANTS_TEMPLATE_NAME);
  if (childInSet) {
    if (DEBUG_TEMPLATE_LOOKUP) {
      console.debug(`${LOG_PREFIX} Resolved child variant in COMPONENT_SET`, childInSet.name);
    }
    return childInSet;
  }

  const looseComponents = figma.root.findAll(
    (node) => node.type === 'COMPONENT' && isTemplateNameMatch(node.name, VARIANTS_TEMPLATE_NAME)
  ) as ComponentNode[];
  if (looseComponents[0]) {
    if (DEBUG_TEMPLATE_LOOKUP) {
      console.debug(`${LOG_PREFIX} Resolved loose COMPONENT`, looseComponents[0].name);
    }
    return looseComponents[0];
  }

  const looseComponentSets = figma.root.findAll(
    (node) =>
      node.type === 'COMPONENT_SET' && isTemplateNameMatch(node.name, VARIANTS_TEMPLATE_NAME)
  ) as ComponentSetNode[];
  if (looseComponentSets[0]) {
    const picked = pickVariantFromComponentSet(looseComponentSets[0]);
    if (picked) {
      if (DEBUG_TEMPLATE_LOOKUP) {
        console.debug(`${LOG_PREFIX} Resolved loose COMPONENT_SET`, picked.name);
      }
      return picked;
    }
  }

  return null;
}
