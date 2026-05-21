/// <reference types="@figma/plugin-typings" />

import { resolveVariableByIdAsync, initVariableByIdRegistry } from '../figma/variables';
import { normalizeSpacingPath } from './spacingTokenResolver';

/** Spacing fields readable from Auto Layout / Grid nodes. */
export type SpacingPropertyName =
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'paddingBottom'
  | 'itemSpacing'
  | 'counterAxisSpacing'
  | 'gridRowGap'
  | 'gridColumnGap';

export type BoundSpacingValue = {
  property: SpacingPropertyName;
  value: number;
  isTokenBound: boolean;
  tokenName: string | null;
  variableId: string | null;
};

export type SpacingTokenBinding = {
  propertyName: SpacingPropertyName;
  valuePx: number;
  tokenName: string | null;
  tokenPath: string | null;
  variableId: string;
  isBound: true;
};

export type RawSpacingValue = {
  propertyName: SpacingPropertyName;
  valuePx: number;
  isBound: false;
};

export type ResolvedSpacingValue = SpacingTokenBinding | RawSpacingValue;

const SPACING_PROPERTY_ORDER: SpacingPropertyName[] = [
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap',
];

const PADDING_PROPERTIES = new Set<SpacingPropertyName>([
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
]);

type ResolvedVariableInfo = {
  variableId: string;
  name: string;
  path: string;
  collectionName?: string;
};

type NodeWithBoundVariables = SceneNode & {
  boundVariables?: Partial<Record<SpacingPropertyName, unknown>>;
};

type NumericSpacingNode = SceneNode & Partial<Record<SpacingPropertyName, number>>;

let spacingVariableRegistryInit: Promise<void> | null = null;

function isVariableAlias(value: unknown): value is VariableAlias {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as VariableAlias).type === 'VARIABLE_ALIAS' &&
    typeof (value as VariableAlias).id === 'string'
  );
}

function aliasFromObject(value: Record<string, unknown>): VariableAlias | null {
  if (isVariableAlias(value)) {
    return value;
  }
  if (typeof value.variableId === 'string') {
    return { type: 'VARIABLE_ALIAS', id: value.variableId };
  }
  if (typeof value.id === 'string' && value.type === 'VARIABLE_ALIAS') {
    return { type: 'VARIABLE_ALIAS', id: value.id };
  }
  return null;
}

function extractVariableAlias(binding: unknown): VariableAlias | null {
  if (binding == null) return null;
  if (isVariableAlias(binding)) return binding;

  if (Array.isArray(binding)) {
    for (const item of binding) {
      if (isVariableAlias(item)) return item;
      if (typeof item === 'object' && item !== null) {
        const alias = aliasFromObject(item as Record<string, unknown>);
        if (alias) return alias;
      }
    }
    return null;
  }

  if (typeof binding === 'object') {
    return aliasFromObject(binding as Record<string, unknown>);
  }

  return null;
}

function getSpacingBinding(
  node: SceneNode,
  propertyName: SpacingPropertyName
): VariableAlias | null {
  if (!('boundVariables' in node)) return null;
  const boundVariables = (node as NodeWithBoundVariables).boundVariables;
  if (!boundVariables) return null;
  return extractVariableAlias(boundVariables[propertyName]);
}

/** True when the node uses Auto Layout or Grid (not layoutMode NONE). */
export function isAutoLayoutSpacingNode(node: SceneNode): boolean {
  if (!('layoutMode' in node)) return false;
  const mode = (node as { layoutMode?: string }).layoutMode;
  return mode !== undefined && mode !== 'NONE';
}

export function supportsSpacingProperty(
  node: SceneNode,
  property: SpacingPropertyName
): boolean {
  return property in node;
}

export function getNodeNumericValue(node: SceneNode, property: SpacingPropertyName): number {
  const raw = (node as NumericSpacingNode)[property];
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw;
  }
  return 0;
}

async function ensureSpacingVariableRegistry(): Promise<void> {
  if (!spacingVariableRegistryInit) {
    spacingVariableRegistryInit = initVariableByIdRegistry();
  }
  await spacingVariableRegistryInit;
}

