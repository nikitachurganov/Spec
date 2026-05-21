---
name: design-tokens-figma-variables
description: Understand design tokens and Figma variables. Use when reading, writing, reviewing, or refactoring code that resolves spacing values, Figma variable bindings, node.boundVariables, inferredVariables, or design token names.
---

You understand design tokens and Figma variables.

For spacing values:
- use node.boundVariables as the only source of truth for real token bindings;
- do not infer tokens by numeric value;
- do not use inferredVariables as proof of token binding;
- if a value is bound to a variable, return the variable name;
- if a value is not bound, return the raw numeric value.
