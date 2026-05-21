import { useState } from 'react';
import { TreeView } from './TreeView';
import type { TreeNodeData } from './treeTypes';

/**
 * Reference test data + usage example for the TreeView component.
 * Not imported by the app — kept here as a self-contained demo.
 */
export const demoTreeData: TreeNodeData[] = [
  {
    key: 'component',
    title: 'Button',
    type: 'master',
    children: [
      {
        key: 'content',
        title: 'Content',
        type: 'container',
        children: [
          {
            key: 'icon-left',
            title: 'Icon left',
            type: 'child',
          },
          {
            key: 'label',
            title: 'Label',
            type: 'container',
          },
        ],
      },
      {
        key: 'icon-right',
        title: 'Icon right',
        type: 'child',
      },
    ],
  },
];

export function TreeViewDemo() {
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['component', 'content']);

  return (
    <TreeView
      data={demoTreeData}
      checkedKeys={checkedKeys}
      expandedKeys={expandedKeys}
      onCheck={(keys) => setCheckedKeys(keys)}
      onExpand={(keys) => setExpandedKeys(keys)}
    />
  );
}
