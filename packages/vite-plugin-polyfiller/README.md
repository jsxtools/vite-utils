# @jsxtools/vite-plugin-polyfiller

A [Vite] plugin that detects polyfillable language features in your source
files and injects runtime only when it is needed.

The plugin parses each transformed module with Vite's OXC parser utilities and
walks the AST. When a polyfill matches, it prepends an import of a virtual
runtime module, so the polyfill ships once per build and Rollup can tree-shake
it out of chunks that do not use it.

## Install

```sh
npm install --save-dev @jsxtools/vite-plugin-polyfiller
```

`vite` 8 or newer is a peer dependency. Install it in the same project as this
plugin.

## Usage

```ts
import { defineConfig } from "vite";
import { vitePolyfiller } from "@jsxtools/vite-plugin-polyfiller";

export default defineConfig({
	plugins: [vitePolyfiller()],
});
```

## Built-in polyfills

| Id                       | Feature                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `symbol-dispose`         | `Symbol.dispose` well-known symbol                                       |
| `symbol-async-dispose`   | `Symbol.asyncDispose` well-known symbol                                  |
| `disposable-stack`       | Global `DisposableStack`                                                 |
| `async-disposable-stack` | Global `AsyncDisposableStack`                                            |
| `suppressed-error`       | Global `SuppressedError`                                                 |
| `url-pattern`            | Global `URLPattern`                                                      |
| `map-upsert`             | `Map.prototype.{getOrInsert, getOrInsertComputed}` and `WeakMap` equivs. |

Detection matches member expressions like `Symbol.dispose` or
`cache.getOrInsert(...)`, plus global constructor references like
`new DisposableStack()` or `new URLPattern(...)`. References inside string
literals or comments are ignored because detection runs on the AST.

## TypeScript

Each built-in polyfill that augments a built-in interface ships an ambient
`.d.ts` file. Reference the barrel from any `.d.ts` in your project to opt into
all of them at once:

```ts
/// <reference types="@jsxtools/vite-plugin-polyfiller/types" />
```

Or pick just the ones you use:

```ts
/// <reference types="@jsxtools/vite-plugin-polyfiller/types/map-upsert" />
```

`Symbol.dispose`, `SuppressedError`, `DisposableStack`, and
`AsyncDisposableStack` are already covered by TypeScript's built-in disposable
libs, so those polyfills do not need a separate reference.

## Custom polyfills

Pass a `polyfills` array to add your own, override built-ins, or disable the
defaults entirely. Use `definePolyfill` to get type checking for the polyfill
shape:

```ts
import { builtinPolyfills, definePolyfill, vitePolyfiller } from "@jsxtools/vite-plugin-polyfiller";

const myPolyfill = definePolyfill({
	id: "my-feature",
	code: `MyAPI.feature ||= () => { /* ... */ };`,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) return;
			if (node.object.type !== "Identifier" || node.object.name !== "MyAPI") return;
			if (node.property.type !== "Identifier" || node.property.name !== "feature") return;
			found();
		},
	}),
});

vitePolyfiller({ polyfills: [...builtinPolyfills, myPolyfill] });
```

The `detect` callback receives a `found` signal and returns a Vite OXC visitor
object. Call `found()` from any visitor method that proves the polyfill is
needed.

## How it works

For each module Vite asks the plugin to transform, it:

1. Skips the file if it lives in `node_modules`, is a virtual module, or does
   not have a JS/TS extension (`.js`, `.cjs`, `.mjs`, `.jsx`, `.ts`, `.cts`,
   `.mts`, `.tsx`, optionally followed by a query string).
2. Parses the source with Vite's OXC-backed `parseSync`.
3. Runs each registered polyfill's detection visitor against the parsed
   program.
4. Prepends `import "virtual:polyfiller/<id>";` for every polyfill that matched.

Each virtual module is served from memory by the plugin's `load` hook and
contains a self-guarding runtime snippet that no-ops when the feature already
exists in the target environment.

## License

MIT-0

[Vite]: https://vite.dev
