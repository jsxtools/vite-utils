import { type Plugin, parseSync, Visitor } from "vite";
import type { Polyfill } from "./define-polyfill.js";

const PLUGIN_NAME = "vite-plugin-polyfiller";
const VIRTUAL_PREFIX = "virtual:polyfiller/";
const NULL_BYTE = "\0";
const SCRIPT_EXTENSION = /\.[cm]?[jt]sx?(?:\?|$)/;

/** Polyfills bundled with the plugin and enabled by default. */
export const builtinPolyfills: readonly Polyfill[] = await Promise.all([
	import("../polyfills/symbol-dispose-polyfill.js"),
	import("../polyfills/symbol-async-dispose-polyfill.js"),
	import("../polyfills/disposable-stack-polyfill.js"),
	import("../polyfills/async-disposable-stack-polyfill.js"),
	import("../polyfills/suppressed-error-polyfill.js"),
	import("../polyfills/url-pattern-polyfill.js"),
	import("../polyfills/map-upsert-polyfill.js"),
]).then((modules) => modules.map((module) => module.default));

export interface VitePolyfillerOptions {
	/**
	 * The polyfills to detect and inject. Defaults to {@link builtinPolyfills}.
	 *
	 * Pass an explicit array to add custom polyfills, reorder them, or omit
	 * built-ins. Spread `builtinPolyfills` to extend the default set:
	 *
	 * ```ts
	 * vitePolyfiller({ polyfills: [...builtinPolyfills, myCustomPolyfill] });
	 * ```
	 */
	readonly polyfills?: readonly Polyfill[];
}

/**
 * Vite plugin that detects polyfillable language features in transformed
 * source files and prepends imports for matching virtual polyfill modules.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite";
 * import { vitePolyfiller } from "@jsxtools/vite-plugin-polyfiller";
 *
 * export default defineConfig({
 *   plugins: [vitePolyfiller()],
 * });
 * ```
 */
export function vitePolyfiller(options: VitePolyfillerOptions = {}): Plugin {
	const polyfills = options.polyfills ?? builtinPolyfills;
	const codeById = new Map<string, string>(polyfills.map((polyfill) => [VIRTUAL_PREFIX + polyfill.id, polyfill.code]));

	if (codeById.size !== polyfills.length) {
		throw new Error(`[${PLUGIN_NAME}] duplicate polyfill id`);
	}

	return {
		name: PLUGIN_NAME,
		enforce: "pre",

		resolveId(id) {
			return codeById.has(id) ? NULL_BYTE + id : null;
		},

		load(id) {
			return id.startsWith(NULL_BYTE) ? (codeById.get(id.slice(1)) ?? null) : null;
		},

		transform(code, id) {
			if (id.startsWith(NULL_BYTE + VIRTUAL_PREFIX)) return null;
			if (id.includes("node_modules")) return null;
			if (!SCRIPT_EXTENSION.test(id)) return null;

			const matched = detectPolyfills(code, id, polyfills);
			if (matched.length === 0) return null;

			const imports = matched.map((polyfill) => `import"${VIRTUAL_PREFIX}${polyfill.id}";`).join("");

			return { code: imports + code, map: null };
		},
	};
}

/**
 * Parses `code` once and returns the polyfills whose detection visitor
 * reported a match against the resulting AST.
 */
function detectPolyfills(code: string, id: string, polyfills: readonly Polyfill[]): readonly Polyfill[] {
	const { program } = parseSync(id, code);
	const matched: Polyfill[] = [];

	for (const polyfill of polyfills) {
		let found = false;

		const visitor = polyfill.detect(() => {
			found = true;
		});

		new Visitor(visitor).visit(program);

		if (found) {
			matched.push(polyfill);
		}
	}

	return matched;
}
