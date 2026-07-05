import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE =
	`import{SuppressedError}from"@jsxtools/explicit-resource-management";` +
	`globalThis.SuppressedError||Object.defineProperty(globalThis,"SuppressedError",{value:SuppressedError,configurable:true,writable:true});`;

/**
 * Polyfills the `SuppressedError` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "suppressed-error",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "SuppressedError") return;

			found();
		},
	}),
});
