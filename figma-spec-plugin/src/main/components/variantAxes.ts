/// <reference types="@figma/plugin-typings" />

export type VariantAxis = {
  name: string;
  values: string[];
};

export type VariantCell = {
  properties: Record<string, string>;
  component: ComponentNode;
};

export const VARIANTS_TEMPLATE_NAME = '.DS-Template-variants';
export const ASSET_GROUP_TEMPLATE_NAME = '.DS-Template-asset-group';
export const BRACKET_TEMPLATE_NAME = '.DS-Template-Bracket';

export const VARIANTS_TEMPLATE_MISSING_WARNING =
  '[Components & properties] .DS-Template-variants not found. Using fallback layout.';

export const NOT_COMPONENT_SET_MESSAGE =
  'Components & properties: выбранный объект не является component set или вариантом компонента';

export const NO_VARIANTS_MESSAGE =
  'Components & properties: у component set не найдены variant properties';

export const ASSET_GROUP_MISSING_MESSAGE =
  'Не найден вложенный компонент .DS-Template-asset-group';

export const DEBUG_COMPONENTS_PROPERTIES = false;

function parseVariantName(name: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of name.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function getVariantPropertiesForComponent(component: ComponentNode): Record<string, string> {
  const fromApi = component.variantProperties;
  if (fromApi && Object.keys(fromApi).length > 0) {
    return { ...fromApi };
  }
  return parseVariantName(component.name);
}

export function getVariantAxes(componentSet: ComponentSetNode): VariantAxis[] {
  const axesMap = new Map<string, Set<string>>();

  for (const child of componentSet.children) {
    if (child.type !== 'COMPONENT') continue;

    const props = getVariantPropertiesForComponent(child);
    for (const [key, value] of Object.entries(props)) {
      if (!axesMap.has(key)) axesMap.set(key, new Set());
      axesMap.get(key)!.add(value);
    }
  }

  return [...axesMap.entries()].map(([name, values]) => ({
    name,
    values: [...values],
  }));
}

/**
 * Maps parsed variant axes to `.DS-Template-variants` component properties.
 * - `horizontal` → top edge labels (first axis)
 * - `vertical` → left edge labels (second axis)
 * Additional axes (>2) use the first value per axis when resolving cells.
 */
export function pickMatrixAxes(axes: VariantAxis[]): {
  horizontal: VariantAxis | null;
  vertical: VariantAxis | null;
} {
  if (axes.length === 0) {
    return { horizontal: null, vertical: null };
  }

  if (axes.length === 1) {
    return { horizontal: axes[0], vertical: null };
  }

  return { horizontal: axes[0], vertical: axes[1] };
}

/** All variant child components when matrix axes cannot be built. */
export function getAllVariantCells(componentSet: ComponentSetNode): VariantCell[] {
  const cells: VariantCell[] = [];
  for (const child of componentSet.children) {
    if (child.type !== 'COMPONENT') continue;
    cells.push({
      component: child,
      properties: getVariantPropertiesForComponent(child),
    });
  }
  return cells;
}

function matchesExtraAxes(
  props: Record<string, string>,
  horizontalName: string,
  verticalName: string | null,
  allAxes: VariantAxis[]
): boolean {
  for (const axis of allAxes) {
    if (axis.name === horizontalName) continue;
    if (verticalName && axis.name === verticalName) continue;
    const expected = axis.values[0];
    if (expected != null && props[axis.name] !== expected) return false;
  }
  return true;
}

export function findVariantComponent(
  componentSet: ComponentSetNode,
  horizontalAxis: VariantAxis,
  horizontalValue: string,
  verticalAxis: VariantAxis | null,
  verticalValue: string,
  allAxes: VariantAxis[]
): ComponentNode | null {
  for (const child of componentSet.children) {
    if (child.type !== 'COMPONENT') continue;

    const props = getVariantPropertiesForComponent(child);
    if (props[horizontalAxis.name] !== horizontalValue) continue;

    if (verticalAxis) {
      if (props[verticalAxis.name] !== verticalValue) continue;
    }

    if (!matchesExtraAxes(props, horizontalAxis.name, verticalAxis?.name ?? null, allAxes)) {
      continue;
    }

    return child;
  }

  return null;
}

export function buildVariantCells(
  componentSet: ComponentSetNode,
  horizontalAxis: VariantAxis,
  verticalAxis: VariantAxis | null,
  allAxes: VariantAxis[]
): VariantCell[] {
  const cells: VariantCell[] = [];
  const verticalValues =
    verticalAxis && verticalAxis.values.length > 0 ? verticalAxis.values : [''];

  for (const verticalValue of verticalValues) {
    for (const horizontalValue of horizontalAxis.values) {
      const component = findVariantComponent(
        componentSet,
        horizontalAxis,
        horizontalValue,
        verticalAxis,
        verticalValue,
        allAxes
      );

      if (!component) continue;

      cells.push({
        properties: getVariantPropertiesForComponent(component),
        component,
      });
    }
  }

  return cells;
}
