/// <reference types="@figma/plugin-typings" />

import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { DEBUG_COMPONENTS_PROPERTIES } from './variantAxes';

const LOG_PREFIX = '[Components & properties]';

export function normalizeComponentLookupName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^component\s*/i, '');
}

async function collectComponentsFromDocument(): Promise<ComponentNode[]> {
  const matches: ComponentNode[] = [];

  for (const child of figma.root.children) {
    if (child.type !== 'PAGE') continue;

    const page = child;
    if (typeof page.loadAsync === 'function') {
      try {
        await page.loadAsync();
      } catch (error) {
        console.warn('[Components] Failed to load page for component search', page.name, error);
        continue;
      }
    }

    const hits = page.findAll((node) => node.type === 'COMPONENT') as ComponentNode[];
    matches.push(...hits);
  }

  return matches;
}

/** Lists local components whose normalized name includes the query (for debug). */
export async function findLocalComponentCandidates(
  substring: string
): Promise<ComponentNode[]> {
  const normalizedQuery = normalizeComponentLookupName(substring);
  if (!normalizedQuery) return [];

  const all = await collectComponentsFromDocument();
  return all.filter((node) =>
    normalizeComponentLookupName(node.name).includes(normalizedQuery)
  );
}

/**
 * Finds a local component by exact name, then loose normalized name match.
 * Searches all pages under `figma.root` (not only the current page).
 */
export async function findLocalComponentByName(name: string): Promise<ComponentNode | null> {
  await ensureDocumentReadyForTraversal();

  const allComponents = await collectComponentsFromDocument();
  const exact = allComponents.filter((node) => node.name === name);
  if (exact[0]) {
    if (DEBUG_COMPONENTS_PROPERTIES) {
      console.log(`${LOG_PREFIX} template exact match`, exact[0].name, exact[0].id);
    }
    return exact[0];
  }

  const normalizedTarget = normalizeComponentLookupName(name);
  const loose = allComponents.filter((node) =>
    normalizeComponentLookupName(node.name).includes(normalizedTarget)
  );

  if (DEBUG_COMPONENTS_PROPERTIES && loose.length > 0) {
    console.log(
      `${LOG_PREFIX} template loose matches`,
      loose.map((n) => ({ name: n.name, id: n.id }))
    );
  }

  return loose[0] ?? null;
}
