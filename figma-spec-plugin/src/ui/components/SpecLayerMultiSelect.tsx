import { useMemo, useState } from 'react';
import type { SpecLayerOption } from '@shared/messages';
import { LoadingState } from './LoadingState';
import { TreeView } from './TreeView/TreeView';
import type { TreeNodeData } from './TreeView/treeTypes';
import styles from './SpecLayerMultiSelect.module.css';

type SpecLayerTreeNode = SpecLayerOption & {
  children: SpecLayerTreeNode[];
};

type TreeComponentRole = NonNullable<SpecLayerOption['componentRole']>;

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
    if (node.parentPath !== undefined) {
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

function resolveComponentRole(
  item: SpecLayerTreeNode,
  parent: SpecLayerTreeNode | null
): TreeComponentRole {
  const fromPayload = item.componentRole;
  if (fromPayload) return fromPayload;

  // Backward-compatible fallback for stale payloads without `componentRole`.
  if (item.type === 'COMPONENT_SET') return 'component-set';
  if (item.type === 'COMPONENT') {
    if (parent?.type === 'COMPONENT_SET') return 'none';
    return 'master-component';
  }
  if (item.type === 'INSTANCE') return 'child-component';
  return 'none';
}

function toTreeNodeData(items: SpecLayerTreeNode[], parent: SpecLayerTreeNode | null = null): TreeNodeData[] {
  return items.map((item) => {
    const role = resolveComponentRole(item, parent);

    return {
      // Visibility is driven only by tree traversal/input options.
      // Component role controls icon only.
      key: item.path,
      title: item.name,
      type:
        role === 'component-set' || role === 'master-component'
          ? ('master' as const)
          : role === 'child-component'
            ? ('child' as const)
            : undefined,
      disabled: !item.isSelectable,
      children: toTreeNodeData(item.children, item),
    };
  });
}

function collectDefaultExpandedKeys(nodes: TreeNodeData[], depth = 0): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    if (!hasChildren) continue;
    if (depth <= 1) {
      keys.push(node.key);
    }
    keys.push(...collectDefaultExpandedKeys(children, depth + 1));
  }
  return keys;
}

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
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

  const treeContent = (() => {
    if (isLoading) {
      return <LoadingState minHeight={120} />;
    }

    if (error) {
      return (
        <p className={joinClassNames(styles.treeHint, styles.treeHintError)}>{error}</p>
      );
    }

    if (options.length === 0 && emptyHint) {
      return <p className={styles.treeHint}>{emptyHint}</p>;
    }

    if (options.length > 0) {
      return (
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
      );
    }

    return null;
  })();

  if (showHeader) {
    return (
      <section className="spec-layer-settings">
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

        {treeContent}
      </section>
    );
  }

  return (
    <section className={styles.treeBlock}>
      <div className={styles.treeTitle}>Слои</div>
      <div className={styles.treeContent}>{treeContent}</div>
    </section>
  );
}
