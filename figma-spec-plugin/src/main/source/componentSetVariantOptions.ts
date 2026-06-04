/// <reference types="@figma/plugin-typings" />

import type { ComponentSetVariantOption } from '../../shared/componentSetVariants';

const LOG_PREFIX = '[Spec]';

export function getVariantOptionLabel(component: ComponentNode): string {
  const props = component.variantProperties;
  if (props && Object.keys(props).length > 0) {
    return Object.entries(props)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' / ');
  }
  return component.name || component.id;
}

export function loadComponentSetVariantOptions(
  componentSet: ComponentSetNode
): ComponentSetVariantOption[] {
  const options: ComponentSetVariantOption[] = [];

  for (const child of componentSet.children) {
    if (child.type !== 'COMPONENT') continue;
    const variantProperties = child.variantProperties;
    options.push({
      id: child.id,
      name: child.name,
      label: getVariantOptionLabel(child),
      variantProperties: variantProperties ? { ...variantProperties } : undefined,
      isDefault: componentSet.defaultVariant?.id === child.id,
    });
  }

  return options;
}

export function resolveDefaultVariantId(
  componentSet: ComponentSetNode,
  options: ComponentSetVariantOption[]
): string | null {
  const defaultVariant = componentSet.defaultVariant;
  if (defaultVariant?.type === 'COMPONENT') {
    return defaultVariant.id;
  }

  const markedDefault = options.find((option) => option.isDefault);
  if (markedDefault) {
    return markedDefault.id;
  }

  return options[0]?.id ?? null;
}

export type ResolveAnatomySpecSourceResult =
  | { ok: true; source: SceneNode; variantId?: string }
  | { ok: false; message: string };

async function getComponentVariantById(
  variantId: string,
  componentSet: ComponentSetNode
): Promise<ComponentNode | null> {
  try {
    const node = await figma.getNodeByIdAsync(variantId);
    if (node?.type !== 'COMPONENT') {
      return null;
    }
    if (node.parent?.id !== componentSet.id) {
      console.warn(
        `${LOG_PREFIX} Selected variant does not belong to the active Component Set. Falling back to default variant.`
      );
      return null;
    }
    return node;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to resolve variant by id "${variantId}".`, error);
    return null;
  }
}

export async function resolveAnatomySpecGenerationSource(
  sourceNode: SceneNode,
  selectedVariantId?: string | null
): Promise<ResolveAnatomySpecSourceResult> {
  if (sourceNode.type !== 'COMPONENT_SET') {
    return { ok: true, source: sourceNode };
  }

  const componentSet = sourceNode;
  const options = loadComponentSetVariantOptions(componentSet);
  if (options.length === 0) {
    return {
      ok: false,
      message: 'Component Set does not contain variants for Anatomy and Spec generation.',
    };
  }

  let variantId = selectedVariantId?.trim() || null;
  if (variantId) {
    const resolved = await getComponentVariantById(variantId, componentSet);
    if (resolved) {
      return { ok: true, source: resolved, variantId: resolved.id };
    }
    variantId = resolveDefaultVariantId(componentSet, options);
  } else {
    variantId = resolveDefaultVariantId(componentSet, options);
  }

  if (!variantId) {
    return {
      ok: false,
      message: 'Component Set does not contain variants for Anatomy and Spec generation.',
    };
  }

  const fallback = await getComponentVariantById(variantId, componentSet);
  if (fallback) {
    return { ok: true, source: fallback, variantId: fallback.id };
  }

  const firstChild = componentSet.children.find(
    (child): child is ComponentNode => child.type === 'COMPONENT'
  );
  if (firstChild) {
    return { ok: true, source: firstChild, variantId: firstChild.id };
  }

  return {
    ok: false,
    message: 'Component Set does not contain variants for Anatomy and Spec generation.',
  };
}
