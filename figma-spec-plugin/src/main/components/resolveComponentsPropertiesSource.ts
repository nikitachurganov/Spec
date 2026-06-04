/// <reference types="@figma/plugin-typings" />

export type ComponentsPropertiesSourceKind =
  | 'component-set'
  | 'component'
  | 'child-component'
  | 'instance'
  | 'frame'
  | 'unsupported';

export type ComponentsPropertiesSourceInfo = {
  initialSource: SceneNode;
  resolvedComponentSet: ComponentSetNode | null;
  sourceKind: ComponentsPropertiesSourceKind;
};

export async function resolveComponentsPropertiesSource(
  source: SceneNode
): Promise<ComponentsPropertiesSourceInfo> {
  if (source.type === 'COMPONENT_SET') {
    return {
      initialSource: source,
      resolvedComponentSet: source,
      sourceKind: 'component-set',
    };
  }

  if (source.type === 'COMPONENT' && source.parent?.type === 'COMPONENT_SET') {
    return {
      initialSource: source,
      resolvedComponentSet: source.parent,
      sourceKind: 'child-component',
    };
  }

  if (source.type === 'COMPONENT') {
    return {
      initialSource: source,
      resolvedComponentSet: null,
      sourceKind: 'component',
    };
  }

  if (source.type === 'INSTANCE') {
    const main = await source.getMainComponentAsync();
    if (main?.parent?.type === 'COMPONENT_SET') {
      return {
        initialSource: source,
        resolvedComponentSet: main.parent,
        sourceKind: 'instance',
      };
    }
    return {
      initialSource: source,
      resolvedComponentSet: null,
      sourceKind: 'unsupported',
    };
  }

  if (source.type === 'FRAME') {
    return {
      initialSource: source,
      resolvedComponentSet: null,
      sourceKind: 'frame',
    };
  }

  return {
    initialSource: source,
    resolvedComponentSet: null,
    sourceKind: 'unsupported',
  };
}

/** @deprecated Use resolveComponentsPropertiesSource */
export async function resolveComponentSetFromSource(
  source: SceneNode
): Promise<ComponentSetNode | null> {
  const info = await resolveComponentsPropertiesSource(source);
  return info.resolvedComponentSet;
}
