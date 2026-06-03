/// <reference types="@figma/plugin-typings" />

import type { VariantAxis, VariantCell } from './variantAxes';
import { getVariantPropertiesForComponent } from './variantAxes';

/** Parsed Component Set data for Components & properties generation. */
export type ComponentVariantModel = {
  componentSetName: string;
  axes: VariantAxis[];
  variants: VariantCell[];
};

export type ComponentsPropertiesModel = ComponentVariantModel;

export function formatVariantPropertiesLabel(properties: Record<string, string>): string {
  const entries = Object.entries(properties);
  if (entries.length === 0) return 'Variant';
  return entries.map(([name, value]) => `${name}: ${value}`).join(' · ');
}

function variantColumnLabel(variant: VariantCell): string {
  const label = formatVariantPropertiesLabel(variant.properties);
  return label !== 'Variant' ? label : variant.component.name;
}

/**
 * Preserves axis and value order as they first appear on component set children.
 */
export function parseComponentSetVariants(componentSet: ComponentSetNode): ComponentVariantModel {
  const axisNames: string[] = [];
  const axisValueOrder = new Map<string, string[]>();
  const variants: VariantCell[] = [];

  for (const child of componentSet.children) {
    if (child.type !== 'COMPONENT') continue;

    const properties = getVariantPropertiesForComponent(child);
    variants.push({ component: child, properties });

    for (const [name, value] of Object.entries(properties)) {
      if (!axisValueOrder.has(name)) {
        axisNames.push(name);
        axisValueOrder.set(name, []);
      }
      const values = axisValueOrder.get(name)!;
      if (!values.includes(value)) values.push(value);
    }
  }

  return {
    componentSetName: componentSet.name,
    axes: axisNames.map((name) => ({
      name,
      values: axisValueOrder.get(name) ?? [],
    })),
    variants,
  };
}

export type ResolvedMatrixAxes = {
  horizontal: VariantAxis;
  vertical: VariantAxis;
  /** When false, hide vertical title/bracket/labels (single-axis matrix). */
  showVerticalAxis: boolean;
};

/**
 * Matrix axes for layout:
 * - 2+ axes: first = columns (top), second = rows (left)
 * - 1 axis: columns from axis; one synthetic row `Default`
 * - 0 axes: columns from variant labels; one row
 */
export function resolveMatrixAxes(model: ComponentVariantModel): ResolvedMatrixAxes {
  if (model.axes.length >= 2) {
    return {
      horizontal: model.axes[0],
      vertical: model.axes[1],
      showVerticalAxis: true,
    };
  }

  if (model.axes.length === 1) {
    return {
      horizontal: model.axes[0],
      vertical: { name: '', values: [''] },
      showVerticalAxis: false,
    };
  }

  const columnValues = model.variants.map((v) => variantColumnLabel(v));
  return {
    horizontal: {
      name: 'Variant',
      values: columnValues.length > 0 ? columnValues : ['Default'],
    },
    vertical: { name: '', values: [''] },
    showVerticalAxis: false,
  };
}

export function findVariantForCell(
  variants: VariantCell[],
  horizontalAxisName: string,
  horizontalValue: string,
  verticalAxisName: string | null,
  verticalValue: string | null
): ComponentNode | null {
  const match = variants.find((variant) => {
    const horizontalMatches =
      horizontalAxisName === 'Variant'
        ? variantColumnLabel(variant) === horizontalValue
        : variant.properties[horizontalAxisName] === horizontalValue;

    let verticalMatches = true;
    if (verticalAxisName && verticalValue && verticalValue !== '') {
      if (verticalValue === 'Default') {
        verticalMatches =
          !(verticalAxisName in variant.properties) ||
          variant.properties[verticalAxisName] === 'Default';
      } else {
        verticalMatches = variant.properties[verticalAxisName] === verticalValue;
      }
    }

    return horizontalMatches && verticalMatches;
  });

  return match?.component ?? null;
}

/** Axis names for optional `.DS-Template-variants` component properties. */
export function getTemplateAxisPropertyNames(model: ComponentVariantModel): {
  horizontal: string;
  vertical: string;
} {
  const resolved = resolveMatrixAxes(model);
  return {
    horizontal: resolved.horizontal.name,
    vertical: resolved.showVerticalAxis ? resolved.vertical.name : '',
  };
}
