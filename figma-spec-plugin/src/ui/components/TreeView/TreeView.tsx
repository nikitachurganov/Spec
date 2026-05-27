import { useCallback, useMemo, useState } from 'react';
import type { TreeCheckInfo, TreeNodeData, TreeViewProps } from './treeTypes';
import { calculateCheckedState, toggleCheck } from './treeUtils';
import { TreeNode } from './TreeNode';
import styles from './TreeView.module.css';

/**
 * Custom Tree component inspired by Ant Design Tree.
 * Implementation does not depend on antd; all behavior is local.
 */
export function TreeView({
  data,
  expandedKeys,
  checkedKeys,
  defaultExpandedKeys,
  defaultCheckedKeys,
  selectable = true,
  checkable = true,
  cascadeSelection = true,
  onExpand,
  onCheck,
  onSelect,
  renderTitle,
}: TreeViewProps) {
  const isExpandedControlled = expandedKeys !== undefined;
  const isCheckedControlled = checkedKeys !== undefined;

  const [internalExpanded, setInternalExpanded] = useState<string[]>(
    () => defaultExpandedKeys ?? []
  );
  const [internalChecked, setInternalChecked] = useState<string[]>(
    () => defaultCheckedKeys ?? []
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const effectiveExpanded = isExpandedControlled ? expandedKeys! : internalExpanded;
  const effectiveChecked = isCheckedControlled ? checkedKeys! : internalChecked;

  const { checkedSet, halfCheckedSet } = useMemo(() => {
    const state = calculateCheckedState(data, effectiveChecked, cascadeSelection);
    return {
      checkedSet: new Set(state.checkedKeys),
      halfCheckedSet: new Set(state.halfCheckedKeys),
    };
  }, [data, effectiveChecked, cascadeSelection]);

  const expandedSet = useMemo(() => new Set(effectiveExpanded), [effectiveExpanded]);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const handleSwitch = useCallback(
    (key: string) => {
      const next = new Set(effectiveExpanded);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const nextArr = Array.from(next);
      if (!isExpandedControlled) setInternalExpanded(nextArr);
      onExpand?.(nextArr);
    },
    [effectiveExpanded, isExpandedControlled, onExpand]
  );

  const handleCheck = useCallback(
    (node: TreeNodeData, nextChecked: boolean) => {
      const nextKeys = toggleCheck(
        data,
        node.key,
        nextChecked,
        effectiveChecked,
        cascadeSelection
      );
      const info: TreeCheckInfo = {
        checked: nextChecked,
        node,
        halfCheckedKeys: calculateCheckedState(data, nextKeys, cascadeSelection).halfCheckedKeys,
      };
      if (!isCheckedControlled) setInternalChecked(nextKeys);
      onCheck?.(nextKeys, info);
    },
    [data, effectiveChecked, isCheckedControlled, onCheck, cascadeSelection]
  );

  const handleSelect = useCallback(
    (node: TreeNodeData) => {
      if (!selectable || node.disabled) return;
      const next = [node.key];
      setSelectedKeys(next);
      onSelect?.(next, { node });
    },
    [selectable, onSelect]
  );

  return (
    <ul className={styles.tree} role="tree">
      {data.map((root, idx) => (
        <TreeNode
          key={root.key}
          node={root}
          level={0}
          isLastChild={idx === data.length - 1}
          checkable={checkable}
          selectable={selectable}
          expandedKeys={expandedSet}
          checkedKeys={checkedSet}
          halfCheckedKeys={halfCheckedSet}
          selectedKeys={selectedSet}
          renderTitle={renderTitle}
          onSwitch={handleSwitch}
          onCheck={handleCheck}
          onSelect={handleSelect}
        />
      ))}
    </ul>
  );
}
