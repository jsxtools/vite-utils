import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, type Rollup, type UserConfig } from "vite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eleventyPlugin, serveRenderedPagesMiddleware } from "../src/vite-plugin-eleventy.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureInput = resolve(here, "fixtures/site");
const fixtureOutput = resolve(here, "fixtures/_site");

const VIRTUAL_ID = "virtual:eleventy/index.html";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

const PLUGIN_NAME = "vite-plugin-eleventy";

const createPlugin = (overrides: Parameters<typeof eleventyPlugin>[0] = {}) =>
	eleventyPlugin({ input: fixtureInput, output: fixtureOutput, dev: false, ...overrides });

type ConfigFn = (uc: object, env: { command: "build" | "serve"; mode: string }) => Promise<UserConfig>;

const callConfig = (plugin: ReturnType<typeof eleventyPlugin>, userCfg: object, command: "build" | "serve") =>
	(plugin.config as unknown as ConfigFn)(userCfg, {
		command,
		mode: command === "build" ? "production" : "development",
	});

describe("eleventyPlugin", () => {
	describe("plugin shape", () => {
		it("returns a valid plugin object", () => {
			const plugin = createPlugin();

			expect(plugin.name).toBe(PLUGIN_NAME);
			expect(plugin.enforce).toBe("pre");
		});

		it("has expected hooks and helpers", () => {
			const plugin = createPlugin();

			expect(plugin.resolveId).toBeDefined();
			expect(plugin.load).toBeDefined();
			expect(plugin.configureServer).toBeDefined();
			expect(plugin.handleHotUpdate).toBeDefined();
			expect(typeof plugin.getRenderedPages).toBe("function");
			expect(typeof plugin.findRenderedPageByUrl).toBe("function");
			expect(typeof plugin.getEntryPoints).toBe("function");
		});
	});

	describe("rendering", () => {
		let plugin: ReturnType<typeof createPlugin>;

		beforeAll(async () => {
			plugin = createPlugin();
			await plugin.getRenderedPages();
		});

		afterEach(() => {
			(plugin.closeBundle as () => void)?.();
		});

		it("renders every input template", async () => {
			const pages = await plugin.getRenderedPages();

			expect(pages).toHaveLength(3);

			const urls = pages.map((page) => page.url).sort();
			expect(urls).toEqual(["/", "/about/", "/posts/hello/"]);
		});

		it("returns rendered HTML content", async () => {
			const pages = await plugin.getRenderedPages();
			const home = pages.find((page) => page.url === "/");

			expect(home?.content).toContain("<h1>Welcome</h1>");
			expect(home?.content).toContain("<p>This is the home page.</p>");
		});

		it("computes output-relative paths under the output dir", async () => {
			const pages = await plugin.getRenderedPages();
			const paths = pages.map((page) => page.outputRelativePath).sort();

			expect(paths).toEqual(["about/index.html", "index.html", "posts/hello/index.html"]);
		});
	});

	describe("getEntryPoints", () => {
		it("maps each page to its absolute output path keyed by stripped extension", async () => {
			const plugin = createPlugin();
			const entries = await plugin.getEntryPoints();

			expect(entries).toEqual({
				index: resolve(fixtureOutput, "index.html"),
				"about/index": resolve(fixtureOutput, "about/index.html"),
				"posts/hello/index": resolve(fixtureOutput, "posts/hello/index.html"),
			});
		});

		it("respects a filter callback", async () => {
			const plugin = createPlugin();
			const entries = await plugin.getEntryPoints((page) => page.url === "/");

			expect(Object.keys(entries)).toEqual(["index"]);
		});
	});

	describe("findRenderedPageByUrl", () => {
		it("resolves a page by its canonical URL", async () => {
			const plugin = createPlugin();
			const page = await plugin.findRenderedPageByUrl("/about/");

			expect(page?.url).toBe("/about/");
		});

		it("resolves a page by its index.html alias", async () => {
			const plugin = createPlugin();
			const page = await plugin.findRenderedPageByUrl("/about/index.html");

			expect(page?.url).toBe("/about/");
		});

		it("resolves a page when the trailing slash is missing", async () => {
			const plugin = createPlugin();
			const page = await plugin.findRenderedPageByUrl("/about");

			expect(page?.url).toBe("/about/");
		});

		it("ignores query strings when matching", async () => {
			const plugin = createPlugin();
			const page = await plugin.findRenderedPageByUrl("/?foo=bar");

			expect(page?.url).toBe("/");
		});

		it("returns undefined for an unknown URL", async () => {
			const plugin = createPlugin();
			const page = await plugin.findRenderedPageByUrl("/missing/");

			expect(page).toBeUndefined();
		});
	});

	describe("resolveId / load", () => {
		it("resolves and loads a public virtual id", async () => {
			const plugin = createPlugin();
			await plugin.getRenderedPages();

			const resolveId = plugin.resolveId as (id: string) => string | null;
			const load = plugin.load as (this: { error: (msg: string) => never }, id: string) => string | null;

			expect(resolveId(VIRTUAL_ID)).toBe(RESOLVED_VIRTUAL_ID);

			const ctx = {
				error: (msg: string): never => {
					throw new Error(msg);
				},
			};
			expect(load.call(ctx, RESOLVED_VIRTUAL_ID)).toContain("<h1>Welcome</h1>");
		});

		it("resolves and loads an absolute output path", async () => {
			const plugin = createPlugin();
			await plugin.getRenderedPages();

			const resolveId = plugin.resolveId as (id: string) => string | null;
			const load = plugin.load as (id: string) => string | null;

			const absId = resolve(fixtureOutput, "about/index.html");
			expect(resolveId(absId)).toBe(absId);
			expect(load(absId)).toContain("<h1>About</h1>");
		});

		it("preserves query strings and hash fragments on inline-style virtual ids", async () => {
			const plugin = createPlugin({ dev: true });
			await plugin.getRenderedPages();

			const resolveId = plugin.resolveId as (id: string) => string | null;
			const resolvedInlineStyleId = resolve(fixtureOutput, "index.html.__eleventy_inline_style_0.css");

			expect(resolveId("/index.html.__eleventy_inline_style_0.css?direct")).toBe(`${resolvedInlineStyleId}?direct`);
			expect(resolveId("/index.html.__eleventy_inline_style_0.css#fragment")).toBe(`${resolvedInlineStyleId}#fragment`);
		});

		it("returns null for unknown ids", async () => {
			const plugin = createPlugin();
			await plugin.getRenderedPages();

			const resolveId = plugin.resolveId as (id: string) => string | null;
			const load = plugin.load as (id: string) => string | null;

			expect(resolveId("./unrelated.js")).toBeNull();
			expect(load("./unrelated.js")).toBeNull();
		});
	});

	describe("config()", () => {
		it("auto-wires build.rollupOptions.input and defaults appType to mpa in build", async () => {
			const config = await callConfig(createPlugin(), {}, "build");
			const input = config.build?.rollupOptions?.input as Record<string, string>;

			expect(config.appType).toBe("mpa");
			expect(Object.keys(input).sort()).toEqual(["about/index", "index", "posts/hello/index"]);
			expect(input.index).toBe(resolve(fixtureOutput, "index.html"));
		});

		it("does not inject build.rollupOptions.input in serve mode", async () => {
			const config = await callConfig(createPlugin(), {}, "serve");

			expect(config.appType).toBe("mpa");
			expect(config.build).toBeUndefined();
		});

		it("respects an explicit user appType", async () => {
			const config = await callConfig(createPlugin(), { appType: "spa" }, "serve");

			expect(config.appType).toBeUndefined();
		});

		it("disables auto-wiring when entries: false", async () => {
			const config = await callConfig(createPlugin({ entries: false }), {}, "build");

			expect(config.build).toBeUndefined();
		});

		it("invokes the entries callback to transform the entry map", async () => {
			let received: Record<string, string> | undefined;
			const plugin = createPlugin({
				entries: (defaults) => {
					received = defaults;
					return { home: defaults.index };
				},
			});
			const config = await callConfig(plugin, {}, "build");

			expect(received && Object.keys(received).sort()).toEqual(["about/index", "index", "posts/hello/index"]);
			expect(config.build?.rollupOptions?.input).toEqual({ home: resolve(fixtureOutput, "index.html") });
		});
	});

	describe("default output directory (regression)", () => {
		it("computes a clean outputRelativePath when output is omitted", async () => {
			const plugin = eleventyPlugin({ input: fixtureInput });
			const pages = await plugin.getRenderedPages();

			expect(pages.length).toBe(3);
			for (const page of pages) {
				expect(page.outputRelativePath.startsWith("..")).toBe(false);
				expect(page.outputRelativePath.endsWith(".html")).toBe(true);
			}
		});
	});

	describe("config auto-detection", () => {
		const withConfigRoot = resolve(here, "fixtures/with-config");

		it("loads eleventy.config.js when configPath is unset", async () => {
			const plugin = eleventyPlugin({ input: "site", dev: false });
			await callConfig(plugin, { root: withConfigRoot }, "build");
			const pages = await plugin.getRenderedPages();

			expect(pages).toHaveLength(1);
			expect(pages[0].content).toContain("hello-from-config");
		});
	});

	describe("buildStart + watchChange", () => {
		const collectWatchFiles = async (plugin: ReturnType<typeof eleventyPlugin>): Promise<string[]> => {
			const watched: string[] = [];
			const ctx = {
				addWatchFile(file: string): void {
					watched.push(file);
				},
				error(message: string): never {
					throw new Error(message);
				},
			};
			const buildStart = plugin.buildStart as (this: typeof ctx) => Promise<void>;
			await buildStart.call(ctx);

			return watched;
		};

		it("registers every input file with the rollup watcher", async () => {
			const plugin = createPlugin();
			await callConfig(plugin, {}, "build");
			const watched = await collectWatchFiles(plugin);

			expect(watched).toContain(resolve(fixtureInput, "about.md"));
			expect(watched).toContain(resolve(fixtureInput, "index.md"));
			expect(watched).toContain(resolve(fixtureInput, "posts/hello.md"));
		});

		it("registers an auto-detected config file with the rollup watcher", async () => {
			const withConfigRoot = resolve(here, "fixtures/with-config");
			const plugin = eleventyPlugin({ input: "site", dev: false });
			await callConfig(plugin, { root: withConfigRoot }, "build");
			const watched = await collectWatchFiles(plugin);

			expect(watched).toContain(resolve(withConfigRoot, "eleventy.config.js"));
		});

		it("registers all candidate config paths when no config is resolved", async () => {
			const noConfigRoot = resolve(here, "fixtures/site");
			const plugin = eleventyPlugin({ input: noConfigRoot, dev: false });
			await callConfig(plugin, { root: noConfigRoot }, "build");
			const watched = await collectWatchFiles(plugin);

			// Without a resolved config, every known candidate path is watched
			// so creating one later still triggers the change pipeline.
			expect(watched).toContain(resolve(noConfigRoot, "eleventy.config.js"));
			expect(watched).toContain(resolve(noConfigRoot, "eleventy.config.ts"));
			expect(watched).toContain(resolve(noConfigRoot, ".eleventy.cjs"));
		});

		it("re-renders incrementally on watchChange", async () => {
			const plugin = createPlugin();
			await callConfig(plugin, {}, "build");
			await collectWatchFiles(plugin);

			const watchChange = plugin.watchChange as (
				this: object,
				id: string,
				change: { event: "create" | "update" | "delete" },
			) => Promise<void>;

			// Should not throw and should leave the cache populated.
			await watchChange.call({}, resolve(fixtureInput, "index.md"), { event: "update" });
			const pages = await plugin.getRenderedPages();

			expect(pages).toHaveLength(3);
		});

		it("ignores files outside the input directory in watchChange", async () => {
			const plugin = createPlugin();
			await callConfig(plugin, {}, "build");
			await collectWatchFiles(plugin);

			const watchChange = plugin.watchChange as (
				this: object,
				id: string,
				change: { event: "create" | "update" | "delete" },
			) => Promise<void>;

			await expect(watchChange.call({}, resolve(here, "unrelated.ts"), { event: "update" })).resolves.toBeUndefined();
		});
	});

	describe("serveRenderedPagesMiddleware", () => {
		const invokeMiddleware = (
			middleware: ReturnType<typeof serveRenderedPagesMiddleware>,
			url: string,
			method: "GET" | "HEAD" | "POST" = "GET",
		) => {
			let endedWith: string | undefined;
			let endCalled = false;
			let status = 0;
			const headers: Record<string, string> = {};
			let nextCalled = false;

			const done = new Promise<void>((resolve) => {
				const res = {
					set statusCode(value: number) {
						status = value;
					},
					setHeader(name: string, value: string): void {
						headers[name] = value;
					},
					end(value?: string): void {
						endedWith = value;
						endCalled = true;
						resolve();
					},
				};
				const next = (): void => {
					nextCalled = true;
					resolve();
				};

				middleware({ method, url } as never, res as never, next);
			});

			return done.then(() => ({ endedWith, endCalled, status, headers, nextCalled }));
		};

		it("serves a known url with rendered HTML", async () => {
			const middleware = serveRenderedPagesMiddleware(createPlugin());
			const result = await invokeMiddleware(middleware, "/about/");

			expect(result.status).toBe(200);
			expect(result.headers["Content-Type"]).toBe("text/html");
			expect(result.endedWith).toContain("<h1>About</h1>");
			expect(result.nextCalled).toBe(false);
		});

		it("falls through to next() for an unknown url", async () => {
			const middleware = serveRenderedPagesMiddleware(createPlugin());
			const result = await invokeMiddleware(middleware, "/missing/");

			expect(result.nextCalled).toBe(true);
			expect(result.endedWith).toBeUndefined();
		});

		it("falls through to next() for Vite html-proxy requests", async () => {
			const middleware = serveRenderedPagesMiddleware(createPlugin());
			const result = await invokeMiddleware(middleware, "/about/?html-proxy&index=0.js");

			expect(result.nextCalled).toBe(true);
			expect(result.endedWith).toBeUndefined();
		});

		it("falls through to next() for non-GET/HEAD methods", async () => {
			const middleware = serveRenderedPagesMiddleware(createPlugin());
			const result = await invokeMiddleware(middleware, "/about/", "POST");

			expect(result.nextCalled).toBe(true);
			expect(result.endCalled).toBe(false);
		});

		it("answers HEAD with headers but no body", async () => {
			const middleware = serveRenderedPagesMiddleware(createPlugin());
			const result = await invokeMiddleware(middleware, "/about/", "HEAD");

			expect(result.status).toBe(200);
			expect(result.headers["Content-Type"]).toBe("text/html");
			expect(result.endedWith).toBeUndefined();
			expect(result.endCalled).toBe(true);
			expect(result.nextCalled).toBe(false);
		});
	});

	describe("inline <style> @import resolution", () => {
		const inlineStyleRoot = resolve(here, "fixtures/with-inline-style");

		// Vite resolves CSS @import via its own resolver chain (alias + node module
		// resolution), not the rollup resolveId chain, so the only realistic way
		// to verify package-style @import inside inline <style> is to put a real
		// package on disk under node_modules.
		beforeAll(() => {
			const pkgDir = resolve(inlineStyleRoot, "node_modules/fake-css-pkg");
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(
				resolve(pkgDir, "package.json"),
				JSON.stringify({ name: "fake-css-pkg", version: "0.0.0", style: "main.css" }),
			);
			writeFileSync(resolve(pkgDir, "ReveUI.shifted-variable.woff2"), "fake-font\n");
			writeFileSync(
				resolve(pkgDir, "main.css"),
				[
					'@font-face { font-family: "ReveUI"; src: url("./ReveUI.shifted-variable.woff2") format("woff2"); }',
					".from-pkg { color: red; }",
				].join("\n"),
			);
		});

		const findAsset = (output: Rollup.RollupOutput["output"], fileName: string): string | undefined => {
			const asset = output.find(
				(chunk): chunk is Rollup.OutputAsset => chunk.type === "asset" && chunk.fileName === fileName,
			);

			return asset ? String(asset.source) : undefined;
		};

		it("resolves a package-style @import inside an inline <style> block during vite build", async () => {
			const result = await build({
				root: inlineStyleRoot,
				logLevel: "silent",
				build: {
					write: false,
					minify: false,
					outDir: resolve(inlineStyleRoot, "_site"),
					emptyOutDir: false,
				},
				plugins: [eleventyPlugin({ input: "site", output: "_site", dev: false })],
			});

			const output = Array.isArray(result) ? result[0].output : (result as Rollup.RollupOutput).output;
			const html = findAsset(output, "_site/index.html");

			expect(html).toBeDefined();
			// The bare specifier was resolved through Vite's CSS pipeline, the
			// imported file was inlined, and the original @import statement was
			// removed.
			expect(html).toContain(".from-pkg");
			expect(html).toContain(".local");
			expect(html).not.toContain('@import "fake-css-pkg/main.css"');
		});

		it("resolves a package-style @import inside an inline <style> block during vite dev", async () => {
			const plugin = eleventyPlugin({ input: "site", output: "_site", dev: true });
			const server = await createServer({
				root: inlineStyleRoot,
				logLevel: "silent",
				server: { middlewareMode: true },
				plugins: [plugin],
			});

			try {
				const page = await plugin.findRenderedPageByUrl("/");
				expect(page).toBeDefined();
				if (!page) return;

				const html = await plugin.transformPageHtml(server, page);
				const stylesheetPath = html.match(/href="([^"]+__eleventy_inline_style_[0-9]+\.css)"/)?.[1];
				const stylesheet = stylesheetPath ? await server.transformRequest(`${stylesheetPath}?direct`) : undefined;

				// `transformPageHtml` externalizes eligible inline styles to page-scoped
				// virtual CSS files so Vite can process them as normal stylesheet
				// requests in dev.
				expect(html).not.toContain('@import "fake-css-pkg/main.css"');
				expect(stylesheetPath).toBeDefined();
				expect(stylesheet?.code).toContain(".from-pkg");
				expect(stylesheet?.code).toContain(".local");
				expect(stylesheet?.code).toContain("/node_modules/fake-css-pkg/ReveUI.shifted-variable.woff2");
				expect(stylesheet?.code).not.toContain("./ReveUI.shifted-variable.woff2");
				// The rest of Vite's HTML pipeline should still run end-to-end:
				// the dev-client tag is the canary for `transformIndexHtml` having
				// applied its built-in HTML transforms.
				expect(html).toContain("/@vite/client");
			} finally {
				await server.close();
			}
		});
	});

	describe("collection invalidation on add (dev)", () => {
		const collectionRoot = resolve(here, "fixtures/with-collection");
		const collectionInput = resolve(collectionRoot, "site");
		const collectionOutput = resolve(collectionRoot, "_site");
		const newPostPath = resolve(collectionInput, "posts/second.md");

		const cleanupNewPost = (): void => {
			if (existsSync(newPostPath)) {
				rmSync(newPostPath);
			}
		};

		afterEach(() => {
			cleanupNewPost();
		});

		// Whether adding a tagged file to the input directory makes the
		// listing page (which iterates `collections.post`) reflect that new
		// entry. Eleventy's incremental mode (`setIncrementalFile`) re-renders
		// only the targeted file, so collection consumers can stay stale —
		// the only way to guarantee the listing updates is to do a full
		// reset on add events.
		it("rerenders pages that consume a collection when a new tagged file is added", async () => {
			cleanupNewPost();

			const plugin = eleventyPlugin({ input: "site", output: "_site", dev: true });
			const server = await createServer({
				root: collectionRoot,
				logLevel: "silent",
				server: { middlewareMode: true },
				plugins: [plugin],
			});

			try {
				const initial = await plugin.findRenderedPageByUrl("/posts/");
				expect(initial?.content).toContain("First Post");
				expect(initial?.content).not.toContain("Second Post");

				writeFileSync(newPostPath, "---\ntitle: Second Post\ntags: post\n---\n\nSecond!\n");

				// Drive the watcher synchronously so the test doesn't race
				// against chokidar's filesystem polling. The handler queues
				// its work via `runExclusive`, so calling `getRenderedPages`
				// next chains behind it.
				server.watcher.emit("add", newPostPath);
				await plugin.getRenderedPages();

				const updated = await plugin.findRenderedPageByUrl("/posts/");
				expect(updated?.content).toContain("Second Post");
			} finally {
				await server.close();
				// Output dir is created by Vite even with no real build; tidy
				// it so the fixture stays clean across runs.
				if (existsSync(collectionOutput)) {
					rmSync(collectionOutput, { recursive: true, force: true });
				}
			}
		});
	});
});
