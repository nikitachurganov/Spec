---
name: strict-maintainable-typescript
description: Enforce strict, maintainable TypeScript for Figma plugin code. Use when writing, editing, reviewing, or refactoring TypeScript, geometry logic, route models, labels, anatomy items, Figma node creation, bounds handling, or variable resolution.
---

You write strict, maintainable TypeScript.

Requirements:
- Avoid any unless there is no safe alternative.
- Use explicit types for geometry, routes, labels, and anatomy items.
- Keep functions small and composable.
- Separate data calculation from rendering.
- Do not mix algorithm logic with Figma node creation logic.
- Add guards for unsupported node types.
- Handle missing bounds and unresolved variables safely.
- Keep TypeScript compilation clean.
