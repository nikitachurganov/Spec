/** Значение отступа в спеке (как в legacy `formatTokenWithValue`). */
export type TokenizedSpacing = {
  value: number;
  label?: string;
  token?: string;
  isTokenBound?: boolean;
  groupingKey?: string;
};

export type ContainerSpecForPadding = {
  padding?: {
    left?: TokenizedSpacing | null;
    right?: TokenizedSpacing | null;
    top?: TokenizedSpacing | null;
    bottom?: TokenizedSpacing | null;
  };
};

export type PaddingSide = 'left' | 'right' | 'top' | 'bottom';

export type PaddingRow = {
  name: string;
  value: string;
  sides: PaddingSide[];
};

function formatTokenWithValue(tokenizedValue: TokenizedSpacing | null | undefined): string {
  if (!tokenizedValue) return '—';
  if (tokenizedValue.label) {
    return tokenizedValue.label;
  }
  const px = `${tokenizedValue.value}px`;
  if (!tokenizedValue.token || tokenizedValue.token === 'custom') {
    return `custom (${px})`;
  }
  return `${tokenizedValue.token} (${px})`;
}

/** Подпись стороны padding для группировки. */
function formatPaddingSideForSpec(
  container: ContainerSpecForPadding,
  side: PaddingSide
): string {
  const p = container.padding?.[side];
  if (!p || p.value === 0) return 'None';
  return formatTokenWithValue(p);
}

function getPaddingGroupingKey(
  container: ContainerSpecForPadding,
  side: PaddingSide
): string {
  const p = container.padding?.[side];
  if (!p || p.value === 0) return 'none';
  if (p.groupingKey) return p.groupingKey;
  return `raw:${p.value}`;
}

export function normalizeSpacingValueForGrouping(value: string): string {
  return String(value || 'None').trim();
}

const PADDING_SIDE_ORDER: PaddingSide[] = ['left', 'right', 'top', 'bottom'];

export function createPaddingSidesKey(sides: PaddingSide[]): string {
  const normalized = sides
    .slice()
    .sort((a, b) => PADDING_SIDE_ORDER.indexOf(a) - PADDING_SIDE_ORDER.indexOf(b));

  if (normalized.length === 4) {
    return 'left+right+top+bottom';
  }

  const set = new Set(normalized);

  if (set.size === 2) {
    if (set.has('left') && set.has('bottom')) return 'left+bottom';
    if (set.has('left') && set.has('top')) return 'left+top';
    if (set.has('right') && set.has('top')) return 'right+top';
    if (set.has('right') && set.has('bottom')) return 'right+bottom';
    if (set.has('left') && set.has('right')) return 'left+right';
    if (set.has('top') && set.has('bottom')) return 'top+bottom';
  }

  if (set.size === 3) {
    if (set.has('left') && set.has('bottom') && set.has('right')) return 'left+bottom+right';
    if (set.has('left') && set.has('bottom') && set.has('top')) return 'left+bottom+top';
    if (set.has('right') && set.has('bottom') && set.has('top')) return 'right+bottom+top';
    if (set.has('left') && set.has('top') && set.has('right')) return 'left+right+top';
  }

  if (set.size === 1 && normalized[0]) {
    return normalized[0];
  }

  return normalized.join('+');
}

export function getPaddingLabelBySides(sides: PaddingSide[]): string {
  const key = createPaddingSidesKey(sides);

  const labelMap: Record<string, string> = {
    'left+right+top+bottom': 'Padding',

    'left+bottom': 'Padding-left-bottom',
    'left+top': 'Padding-left-top',
    'right+top': 'Padding-right-top',
    'right+bottom': 'Padding-right-bottom',
    'left+right': 'Padding-left-right',
    'top+bottom': 'Padding-top-bottom',

    'left+bottom+right': 'Padding-left-bottom-right',
    'left+bottom+top': 'Padding-left-bottom-top',
    'right+bottom+top': 'Padding-right-bottom-top',
    'left+right+top': 'Padding-right-left-top',

    left: 'Padding-left',
    right: 'Padding-right',
    top: 'Padding-top',
    bottom: 'Padding-bottom',
  };

  if (labelMap[key]) return labelMap[key];

  const sorted = sides
    .slice()
    .sort((a, b) => PADDING_SIDE_ORDER.indexOf(a) - PADDING_SIDE_ORDER.indexOf(b));
  return `Padding-${sorted.join('-')}`;
}

function getPaddingSortPriority(sides: PaddingSide[]): number {
  const key = createPaddingSidesKey(sides);

  const priority: Record<string, number> = {
    'left+right+top+bottom': 0,

    'left+right': 10,
    'top+bottom': 11,
    'left+top': 12,
    'right+top': 13,
    'right+bottom': 14,
    'left+bottom': 15,

    'left+bottom+right': 20,
    'left+bottom+top': 21,
    'right+bottom+top': 22,
    'left+right+top': 23,

    left: 30,
    right: 31,
    top: 32,
    bottom: 33,
  };

  return priority[key] ?? 100;
}

export function sortPaddingRows(rows: PaddingRow[]): PaddingRow[] {
  return rows.slice().sort((a, b) => {
    if (b.sides.length !== a.sides.length) {
      return b.sides.length - a.sides.length;
    }
    return getPaddingSortPriority(a.sides) - getPaddingSortPriority(b.sides);
  });
}

export function getPaddingRows(container: ContainerSpecForPadding): PaddingRow[] {
  const paddingValues: { side: PaddingSide; value: string; groupKey: string }[] = [
    {
      side: 'left',
      value: formatPaddingSideForSpec(container, 'left'),
      groupKey: getPaddingGroupingKey(container, 'left'),
    },
    {
      side: 'right',
      value: formatPaddingSideForSpec(container, 'right'),
      groupKey: getPaddingGroupingKey(container, 'right'),
    },
    {
      side: 'top',
      value: formatPaddingSideForSpec(container, 'top'),
      groupKey: getPaddingGroupingKey(container, 'top'),
    },
    {
      side: 'bottom',
      value: formatPaddingSideForSpec(container, 'bottom'),
      groupKey: getPaddingGroupingKey(container, 'bottom'),
    },
  ];

  const groups = new Map<string, { sides: PaddingSide[]; displayValue: string }>();

  for (const item of paddingValues) {
    const key = item.groupKey;
    const cur = groups.get(key);
    if (cur) {
      cur.sides.push(item.side);
    } else {
      groups.set(key, { sides: [item.side], displayValue: item.value });
    }
  }

  const rows: PaddingRow[] = [];
  for (const [, g] of groups) {
    rows.push({
      name: getPaddingLabelBySides(g.sides),
      value: g.displayValue,
      sides: g.sides,
    });
  }

  return sortPaddingRows(rows);
}
