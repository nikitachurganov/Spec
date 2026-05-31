/// <reference types="@figma/plugin-typings" />

/**
 * Local Header template resolution.
 *
 * `.DS-Template-header/Default` is an unpublished local component. It must exist in the
 * current file, or the user must manually bind a local component via clientStorage.
 *
 * `figma.importComponentByKeyAsync` is not used here — components from another file
 * cannot be imported unless published to a library.
 */

import { STORAGE_KEY_HEADER_TEMPLATE } from '../../shared/constants';
import {
  HEADER_COMPONENT_NAME,
  HEADER_TEMPLATE_ERROR_MESSAGE,
} from '../../shared/headerSettings';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import { normalizeTokenName } from '../tokens/styleResolver';

export { HEADER_TEMPLATE_ERROR_MESSAGE };

export const DEBUG_HEADER_TEMPLATE_RESOLVE = false;

let cachedHeaderComponent: ComponentNode | null = null;

function logHeaderTemplateDebug(label: string, payload: unknown): void {
  if (!DEBUG_HEADER_TEMPLATE_RESOLVE) return;
  console.debug(`[Header Template] ${label}`, payload);
}

export function clearHeaderComponentCache(): void {
  cachedHeaderComponent = null;
}

function resolveDefaultVariantFromSet(setNode: ComponentSetNode): ComponentNode | null {
  const def =
    (setNode.defaultVariant as ComponentNode | undefined) ??
    (setNode.children.find(
      (child) =>
        child.type === 'COMPONENT' && normalizeTokenName(child.name) === 'default'
    ) as ComponentNode | undefined);

  return def?.type === 'COMPONENT' ? def : null;
}

function isExactHeaderComponentName(name: string): boolean {
  return normalizeTokenName(name) === normalizeTokenName(HEADER_COMPONENT_NAME);
}

function isHeaderComponentCandidateName(name: string): boolean {
  const normalized = normalizeTokenName(name);
  if (isExactHeaderComponentName(name)) return true;
  if (normalized.includes('ds-template-header') && normalized.endsWith('/default')) {
    return true;
  }
  return normalized.includes('ds-template-header');
}

export async function resolveSavedHeaderTemplateComponent(): Promise<ComponentNode | null> {
  let savedId: unknown;
  try {
    savedId = await figma.clientStorage.getAsync(STORAGE_KEY_HEADER_TEMPLATE);
  } catch (error) {
    console.warn('[Header] Failed to read saved header template id', error);
    return null;
  }

  if (!savedId || typeof savedId !== 'string') {
    return null;
  }

  let node: BaseNode | null = null;
  try {
    node = await figma.getNodeByIdAsync(savedId);
  } catch (error) {
    console.warn('[Header] Failed to resolve saved header template node', error);
  }

  if (!node || node.removed || node.type !== 'COMPONENT') {
    try {
      await figma.clientStorage.deleteAsync(STORAGE_KEY_HEADER_TEMPLATE);
    } catch {
      /* ignore */
    }
    logHeaderTemplateDebug('stale saved template cleared', savedId);
    return null;
  }

  logHeaderTemplateDebug('using saved template', { id: node.id, name: node.name });
  return node;
}

export async function findLocalHeaderComponentByName(): Promise<ComponentNode | null> {
  await ensureDocumentReadyForTraversal();

  const exactMatches: ComponentNode[] = [];
  const fallbackMatches: ComponentNode[] = [];

  for (const child of figma.root.children) {
    if (child.type !== 'PAGE') continue;

    const page = child;
    if (typeof page.loadAsync === 'function') {
      try {
        await page.loadAsync();
      } catch (error) {
        console.warn('[Header] Failed to load page for header search', page.name, error);
        continue;
      }
    }

    const hits = page.findAll(
      (node): node is ComponentNode | ComponentSetNode =>
        node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
    );

    for (const node of hits) {
      if (node.type === 'COMPONENT') {
        if (isExactHeaderComponentName(node.name)) {
          exactMatches.push(node);
          continue;
        }
        if (isHeaderComponentCandidateName(node.name)) {
          fallbackMatches.push(node);
        }
        continue;
      }

      if (node.type === 'COMPONENT_SET') {
        const setName = node.name;
        if (
          normalizeTokenName(setName) === normalizeTokenName('.DS-Template-header') ||
          isHeaderComponentCandidateName(setName)
        ) {
          const variant = resolveDefaultVariantFromSet(node);
          if (variant) {
            if (isExactHeaderComponentName(variant.name) || isExactHeaderComponentName(setName)) {
              exactMatches.push(variant);
            } else {
              fallbackMatches.push(variant);
            }
          }
        }
      }
    }
  }

  if (exactMatches.length > 0) {
    logHeaderTemplateDebug('found by exact name', exactMatches[0].name);
    return exactMatches[0];
  }

  if (fallbackMatches.length > 0) {
    logHeaderTemplateDebug('found by fallback name match', fallbackMatches[0].name);
    return fallbackMatches[0];
  }

  return null;
}

/** @deprecated Use resolveLocalHeaderComponent */
export async function findLocalHeaderComponent(): Promise<ComponentNode | null> {
  return findLocalHeaderComponentByName();
}

export async function resolveLocalHeaderComponent(): Promise<ComponentNode | null> {
  if (cachedHeaderComponent && !cachedHeaderComponent.removed) {
    return cachedHeaderComponent;
  }

  const saved = await resolveSavedHeaderTemplateComponent();
  if (saved) {
    cachedHeaderComponent = saved;
    return saved;
  }

  const byName = await findLocalHeaderComponentByName();
  if (byName) {
    cachedHeaderComponent = byName;
    return byName;
  }

  return null;
}

/** @deprecated Use resolveLocalHeaderComponent */
export async function resolveHeaderComponent(): Promise<ComponentNode | null> {
  return resolveLocalHeaderComponent();
}

export function notifyHeaderComponentMissing(): void {
  console.warn(`[Header] ${HEADER_TEMPLATE_ERROR_MESSAGE}`);
  try {
    figma.notify(HEADER_TEMPLATE_ERROR_MESSAGE, { error: true });
  } catch {
    /* ignore notify failures */
  }
}

export async function saveHeaderTemplateFromSelection():
  Promise<
    | { ok: true; componentId: string; componentName: string }
    | { ok: false; message: string }
  > {
  const selected = figma.currentPage.selection;

  if (selected.length !== 1 || selected[0].type !== 'COMPONENT') {
    return {
      ok: false,
      message: 'Выберите локальный компонент шапки документации.',
    };
  }

  const component = selected[0];

  try {
    await figma.clientStorage.setAsync(STORAGE_KEY_HEADER_TEMPLATE, component.id);
    clearHeaderComponentCache();
    return {
      ok: true,
      componentId: component.id,
      componentName: component.name,
    };
  } catch (error) {
    console.warn('[Header] Failed to save header template', error);
    return {
      ok: false,
      message: 'Не удалось сохранить Header template.',
    };
  }
}
