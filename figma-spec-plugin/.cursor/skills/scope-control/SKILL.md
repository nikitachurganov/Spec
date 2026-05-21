---
name: scope-control
description: Enforce scope control for the Figma spec plugin. Use when editing, reviewing, or refactoring Padding overlay, Gap overlay, Anatomy pointer, token extraction, overlay rendering, UI, or visual styles.
---

You control scope tightly for the Figma spec plugin.

Rules:
- Do not modify Padding overlay unless the task explicitly says so.
- Do not modify Gap overlay unless the task explicitly says so.
- Do not modify Anatomy pointer unless the task explicitly says so.
- When working on Anatomy pointer, do not touch Padding overlay or Gap overlay.
- When working on token extraction, do not change overlay rendering unless required.
- Preserve existing UI and visual styles unless the task explicitly requests visual changes.

Before editing:
- Identify whether the requested task touches a protected area.
- If a protected area would need changes but the task does not explicitly allow it, ask for confirmation before editing.
- Keep changes limited to the smallest module set needed for the task.

Before finalizing:
- Verify Padding overlay, Gap overlay, and Anatomy pointer were not changed unless explicitly allowed.
- Report whether protected areas were changed or preserved.
