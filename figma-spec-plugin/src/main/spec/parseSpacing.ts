/// <reference types="@figma/plugin-typings" />

import {
  formatBoundSpacingDisplay,
  formatRawSpacingValue,
  getBoundSpacingValueMap,
  getBoundSpacingValues,
  getSpacingGroupingKey,
  type BoundSpacingValue,
  type SpacingPropertyName,
} from '../tokens/spacingBindingResolver';
import type { TokenizedSpacing } from './parseContainers';

export type ParsedSpacingValue = {
  propertyName: SpacingPropertyName;
  valuePx: number;
  label: string;
  isTokenBound: boolean;
  tokenPath?: string;
  variableId?: string;
  groupingKey: string;
};

export type SpacingValue = TokenizedSpacing;

function roundSpacingPx(raw: number): number {
  return Math.round(raw);
}

function boundToParsed(entry: BoundSpacingValue): ParsedSpacingValue {
  const valuePx = entry.value;
  const tokenPath = entry.tokenName ?? undefined;

  return {
    propertyName: entry.property,
    valuePx,
    label: formatBoundSpacingDisplay(entry),
    isTokenBound: entry.isTokenBound,
    tokenPath,
    variableId: entry.variableId ?? undefined,
    groupingKey: getSpacingGroupingKey({
      valuePx: roundSpacingPx(valuePx),
      isTokenBound: entry.isTokenBound,
      tokenPath: tokenPath ?? null,
      variableId: entry.variableId,
    }),
  };
}

function parsedToTokenized(parsed: ParsedSpacingValue): TokenizedSpacing {
  const value = roundSpacingPx(parsed.valuePx);
  return {
    value,
    unit: 'px',
    label: parsed.label,
    token: parsed.isTokenBound
      ? parsed.tokenPath ?? parsed.variableId ?? 'token'
      : 'custom',
    isCustom: !parsed.isTokenBound,
    isTokenBound: parsed.isTokenBound,
    tokenPath: parsed.tokenPath,
    variableId: parsed.variableId,
    groupingKey: parsed.groupingKey,
  };
}

function getBoundEntry(
  map: Map<SpacingPropertyName, BoundSpacingValue>,
  property: SpacingPropertyName,
  fallbackValue = 0
): ParsedSpacingValue {
  const entry = map.get(property);
  if (entry) {
    return boundToParsed(entry);
  }
  return boundToParsed({
    property,
    value: fallbackValue,
    isTokenBound: false,
    tokenName: null,
    variableId: null,
  });
}

export async function parsePadding(node: SceneNode): Promise<{
  top: TokenizedSpacing;
  right: TokenizedSpacing;
  bottom: TokenizedSpacing;
  left: TokenizedSpacing;
}> {
  const boundMap = getBoundSpacingValueMap(await getBoundSpacingValues(node));

  return {
    top: parsedToTokenized(getBoundEntry(boundMap, 'paddingTop')),
    right: parsedToTokenized(getBoundEntry(boundMap, 'paddingRight')),
    bottom: parsedToTokenized(getBoundEntry(boundMap, 'paddingBottom')),
    left: parsedToTokenized(getBoundEntry(boundMap, 'paddingLeft')),
  };
}

export type ParsedContainerSpacing = {
  source: string;
  gap?: TokenizedSpacing;
  rowGap?: TokenizedSpacing;
};

export async function parseSpacing(node: SceneNode): Promise<ParsedContainerSpacing> {
  if (!('layoutMode' in node) || node.layoutMode === undefined || node.layoutMode === 'NONE') {
    return { source: 'none' };
  }

  const out: ParsedContainerSpacing = { source: 'auto-layout' };
  const boundMap = getBoundSpacingValueMap(await getBoundSpacingValues(node));
  const layoutMode = node.layoutMode;

  if (layoutMode === 'GRID') {
    if (boundMap.has('gridColumnGap')) {
      out.gap = parsedToTokenized(getBoundEntry(boundMap, 'gridColumnGap'));
    }
    if (boundMap.has('gridRowGap')) {
      out.rowGap = parsedToTokenized(getBoundEntry(boundMap, 'gridRowGap'));
    }
  } else {
    if (boundMap.has('itemSpacing')) {
      out.gap = parsedToTokenized(getBoundEntry(boundMap, 'itemSpacing'));
    }
    if (boundMap.has('counterAxisSpacing')) {
      out.rowGap = parsedToTokenized(getBoundEntry(boundMap, 'counterAxisSpacing'));
    }
  }

  return out;
}

export type SpacingWarningInput = {
  padding: {
    top: TokenizedSpacing;
    right: TokenizedSpacing;
    bottom: TokenizedSpacing;
    left: TokenizedSpacing;
  };
  spacing: {
    gap?: TokenizedSpacing;
    rowGap?: TokenizedSpacing;
  };
};

/**
 * Warning lines for spacing values that are not bound to a variable.
 */
export function buildCustomSpacingWarningLines(input: SpacingWarningInput): string[] {
  const items: { label: string; value: number }[] = [];

  const sides: { label: string; token: TokenizedSpacing }[] = [
    { label: 'Padding top', token: input.padding.top },
    { label: 'Padding right', token: input.padding.right },
    { label: 'Padding bottom', token: input.padding.bottom },
    { label: 'Padding left', token: input.padding.left },
  ];

  for (const side of sides) {
    if (!side.token.isTokenBound && side.token.value !== 0) {
      items.push({ label: side.label, value: side.token.value });
    }
  }

  if (input.spacing.gap && !input.spacing.gap.isTokenBound && input.spacing.gap.value !== 0) {
    items.push({ label: 'Gap', value: input.spacing.gap.value });
  }

  if (
    input.spacing.rowGap &&
    !input.spacing.rowGap.isTokenBound &&
    input.spacing.rowGap.value !== 0
  ) {
    items.push({ label: 'Row gap', value: input.spacing.rowGap.value });
  }

  if (items.length === 0) {
    return [];
  }

  const lines = ['Следующие spacing-значения не привязаны к переменным (токенам):'];

  for (const item of items) {
    lines.push(`• ${item.label}: ${formatRawSpacingValue(item.value)}`);
  }

  return lines;
}
