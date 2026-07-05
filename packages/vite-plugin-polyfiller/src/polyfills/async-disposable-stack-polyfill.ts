import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE =
	`import"virtual:polyfiller/symbol-dispose";` +
	`import"virtual:polyfiller/symbol-async-dispose";` +
	`import{AsyncDisposableStack}from"@jsxtools/explicit-resource-management";` +
	`globalThis.AsyncDisposableStack||Object.defineProperty(globalThis,"AsyncDisposableStack",{value:AsyncDisposableStack,configurable:true,writable:true});`;

/**
 * Polyfills the `AsyncDisposableStack` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "async-disposable-stack",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "AsyncDisposableStack") return;

			found();
		},
	}),
});
