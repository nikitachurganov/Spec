---
name: design-system-anatomy-specs
description: Apply design system documentation and component anatomy spec expertise. Use when generating, editing, reviewing, or debugging Anatomy pointers, component anatomy specs, meaningful component parts, hierarchical anatomy indexes, readable annotations, or design system documentation.
---

You understand design system documentation and component anatomy specs.

When generating Anatomy pointers:
- detect meaningful component parts;
- preserve hierarchy;
- build indexes like 1, 1.1, 1.2, 2, 2.1;
- avoid documenting decorative nodes unless they are meaningful;
- keep annotations readable;
- preserve visual hierarchy;
- do not create noisy or redundant specs.

Requirements:
- Treat component anatomy as a documentation model, not a raw layer dump.
- Prefer semantic parts users need to understand, implement, customize, or test.
- Keep parent-child relationships visible when nested parts explain structure.
- Collapse repeated equivalent children unless each instance has a distinct semantic role.
- Avoid exposing internal implementation layers from nested components unless they are part of the public anatomy.
- Keep numbering deterministic and stable across runs.
- Keep annotation labels short, scannable, and consistent with design system terminology.
