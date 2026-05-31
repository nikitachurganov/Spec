/// <reference types="@figma/plugin-typings" />

export function findComponentPropertyKey(
  instance: InstanceNode,
  visibleName: string
): string | null {
  const props = instance.componentProperties ?? {};

  if (props[visibleName]) return visibleName;

  for (const [key] of Object.entries(props)) {
    if (key === visibleName || key.startsWith(`${visibleName}#`)) {
      return key;
    }
  }

  return null;
}

export function getComponentPropertyDefinitions(
  component: ComponentNode
): ComponentPropertyDefinitions {
  const parent = component.parent;
  if (parent?.type === 'COMPONENT_SET') {
    return parent.componentPropertyDefinitions;
  }
  return component.componentPropertyDefinitions ?? {};
}

export function findPropertyDefinition(
  definitions: ComponentPropertyDefinitions,
  visibleName: string
): ComponentPropertyDefinitions[string] | null {
  if (definitions[visibleName]) return definitions[visibleName];

  for (const [key, def] of Object.entries(definitions)) {
    if (key === visibleName || key.startsWith(`${visibleName}#`)) {
      return def;
    }
  }

  return null;
}

export function getVariantOptionsFromDefinitions(
  definitions: ComponentPropertyDefinitions,
  visibleName: string,
  fallback: readonly string[]
): string[] {
  const def = findPropertyDefinition(definitions, visibleName);
  if (
    def?.type === 'VARIANT' &&
    Array.isArray(def.variantOptions) &&
    def.variantOptions.length > 0
  ) {
    return [...def.variantOptions];
  }
  return [...fallback];
}

export function setPropertyByVisibleName(
  instance: InstanceNode,
  visibleName: string,
  value: string | boolean
): boolean {
  const key = findComponentPropertyKey(instance, visibleName);
  if (!key) {
    console.warn(`[Header] Property not found: ${visibleName}`);
    return false;
  }

  const prop = instance.componentProperties[key];
  if (!prop) {
    console.warn(`[Header] Property entry missing: ${visibleName}`);
    return false;
  }

  if (typeof value === 'boolean' && prop.type !== 'BOOLEAN') {
    console.warn(`[Header] Property "${visibleName}" is not boolean (type=${prop.type})`);
  }

  if (typeof value === 'string' && prop.type === 'BOOLEAN') {
    console.warn(`[Header] Property "${visibleName}" expects boolean, got string`);
    return false;
  }

  try {
    instance.setProperties({ [key]: value });
    return true;
  } catch (error) {
    console.warn(`[Header] Failed to set property "${visibleName}"`, error);
    if (typeof value === 'string') {
      console.warn(`[Header] Invalid ${visibleName} value: ${value}`);
    }
    return false;
  }
}

export async function findNestedStatusInstance(
  headerInstance: InstanceNode
): Promise<InstanceNode | null> {
  const instances = headerInstance.findAll((node) => node.type === 'INSTANCE');

  for (const node of instances) {
    if (node.type !== 'INSTANCE') continue;

    const nodeName = node.name ?? '';
    if (nodeName.includes('.DS-Status') || nodeName.includes('DS-Status')) {
      return node;
    }

    try {
      const mainComponent = await node.getMainComponentAsync();
      const mainName = mainComponent?.name ?? '';
      if (mainName.includes('.DS-Status') || mainName.includes('DS-Status')) {
        return node;
      }
    } catch {
      /* ignore and continue */
    }
  }

  return null;
}
