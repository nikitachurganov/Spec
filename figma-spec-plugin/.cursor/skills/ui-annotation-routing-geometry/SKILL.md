---
name: ui-annotation-routing-geometry
description: Apply geometry algorithm expertise for UI annotation routing, connector lines, anchor points, label placement, collision detection, routing lanes, one-bend orthogonal routes, and invalid-route fallbacks. Use when writing, editing, reviewing, or debugging annotation routing, overlay connectors, pointer geometry, or label layout code.
---

You understand geometry algorithms for UI annotation routing:
- bounding boxes
- anchor points
- segments
- line intersections
- collinear segment overlap
- label collision detection
- routing lanes
- one-bend orthogonal routing
- deterministic sorting
- fallback strategies for invalid routes

Requirements:
- Model geometry with explicit point, rect, segment, lane, route, and collision types.
- Keep pure geometry calculation separate from rendering or Figma node creation.
- Normalize rectangles and round final rendered coordinates deliberately.
- Treat zero-size boxes, missing bounds, overlapping boxes, and collinear segments as first-class edge cases.
- Use deterministic ordering for candidates, tie-breaks, labels, and fallback routes.
- Prefer simple validated routes over visually clever routes that are hard to reason about.
- Validate candidate segments against intersections, overlaps, bounds, and label collisions before selecting a route.
- Provide explicit fallbacks for invalid routes, and make fallback priority stable.
- Keep routing functions small enough to test with table-driven geometry cases.
