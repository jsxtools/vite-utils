import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `Symbol.asyncDispose||Object.defineProperty(Symbol,"asyncDispose",{value:Symbol("Symbol.asyncDispose")});`;

/**
 * Polyfills the `Symbol.asyncDispose` well-known symbol used by the explicit resource management proposal (`using` / `await using`).
 */
export default definePolyfill({
	id: "symbol-async-dispose",
	code: RUNTIME_CODE,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) return;
			if (node.object.type !== "Identifier" || node.object.name !== "Symbol") return;
			if (node.property.type !== "Identifier") return;
			if (node.property.name !== "asyncDispose") return;

			found();
		},
	}),
});