/** Resolves variable display name/path from bound alias id for spec registration. */
export async function resolveVariableName(
  variableId: string
): Promise<ResolvedVariableInfo | null> {
  if (!variableId) return null;

  await ensureSpacingVariableRegistry();

  const resolved = await resolveVariableByIdAsync(variableId);
  if (!resolved) {
    return null;
  }

  return {
    variableId: resolved.variableId,
    name: resolved.name,
    path: normalizeSpacingPath(resolved.name),
  };
}

async function resolveBoundVariableName(binding: unknown): Promise<ResolvedVariableInfo | null> {
  const alias = extractVariableAlias(binding);
  if (!alias) return null;
  return resolveVariableName(alias.id);
}

function roundSpacingPx(raw: number): number {
  return Math.round(raw);
}

export function formatRawSpacingValue(valuePx: number): string {
  const rounded = Math.round(valuePx);

  if (Math.abs(valuePx - rounded) < 0.01) {
    return `${rounded}px`;
  }

  return `${Number(valuePx.toFixed(2))}px`;
}

/** Spec row label: token name, raw px, or unresolved binding fallback. */
export function formatBoundSpacingDisplay(entry: BoundSpacingValue): string {
  if (!entry.isTokenBound) {
    return formatRawSpacingValue(entry.value);
  }

  if (entry.tokenName) {
    return normalizeSpacingPath(entry.tokenName);
  }

  if (entry.variableId) {
    return `${formatRawSpacingValue(entry.value)} (${entry.variableId})`;
  }

  return formatRawSpacingValue(entry.value);
}

async function resolveBoundSpacingProperty(
  node: SceneNode,
  property: SpacingPropertyName
): Promise<BoundSpacingValue> {
  const value = getNodeNumericValue(node, property);
  const binding = getSpacingBinding(node, property);

  if (!binding) {
    return {
      property,
      value,
      isTokenBound: false,
      tokenName: null,
      variableId: null,
    };
  }

  const variableId = binding.id;
  const resolved = await resolveBoundVariableName(binding);

  return {
    property,
    value,
    isTokenBound: true,
    tokenName: resolved?.path ?? resolved?.name ?? null,
    variableId,
  };
}

/**
 * Extracts spacing values from a node using `boundVariables` as the only token source.
 * Returns an empty array when the node is not Auto Layout / Grid.
 */
export async function getBoundSpacingValues(node: SceneNode): Promise<BoundSpacingValue[]> {
  await ensureSpacingVariableRegistry();

  const isLayoutNode = isAutoLayoutSpacingNode(node);
  const results: BoundSpacingValue[] = [];

  for (const property of SPACING_PROPERTY_ORDER) {
    if (!supportsSpacingProperty(node, property)) {
      continue;
    }
    if (!PADDING_PROPERTIES.has(property) && !isLayoutNode) {
      continue;
    }
    results.push(await resolveBoundSpacingProperty(node, property));
  }

  return results;
}

export function getBoundSpacingValueMap(
  values: BoundSpacingValue[]
): Map<SpacingPropertyName, BoundSpacingValue> {
  return new Map(values.map((entry) => [entry.property, entry]));
}

/** Grouping key: same numeric value is not enough — binding identity must match. */
export function getSpacingGroupingKey(parts: {
  valuePx: number;
  isTokenBound: boolean;
  tokenPath?: string | null;
  variableId?: string | null;
}): string {
  if (parts.isTokenBound) {
    const identity = parts.variableId || parts.tokenPath || 'bound-unresolved';
    return `bound:${identity}:${parts.valuePx}`;
  }
  return `raw:${parts.valuePx}`;
}

export async function resolveNodeSpacingValue(params: {
  node: SceneNode;
  propertyName: SpacingPropertyName;
  valuePx?: number;
}): Promise<ResolvedSpacingValue> {
  const { node, propertyName } = params;
  const valuePx =
    params.valuePx ??
    (supportsSpacingProperty(node, propertyName)
      ? getNodeNumericValue(node, propertyName)
      : 0);

  const binding = getSpacingBinding(node, propertyName);

  if (!binding) {
    return {
      propertyName,
      valuePx,
      isBound: false,
    };
  }

  const variableId = binding.id;
  const resolved = await resolveBoundVariableName(binding);

  return {
    propertyName,
    valuePx,
    tokenName: resolved?.name ?? null,
    tokenPath: resolved?.path ?? null,
    variableId,
    isBound: true,
  };
}
