import type { Connect, Logger, ViteDevServer } from "vite";

import type { EleventyPageRenderer, URLPath } from "./vite-plugin-eleventy-api.js";
import { getErrorMessage } from "./vite-plugin-eleventy-error.js";

/**
 * Creates Connect-style middleware that serves rendered Eleventy pages.
 *
 * The middleware resolves each request URL with `findRenderedPageByUrl()`. If a
 * page matches, it writes the rendered HTML to the response and optionally runs
 * it through Vite's HTML pipeline. Otherwise the request falls through to
 * `next()`.
 *
 * @example Mount on a custom Express/Connect app:
 * ```ts
 * import express from "express";
 * import { eleventyPlugin, serveRenderedPagesMiddleware } from "@jsxtools/vite-plugin-11ty";
 *
 * const eleventy = eleventyPlugin({ input: "src/site" });
 * const app = express();
 * app.use(serveRenderedPagesMiddleware(eleventy));
 * ```
 */
export const serveRenderedPagesMiddleware = (
	plugin: EleventyPageRenderer,
	options: ServeRenderedPagesMiddlewareOptions = {},
): Connect.NextHandleFunction => {
	const { server, logger } = options;

	const logFailure = (context: string, error: unknown): void => {
		logger?.error(`[vite-plugin-eleventy] ${context}: ${getErrorMessage(error)}`, {
			error: error instanceof Error ? error : undefined,
		});
	};

	return async (req, res, next): Promise<void> => {
		// Only intercept idempotent reads. POST/PUT/DELETE etc. fall through to
		// later middleware (e.g. an API mounted alongside the static site).
		if (req.method !== "GET" && req.method !== "HEAD") {
			next();

			return;
		}

		const requestUrl: URLPath = req.url ?? req.originalUrl ?? "/";

		if (isViteHtmlProxyRequest(requestUrl)) {
			next();

			return;
		}

		try {
			const page = await plugin.findRenderedPageByUrl(requestUrl);

			if (!page) {
				next();

				return;
			}

			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html");

			if (req.method === "HEAD") {
				res.end();

				return;
			}

			let html = page.content;

			if (server) {
				try {
					html = await plugin.transformPageHtml(server, page, req.originalUrl);
				} catch (error) {
					// Fall back to the raw rendered HTML so the user sees the page
					// even when Vite's HTML pipeline fails (e.g. a downstream plugin
					// throws). The browser loses HMR for this load but the content
					// is still usable.
					logFailure(`failed to transform ${requestUrl}`, error);
				}
			}

			res.end(html);
		} catch (error) {
			logFailure(`failed to serve ${requestUrl}`, error);

			next();
		}
	};
};

const isViteHtmlProxyRequest = (url: URLPath): boolean => {
	const queryIndex = url.indexOf("?");

	if (queryIndex === -1) {
		return false;
	}

	return new URLSearchParams(url.slice(queryIndex + 1)).has("html-proxy");
};

// -----------------------------------------------------------------------------
// #region Types
// -----------------------------------------------------------------------------

export interface ServeRenderedPagesMiddlewareOptions {
	/**
	 * Vite dev server.
	 *
	 * When provided, rendered HTML is run through
	 * `server.transformIndexHtml` (which injects the dev-client script and runs
	 * other plugins' HTML transforms). Omit when mounting outside a Vite dev
	 * server (e.g. on a custom Express app).
	 */
	readonly server?: ViteDevServer;

	/** Logger used to report middleware errors. */
	readonly logger?: Pick<Logger, "error">;
}
