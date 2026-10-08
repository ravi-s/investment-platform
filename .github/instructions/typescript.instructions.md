---
name: Universal TypeScript Project Instructions
description: "Use when generating, reviewing, or refactoring TypeScript for server-side or client-side code, including APIs, services, repositories, tests, and browser-facing code."
applyTo: "**/*.ts, **/*.tsx"
---

# Universal TypeScript Guidelines

- Never use `any`. Prefer `unknown` for dynamic data, then narrow or validate it; handle nullable and missing values explicitly.
- Add explicit parameter and return types to exported functions and public APIs. Let framework callbacks infer types when explicit annotations would duplicate or fight the framework's types.
- Prefer string union types over TypeScript enums. Use `readonly` for values and collections that should not be mutated.
- Prefer pure functions, composition, and immutable data where they fit the existing design. Do not replace established service classes or introduce a new architecture just to enforce a functional style.
- Avoid type assertions on external data. Validate untrusted values at system boundaries with Zod or the established equivalent, and derive types from schemas where practical.
- Use early returns to keep conditional logic shallow. Never silently swallow errors; handle them where a meaningful decision can be made or rethrow with useful context.
- Group imports in this order: built-in modules, external dependencies, internal modules, then types. Keep type-only imports explicit with `import type`.
- Follow the project's strict TypeScript, ESM, and module-resolution settings. Preserve the established relative import extension conventions.
- Keep responsibilities at their existing boundaries: validate and translate HTTP input/output in routes, keep business rules in services, and keep persistence in repositories.
- Use parameterized database queries. Keep multi-step writes atomic when partial completion would leave data inconsistent, and make schema changes through migrations.
- In client code, keep browser-only APIs out of server-executed code, represent loading/error/empty states, and follow the UI framework and accessibility patterns already in use. Do not assume a framework when the project has not selected one.
- Add or update focused Vitest coverage for behavior changes, following the existing test conventions.
- Comments are valuable for explaining why code exists, especially for complex business logic or non-obvious decisions. Avoid restating what the code does; focus on the reasoning and context.
