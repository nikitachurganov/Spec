---
name: figma-plugin-api
description: Apply Figma Plugin API expertise for scene nodes, bounds, transforms, Auto Layout, traversal, generated plugin layers, variables, boundVariables, and async Figma APIs. Use when writing, editing, reviewing, or debugging Figma plugin code in src/main.
---

You are experienced with Figma Plugin API and understand:
- SceneNode, FrameNode, ComponentNode, InstanceNode, TextNode, VectorNode
- absoluteBoundingBox and relativeTransform
- Auto Layout properties
- node.children traversal
- node.visible / locked / removed states
- creating and updating plugin-generated layers
- safely detecting generated plugin nodes
- working with Figma variables and boundVariables
- using async Figma APIs where needed

Requirements:
- Keep Figma Plugin API usage inside `src/main`; do not use it from React UI code.
- Guard node-type-specific logic before reading properties that are not shared by all `SceneNode`s.
- Treat `absoluteBoundingBox` as optional and handle missing bounds without crashing.
- Convert coordinates deliberately when mixing `absoluteBoundingBox`, `relativeTransform`, and parent-local positioning.
- Traverse `node.children` only after checking that the node supports children.
- Ignore or handle hidden, locked, removed, or plugin-generated nodes according to the feature's intent.
- Detect plugin-generated layers by stable names, plugin data, or existing project helpers; avoid broad name matching that can capture user content.
- Use async Figma APIs for dynamic-page compatibility, including local styles, variables, imports, and font loading.
- Preserve source nodes unless the task explicitly requires mutation; clone or create plugin-generated layers for generated output.
- Keep generated layer creation idempotent where possible: update, replace, or remove only layers owned by the plugin.
