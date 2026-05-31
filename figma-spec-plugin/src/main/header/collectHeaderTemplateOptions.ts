/// <reference types="@figma/plugin-typings" />

import {
  DEFAULT_STATUS_OPTIONS,
  DEFAULT_STATUS_SIZE_OPTIONS,
  type HeaderSettings,
} from '../../shared/headerSettings';
import { findDsTemplateHeader } from '../builders/specificationWrapper';
import {
  findNestedStatusInstance,
  getComponentPropertyDefinitions,
  getVariantOptionsFromDefinitions,
} from './headerComponentProperties';
import { normalizeTokenName } from '../tokens/styleResolver';
import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';

export type HeaderTemplateOptions = {
  headerFound: boolean;
  statusOptions: string[];
  statusSizeOptions: string[];
};

async function findDsStatusComponent(): Promise<ComponentNode | null> {
  await ensureDocumentReadyForTraversal();

  const statusMatch = normalizeTokenName('.DS-Status');

  for (const child of figma.root.children) {
    if (child.type !== 'PAGE') continue;

    const page = child;
    if (typeof page.loadAsync === 'function') {
      try {
        await page.loadAsync();
      } catch (error) {
        console.warn('[Header] Failed to load page for status search', page.name, error);
        continue;
      }
    }

    const hits = page.findAll(
      (n): n is ComponentNode | ComponentSetNode =>
        n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
    );

    for (const node of hits) {
      if (node.type === 'COMPONENT' && normalizeTokenName(node.name) === statusMatch) {
        return node;
      }
      if (node.type === 'COMPONENT_SET' && normalizeTokenName(node.name) === statusMatch) {
        const def =
          (node.defaultVariant as ComponentNode | undefined) ??
          (node.children.find(
            (ch) => ch.type === 'COMPONENT' && normalizeTokenName(ch.name) === 'default'
          ) as ComponentNode | undefined);
        if (def?.type === 'COMPONENT') return def;
      }
    }
  }

  return null;
}

export async function collectHeaderTemplateOptions(): Promise<HeaderTemplateOptions> {
  const headerComponent = await findDsTemplateHeader();
  if (!headerComponent) {
    return {
      headerFound: false,
      statusOptions: [...DEFAULT_STATUS_OPTIONS],
      statusSizeOptions: [...DEFAULT_STATUS_SIZE_OPTIONS],
    };
  }

  let statusOptions: string[] = [...DEFAULT_STATUS_OPTIONS];
  let statusSizeOptions: string[] = [...DEFAULT_STATUS_SIZE_OPTIONS];

  try {
    const statusComponent =
      (await findDsStatusComponent()) ?? (await readStatusComponentFromHeader(headerComponent));

    if (statusComponent) {
      const definitions = getComponentPropertyDefinitions(statusComponent);
      statusOptions = getVariantOptionsFromDefinitions(definitions, 'Status', statusOptions);
      statusSizeOptions = getVariantOptionsFromDefinitions(
        definitions,
        'Size',
        statusSizeOptions
      );
    }
  } catch (error) {
    console.warn('[Header] Failed to read template property options', error);
  }

  return {
    headerFound: true,
    statusOptions,
    statusSizeOptions,
  };
}

async function readStatusComponentFromHeader(
  headerComponent: ComponentNode
): Promise<ComponentNode | null> {
  let tempInstance: InstanceNode | null = null;
  try {
    tempInstance = headerComponent.createInstance();
    const nested = await findNestedStatusInstance(tempInstance);
    if (!nested) return null;
    return (await nested.getMainComponentAsync()) ?? null;
  } catch (error) {
    console.warn('[Header] Failed to inspect nested status component', error);
    return null;
  } finally {
    try {
      tempInstance?.remove();
    } catch {
      /* ignore */
    }
  }
}

export function sanitizeHeaderSettingsAgainstOptions(
  headerSettings: HeaderSettings,
  options: HeaderTemplateOptions
): HeaderSettings {
  const status = options.statusOptions.includes(headerSettings.status)
    ? headerSettings.status
    : options.statusOptions[0] ?? headerSettings.status;

  const statusSize = options.statusSizeOptions.includes(headerSettings.statusSize)
    ? headerSettings.statusSize
    : options.statusSizeOptions[0] ?? headerSettings.statusSize;

  return {
    ...headerSettings,
    status,
    statusSize,
  };
}
