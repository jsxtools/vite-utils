import { definePolyfill } from "../plugin/define-polyfill.js";

/**
 * Polyfills the `URLPattern` global.
 */
export default definePolyfill({
	id: "url-pattern",
	code: `import"urlpattern-polyfill";`,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "URLPattern") return;

			found();
		},
	}),
});
