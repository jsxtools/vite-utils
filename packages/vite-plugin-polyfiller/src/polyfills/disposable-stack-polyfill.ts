import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE =
	`import"virtual:polyfiller/symbol-dispose";` +
	`import{DisposableStack}from"@jsxtools/explicit-resource-management";` +
	`globalThis.DisposableStack||Object.defineProperty(globalThis,"DisposableStack",{value:DisposableStack,configurable:true,writable:true});`;

/**
 * Polyfills the `DisposableStack` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "disposable-stack",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "DisposableStack") return;

			found();
		},
	}),
});
