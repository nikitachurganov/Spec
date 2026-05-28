import { useMemo, useState } from 'react';
import type { SpecLayerOption } from '@shared/messages';
import { TreeView } from './TreeView/TreeView';
import type { TreeNodeData } from './TreeView/treeTypes';

type SpecLayerTreeNode = SpecLayerOption & {
  children: SpecLayerTreeNode[];
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
  checkable?: boolean;
  cascadeSelection?: boolean;
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

function toTreeNodeData(items: SpecLayerTreeNode[]): TreeNodeData[] {
  return items.map((item) => ({
    key: item.path,
    title: item.name,
    type: item.isRoot ? ('master' as const) : item.isComponentBoundary ? ('child' as const) : undefined,
    disabled: !item.isSelectable,
    children: toTreeNodeData(item.children),
  }));
}

function collectDefaultExpandedKeys(nodes: TreeNodeData[], depth = 0): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    if (!hasChildren) continue;
    // Keep the tree readable on open while preserving manual collapse state later.
    if (depth <= 1) {
      keys.push(node.key);
    }
    keys.push(...collectDefaultExpandedKeys(children, depth + 1));
  }
  return keys;
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
  checkable = true,
  cascadeSelection = false,
}: SpecLayerMultiSelectProps) {
  const tree = useMemo(() => buildTree(options), [options]);
  const treeData = useMemo(() => toTreeNodeData(tree), [tree]);
  const defaultExpandedKeys = useMemo(() => collectDefaultExpandedKeys(treeData), [treeData]);

  const [expandedPathsByRoot, setExpandedPathsByRoot] = useState<Record<string, string[]>>({});
  const expansionKey = rootId ?? '__default__';
  const expandedKeys = expandedPathsByRoot[expansionKey] ?? defaultExpandedKeys;

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

      {error ? (
        <p className="spec-layer-settings__hint spec-layer-settings__hint--error">{error}</p>
      ) : null}

      {!isLoading && !error && options.length === 0 && emptyHint ? (
        <p className="spec-layer-settings__hint">{emptyHint}</p>
      ) : null}

      {!isLoading && !error && options.length > 0 ? (
        <TreeView
          data={treeData}
          checkedKeys={selectedPaths}
          expandedKeys={expandedKeys}
          checkable={checkable}
          cascadeSelection={cascadeSelection}
          selectable={false}
          onCheck={(keys) => onChange(keys)}
          onExpand={(keys) =>
            setExpandedPathsByRoot((prev) => ({ ...prev, [expansionKey]: keys }))
          }
        />
      ) : null}
    </section>
  );
}
