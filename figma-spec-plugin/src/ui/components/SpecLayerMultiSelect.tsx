import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpecLayerOption } from '@shared/messages';

type SpecLayerTreeNode = SpecLayerOption & {
  children: SpecLayerTreeNode[];
};

type DecompositionNodeKind = 'master' | 'child' | 'regular';

export type DecompositionTreeItem = {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  depth: number;
  checked: boolean;
  indeterminate?: boolean;
  expanded?: boolean;
  nodeKind?: DecompositionNodeKind;
  selectable?: boolean;
  parentId?: string;
  children?: DecompositionTreeItem[];
};

type DecompositionTreeViewProps = {
  items: DecompositionTreeItem[];
  checkedKeys: string[];
  expandedKeys: string[];
  onCheck: (checkedKeys: string[]) => void;
  onExpand: (expandedKeys: string[]) => void;
  onToggleNode?: (nodeId: string, checked: boolean) => void;
};

type TreeCheckboxProps = {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

export type SpecLayerMultiSelectProps = {
  options: SpecLayerOption[];
  selectedPaths: string[];
  isLoading?: boolean;
  error?: string | null;
  emptyHint?: string | null;
  onChange: (selectedPaths: string[]) => void;
  onRefresh?: () => void;
  onResetToAuto?: () => void;
  title?: string;
  showHeader?: boolean;
  showRefresh?: boolean;
  showResetButton?: boolean;
  rootId?: string | null;
};

function buildTree(options: SpecLayerOption[]): SpecLayerTreeNode[] {
  const nodeByPath = new Map<string, SpecLayerTreeNode>();
  const roots: SpecLayerTreeNode[] = [];

  for (const option of options) {
    nodeByPath.set(option.path, { ...option, children: [] });
  }

  for (const node of nodeByPath.values()) {
    if (node.parentPath) {
      const parent = nodeByPath.get(node.parentPath);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}

function flattenTree(items: DecompositionTreeItem[]): DecompositionTreeItem[] {
  const result: DecompositionTreeItem[] = [];
  for (const item of items) {
    result.push(item);
    result.push(...flattenTree(item.children ?? []));
  }
  return result;
}

function getDescendantIds(item: DecompositionTreeItem): string[] {
  return flattenTree([item]).map((node) => node.id);
}

function getAncestorIds(itemId: string, items: DecompositionTreeItem[]): string[] {
  const byPath = new Map(flattenTree(items).map((item) => [item.id, item]));
  const ancestors: string[] = [];
  let current = byPath.get(itemId);
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = byPath.get(current.parentId);
  }
  return ancestors;
}

function getSelectablePathsFromTree(node: DecompositionTreeItem): string[] {
  const paths: string[] = [];
  if (node.visible && node.selectable !== false) {
    paths.push(node.id);
  }
  for (const child of node.children ?? []) {
    paths.push(...getSelectablePathsFromTree(child));
  }
  return paths;
}

function computeIndeterminateState(
  item: DecompositionTreeItem,
  checkedKeySet: Set<string>
): { checked: boolean; indeterminate: boolean } {
  const selectablePaths = getSelectablePathsFromTree(item);
  const checkedCount = selectablePaths.filter((path) => checkedKeySet.has(path)).length;
  return {
    checked: selectablePaths.length > 0 && checkedCount === selectablePaths.length,
    indeterminate: checkedCount > 0 && checkedCount < selectablePaths.length,
  };
}

function toDecompositionTreeItems(items: SpecLayerTreeNode[]): DecompositionTreeItem[] {
  return items.map((item) => ({
    id: item.path,
    name: item.name,
    type: item.type,
    visible: true,
    depth: item.depth,
    checked: false,
    indeterminate: false,
    nodeKind: getNodeKind(item),
    selectable: item.isSelectable,
    parentId: item.parentPath,
    children: toDecompositionTreeItems(item.children),
  }));
}

function updateCheckedState(items: DecompositionTreeItem[], checkedKeys: string[]): DecompositionTreeItem[] {
  const checkedKeySet = new Set(checkedKeys);
  return items.map((item) => {
    const state = computeIndeterminateState(item, checkedKeySet);
    return {
      ...item,
      checked: state.checked,
      indeterminate: state.indeterminate,
      children: updateCheckedState(item.children ?? [], checkedKeys),
    };
  });
}

function toggleTreeItemChecked(
  items: DecompositionTreeItem[],
  itemId: string,
  checkedKeys: string[],
  checked: boolean
): string[] {
  const node = flattenTree(items).find((item) => item.id === itemId);
  if (!node) {
    return checkedKeys;
  }
  const selectablePaths = getSelectablePathsFromTree(node);
  if (checked) {
    const next = new Set(checkedKeys);
    selectablePaths.forEach((path) => next.add(path));
    return Array.from(next);
  }
  const remove = new Set(selectablePaths);
  return checkedKeys.filter((path) => !remove.has(path));
}

function getNodeKind(node: SpecLayerTreeNode): DecompositionNodeKind {
  // The selected root is not rendered as a tree row in the current Spec layer model.
  if (node.isComponentBoundary) {
    return 'child';
  }
  return 'regular';
}

function NavDropDownIcon() {
  return (
    <svg
      className="tree-toggle__icon"
      data-icon="nav-drop-down"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M4 6L8 10L12 6" />
    </svg>
  );
}

function NavDropUpIcon() {
  return (
    <svg
      className="tree-toggle__icon"
      data-icon="nav-drop-up"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M4 10L8 6L12 10" />
    </svg>
  );
}

function MasterIcon() {
  return (
    <svg
      className="decomposition-node-kind-tag__icon"
      data-icon="master"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="2" />
      <path d="M5.75 6.25H10.25M5.75 8H10.25M5.75 9.75H8.75" />
    </svg>
  );
}

function ChildIcon() {
  return (
    <svg
      className="decomposition-node-kind-tag__icon"
      data-icon="child"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M4 4.5H7.5V8H4zM8.5 8H12V11.5H8.5zM7.5 6.25H10.25V8" />
    </svg>
  );
}

function TreeCheckbox({ checked, indeterminate, disabled, onChange }: TreeCheckboxProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="decomposition-tree-checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

export function SpecLayerMultiSelect({
  options,
  selectedPaths,
  isLoading,
  error,
  emptyHint,
  onChange,
  onRefresh,
  onResetToAuto,
  title = 'Настройки Spec',
  showHeader = true,
  showRefresh = true,
  showResetButton = true,
  rootId,
}: SpecLayerMultiSelectProps) {
  const tree = useMemo(() => buildTree(options), [options]);
  const decompositionSource = useMemo(() => toDecompositionTreeItems(tree), [tree]);
  const decompositionItems = useMemo(
    () => updateCheckedState(decompositionSource, selectedPaths),
    [decompositionSource, selectedPaths]
  );
  const [expandedPathsByRoot, setExpandedPathsByRoot] = useState<Record<string, string[]>>({});
  const expansionKey = rootId ?? '__default__';
  const expandedSet = new Set(expandedPathsByRoot[expansionKey] ?? options.map((o) => o.path));

  return (
    <section className="spec-layer-settings">
      {showHeader ? (
        <div className="spec-layer-settings__header">
          <h2 className="spec-layer-settings__title">{title}</h2>
          {showRefresh && onRefresh ? (
            <button
              type="button"
              className="spec-layer-settings__refresh"
              onClick={onRefresh}
              disabled={isLoading}
            >
              Обновить слои
            </button>
          ) : null}
        </div>
      ) : null}

      {showResetButton && onResetToAuto ? (
        <div className="spec-layer-settings__subheader">
          <button
            type="button"
            className="spec-layer-settings__reset"
            onClick={onResetToAuto}
            disabled={isLoading || options.length === 0}
          >
            Сбросить к авто
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="spec-layer-settings__hint">Загрузка слоёв…</p>
      ) : null}

      {error ? <p className="spec-layer-settings__hint spec-layer-settings__hint--error">{error}</p> : null}

      {!isLoading && !error && options.length === 0 && emptyHint ? (
        <p className="spec-layer-settings__hint">{emptyHint}</p>
      ) : null}

      {!isLoading && !error && options.length > 0 ? (
        <DecompositionTreeView
          items={decompositionItems}
          checkedKeys={selectedPaths}
          expandedKeys={Array.from(expandedSet)}
          onCheck={onChange}
          onExpand={(expandedKeys) =>
            setExpandedPathsByRoot((prev) => ({ ...prev, [expansionKey]: expandedKeys }))
          }
        />
      ) : null}
    </section>
  );
}

export function DecompositionTreeView({
  items,
  checkedKeys,
  expandedKeys,
  onCheck,
  onExpand,
  onToggleNode,
}: DecompositionTreeViewProps) {
  const expandedSet = new Set(expandedKeys);
  void getAncestorIds;
  void getDescendantIds;

  function toggleExpanded(path: string) {
    const next = new Set(expandedKeys);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    onExpand(Array.from(next));
  }

  function toggleChecked(node: DecompositionTreeItem, checked: boolean) {
    onCheck(toggleTreeItemChecked(items, node.id, checkedKeys, checked));
    onToggleNode?.(node.id, checked);
  }

  function renderNode(node: DecompositionTreeItem) {
    const hasSelectable = getSelectablePathsFromTree(node).length > 0;
    const disabled = !hasSelectable;
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const expanded = expandedSet.has(node.id);
    const nodeKind = node.nodeKind ?? 'regular';

    return (
      <div key={node.id} className="decomposition-tree-item">
        <div
          className="decomposition-tree-node"
          data-depth={node.depth}
          data-disabled={disabled ? 'true' : 'false'}
          role="treeitem"
          aria-expanded={hasChildren ? expanded : undefined}
          aria-level={node.depth + 1}
        >
          <TreeIndent depth={node.depth} />
          {hasChildren ? (
            <button
              type="button"
              className="decomposition-tree-switcher"
              aria-label={expanded ? 'Свернуть' : 'Развернуть'}
              aria-expanded={expanded}
              onClick={() => toggleExpanded(node.id)}
            >
              {expanded ? <NavDropUpIcon /> : <NavDropDownIcon />}
            </button>
          ) : (
            <span className="decomposition-tree-switcher-placeholder" />
          )}
          <TreeCheckbox
            checked={node.checked}
            indeterminate={Boolean(node.indeterminate)}
            disabled={disabled}
            onChange={(nextChecked) => toggleChecked(node, nextChecked)}
          />
          <span className="decomposition-tree-title" title={node.name}>{node.name}</span>
          {nodeKind === 'master' || nodeKind === 'child' ? (
            <span className="decomposition-node-kind-tag" title={nodeKind}>
              {nodeKind === 'master' ? <MasterIcon /> : <ChildIcon />}
            </span>
          ) : null}
        </div>
        {hasChildren && expanded ? (
          <div role="group">
            {children.map((child) => renderNode(child))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="decomposition-tree" role="tree" aria-multiselectable="true">
      {items.map((node) => renderNode(node))}
    </div>
  );
}

function TreeIndent({ depth }: { depth: number }) {
  return (
    <span className="decomposition-tree-indent" aria-hidden="true">
      {Array.from({ length: depth }).map((_, index) => (
        <span key={index} className="decomposition-tree-indent-unit" />
      ))}
    </span>
  );
}
