import { describe, expect, it } from "vitest";
import { builtinPolyfills, definePolyfill, vitePolyfiller } from "../src/vite-plugin-polyfiller.js";

const VIRTUAL_MODULE_ID = "virtual:polyfiller/symbol-dispose";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;
const SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID = "virtual:polyfiller/symbol-async-dispose";
const RESOLVED_SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID = "\0" + SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID;
const DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "virtual:polyfiller/disposable-stack";
const RESOLVED_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "\0" + DISPOSABLE_STACK_VIRTUAL_MODULE_ID;
const ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "virtual:polyfiller/async-disposable-stack";
const RESOLVED_ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID = "\0" + ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID;
const SUPPRESSED_ERROR_VIRTUAL_MODULE_ID = "virtual:polyfiller/suppressed-error";
const RESOLVED_SUPPRESSED_ERROR_VIRTUAL_MODULE_ID = "\0" + SUPPRESSED_ERROR_VIRTUAL_MODULE_ID;
const URL_PATTERN_VIRTUAL_MODULE_ID = "virtual:polyfiller/url-pattern";
const RESOLVED_URL_PATTERN_VIRTUAL_MODULE_ID = "\0" + URL_PATTERN_VIRTUAL_MODULE_ID;

describe("vitePolyfiller", () => {
	describe("plugin shape", () => {
		it("returns a valid plugin object", () => {
			const plugin = vitePolyfiller();

			expect(plugin.name).toBe("vite-plugin-polyfiller");
			expect(plugin.enforce).toBe("pre");
		});

		it("has required hooks", () => {
			const plugin = vitePolyfiller();

			expect(plugin.resolveId).toBeDefined();
			expect(plugin.load).toBeDefined();
			expect(plugin.transform).toBeDefined();
		});
	});

	describe("virtual module", () => {
		it("resolves virtual module id", () => {
			const plugin = vitePolyfiller();
			const resolveId = plugin.resolveId as (id: string) => string | null;

			expect(resolveId(VIRTUAL_MODULE_ID)).toBe(RESOLVED_VIRTUAL_MODULE_ID);
			expect(resolveId("other-module")).toBeNull();
		});

		it("loads polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_VIRTUAL_MODULE_ID);
			expect(code).toContain("Symbol.dispose");
			expect(code).toContain("Object.defineProperty");
			expect(load("other-module")).toBeNull();
		});

		it("loads Symbol.asyncDispose polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID);
			expect(code).toContain("Symbol.asyncDispose");
			expect(code).toContain("Object.defineProperty");
			expect(load("other-module")).toBeNull();
		});

		it("loads DisposableStack polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_DISPOSABLE_STACK_VIRTUAL_MODULE_ID);
			expect(code).toContain('import"virtual:polyfiller/symbol-dispose"');
			expect(code).toContain('from"@jsxtools/explicit-resource-management"');
			expect(code).toContain("globalThis.DisposableStack");
			expect(load("other-module")).toBeNull();
		});

		it("loads AsyncDisposableStack polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID);
			expect(code).toContain('import"virtual:polyfiller/symbol-dispose"');
			expect(code).toContain('import"virtual:polyfiller/symbol-async-dispose"');
			expect(code).toContain('from"@jsxtools/explicit-resource-management"');
			expect(code).toContain("globalThis.AsyncDisposableStack");
			expect(load("other-module")).toBeNull();
		});

		it("loads SuppressedError polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_SUPPRESSED_ERROR_VIRTUAL_MODULE_ID);
			expect(code).toContain('from"@jsxtools/explicit-resource-management"');
			expect(code).toContain("globalThis.SuppressedError");
			expect(load("other-module")).toBeNull();
		});

		it("loads URLPattern polyfill code for virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(RESOLVED_URL_PATTERN_VIRTUAL_MODULE_ID);
			expect(code).toBe('import"urlpattern-polyfill";');
			expect(load("other-module")).toBeNull();
		});
	});

	describe("transform hook", () => {
		it("returns null for non-JS files", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			expect(transform(".class { color: red; }", "/src/styles.css")).toBe(null);
		});

		it("returns null for node_modules", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			expect(transform("export default {}", "/node_modules/pkg/index.js")).toBe(null);
		});

		it("injects virtual import when Symbol.dispose is referenced", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.dispose;", "/src/file.js");
			expect(result).not.toBe(null);
			expect(result).toHaveProperty("code");
			const transformed = result as { code: string };
			expect(transformed.code).toContain(`import"${VIRTUAL_MODULE_ID}"`);
			expect(transformed.code).toContain("const x = Symbol.dispose;");
		});

		it("does not inject import when Symbol.dispose is not referenced", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.iterator;", "/src/file.js");
			expect(result).toBe(null);
		});

		it("does not inject import when Symbol.dispose is only in a string", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform('const msg = "Symbol.dispose is cool";', "/src/file.js");
			expect(result).toBe(null);
		});

		it("injects virtual import when Symbol.asyncDispose is referenced", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.asyncDispose;", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${SYMBOL_ASYNC_DISPOSE_VIRTUAL_MODULE_ID}"`);
		});

		it("injects virtual import when DisposableStack is constructed", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const stack = new DisposableStack();", "/src/file.js");
			expect(result).not.toBe(null);
			const transformed = result as { code: string };
			expect(transformed.code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
			expect(transformed.code).toContain("new DisposableStack()");
		});

		it("injects virtual import when AsyncDisposableStack is constructed", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const stack = new AsyncDisposableStack();", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${ASYNC_DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("injects virtual import when SuppressedError is used in instanceof", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const match = error instanceof SuppressedError;", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${SUPPRESSED_ERROR_VIRTUAL_MODULE_ID}"`);
		});

		it("injects virtual import when URLPattern is constructed", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const pattern = new URLPattern({ pathname: '/:id' });", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${URL_PATTERN_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import when DisposableStack is only referenced in a type", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("type Stack = DisposableStack;", "/src/file.ts");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import for declaration-only builtin names", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const DisposableStack = MyLocalThing;", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import for import-only builtin names", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("import { DisposableStack } from './shim.js';", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import for non-global property names", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const obj = { DisposableStack: 1 }; source.DisposableStack;", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("injects import for globalThis.DisposableStack", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const stack = globalThis.DisposableStack;", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import when a later top-level declaration shadows DisposableStack", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform(
				"function make(){ return new DisposableStack(); } const DisposableStack = MyLocalThing;",
				"/src/file.js",
			);
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("conservatively injects import when DisposableStack is imported later in the module", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform(
				"const make = () => new DisposableStack(); import { DisposableStack } from './shim.js';",
				"/src/file.js",
			);
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("still injects import for an unbound DisposableStack inside a nested function", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("function make(){ return new DisposableStack(); }", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
		});

		it("preserves user code in the transformed output", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.dispose;", "/src/file.js");
			const code = (result as { code: string }).code;
			expect(code).toContain("const x = Symbol.dispose;");
		});

		it("parses TypeScript syntax", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x: symbol = Symbol.dispose;", "/src/file.ts");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${VIRTUAL_MODULE_ID}"`);
		});

		it("parses TSX syntax", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const node = <div>{String(Symbol.dispose)}</div>;", "/src/file.tsx");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"${VIRTUAL_MODULE_ID}"`);
		});

		it("handles query suffixes on script ids", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.dispose;", "/src/file.ts?import");
			expect(result).not.toBe(null);
		});
	});

	describe("options.polyfills", () => {
		const customPolyfill = definePolyfill({
			id: "custom-feature",
			code: "/* custom runtime */",
			detect: (found) => ({
				MemberExpression(node) {
					if (node.computed) return;
					if (node.object.type !== "Identifier" || node.object.name !== "MyAPI") return;
					if (node.property.type !== "Identifier" || node.property.name !== "feature") return;
					found();
				},
			}),
		});

		it("exposes the built-in polyfill list", () => {
			const ids = builtinPolyfills.map((polyfill) => polyfill.id);
			expect(ids).toEqual([
				"symbol-dispose",
				"symbol-async-dispose",
				"disposable-stack",
				"async-disposable-stack",
				"suppressed-error",
				"url-pattern",
				"map-upsert",
			]);
		});

		it("registers a custom polyfill's virtual module", () => {
			const plugin = vitePolyfiller({ polyfills: [customPolyfill] });
			const resolveId = plugin.resolveId as (id: string) => string | null;
			const load = plugin.load as (id: string) => string | null;

			expect(resolveId("virtual:polyfiller/custom-feature")).toBe("\0virtual:polyfiller/custom-feature");
			expect(load("\0virtual:polyfiller/custom-feature")).toBe("/* custom runtime */");
		});

		it("detects a custom polyfill in user code", () => {
			const plugin = vitePolyfiller({ polyfills: [customPolyfill] });
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("MyAPI.feature();", "/src/file.js");
			expect(result).not.toBe(null);
			expect((result as { code: string }).code).toContain(`import"virtual:polyfiller/custom-feature"`);
		});

		it("omits built-ins when an explicit list is provided", () => {
			const plugin = vitePolyfiller({ polyfills: [customPolyfill] });
			const resolveId = plugin.resolveId as (id: string) => string | null;

			expect(resolveId(VIRTUAL_MODULE_ID)).toBeNull();
		});

		it("composes built-ins with custom polyfills", () => {
			const plugin = vitePolyfiller({ polyfills: [...builtinPolyfills, customPolyfill] });
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("const x = Symbol.dispose; new DisposableStack(); MyAPI.feature();", "/src/file.js");
			const code = (result as { code: string }).code;
			expect(code).toContain(`import"${VIRTUAL_MODULE_ID}"`);
			expect(code).toContain(`import"${DISPOSABLE_STACK_VIRTUAL_MODULE_ID}"`);
			expect(code).toContain(`import"virtual:polyfiller/custom-feature"`);
		});

		it("throws on duplicate polyfill ids", () => {
			expect(() => vitePolyfiller({ polyfills: [customPolyfill, customPolyfill] })).toThrow(/duplicate polyfill id/);
		});
	});

	describe("map-upsert polyfill", () => {
		const MAP_UPSERT_VIRTUAL = "virtual:polyfiller/map-upsert";

		it("loads the runtime via the virtual module", () => {
			const plugin = vitePolyfiller();
			const load = plugin.load as (id: string) => string | null;

			const code = load(`\0${MAP_UPSERT_VIRTUAL}`);
			expect(code).toContain("getOrInsert");
			expect(code).toContain("getOrInsertComputed");
		});

		it("injects the import when getOrInsert is called", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("cache.getOrInsert(key, value);", "/src/file.js");
			expect((result as { code: string }).code).toContain(`import"${MAP_UPSERT_VIRTUAL}"`);
		});

		it("injects the import when getOrInsertComputed is called", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			const result = transform("cache.getOrInsertComputed(key, () => 1);", "/src/file.js");
			expect((result as { code: string }).code).toContain(`import"${MAP_UPSERT_VIRTUAL}"`);
		});

		it("does not inject when only unrelated methods are referenced", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			expect(transform("cache.get(key); cache.set(key, value);", "/src/file.js")).toBe(null);
		});

		it("does not inject when the name only appears in a string", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			expect(transform('const msg = "use getOrInsert";', "/src/file.js")).toBe(null);
		});

		it("does not inject for computed property access", () => {
			const plugin = vitePolyfiller();
			const transform = plugin.transform as (code: string, id: string) => unknown;

			expect(transform('cache["getOrInsert"](key, value);', "/src/file.js")).toBe(null);
		});
	});
});
