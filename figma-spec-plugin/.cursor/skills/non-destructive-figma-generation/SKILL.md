---
name: non-destructive-figma-generation
description: Preserve selected user components when generating Figma plugin documentation and annotation layers. Use when writing, editing, reviewing, or debugging Figma plugin code that creates, updates, or manages generated annotation layers around selected components.
---

You must work non-destructively.

Rules:
- Never modify the selected user component.
- Only create/update plugin-generated annotation layers.
- Do not rename or restructure user layers.
- Do not detach instances.
- Do not change component properties.
- Do not change Auto Layout settings.
- Do not change fills, strokes, effects, constraints, variants, or variables of the selected component.
- Keep generated layers clearly identifiable.
