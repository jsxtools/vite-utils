import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { JSONMapEntry } from "@11ty/eleventy";
import Eleventy from "@11ty/eleventy";
import type { Logger, ResolvedConfig, UserConfig, ViteDevServer } from "vite";

import type {
	EleventyEntryOverride,
	EleventyPlugin,
	EleventyPluginOptions,
	FilePathAbs,
	FilePathRel,
	ModuleId,
	RenderedPage,
	URLPath,
} from "./vite-plugin-eleventy-api.js";
import { getInlineStyleCount, getInlineStyleSource, preprocessInlineStyles } from "./vite-plugin-eleventy-css.js";
import { getErrorMessage, StaleEleventyStateError } from "./vite-plugin-eleventy-error.js";
import { serveRenderedPagesMiddleware } from "./vite-plugin-eleventy-server.js";

export const eleventyPlugin = (options: EleventyPluginOptions = {}): EleventyPlugin => {
	const {
		input: explicitInput,
		output: explicitOutput,
		configPath: explicitConfigPath,
		virtualPrefix,
		quietMode,
		dataFilterSelectors,
		entries: entriesOption,
		dev: explicitDev,
	} = {
		dataFilterSelectors: [],
		entries: defaultEntriesOption,
		quietMode: true,
		virtualPrefix: DEFAULT_VIRTUAL_PREFIX,
		...options,
	};

	/** Runtime mode flags and invalidation counters for the current plugin run. */
	const flags = Object.seal({
		/** Whether the current run is in Vite dev/serve mode. */
		isDevMode: explicitDev ?? false,

		/** Whether the current build is in Rollup watch mode. */
		isBuildWatchMode: false,

		/** Whether the current project, input, output, and config paths have been resolved. */
		isEveryDirResolved: false,

		/** Monotonic version that invalidates stale Eleventy work. */
		version: 0,
	});

	/** Runtime paths and candidates for the current plugin run. */
	const paths = Object.seal({
		/** Absolute path to the Vite root directory, when known. */
		viteRootDir: undefined as FilePathAbs | undefined,

		/** Absolute path to the project root directory used to resolve Eleventy paths. */
		projectDir: "" as FilePathAbs,

		/** Absolute path to the Eleventy input directory. */
		inputDir: "" as FilePathAbs,

		/** Absolute path to the Eleventy output directory. */
		outputDir: "" as FilePathAbs,

		/** Absolute path to the Eleventy config file, when one exists. */
		eleventyConfigPath: undefined as FilePathAbs | undefined,

		/** Candidate absolute Eleventy config file paths in resolution order. */
		candidateConfigPaths: new Set() as ReadonlySet<FilePathAbs>,
	});

	/** Runtime queues for the current plugin run. */
	const queues = Object.seal({
		/** Promise chain that serializes exclusive Eleventy operations. */
		exclusiveOperation: Promise.resolve(),
	});

	/** Rendered page maps for the current plugin run. */
	const pageMaps = Object.freeze({
		/** Rendered pages by output path. */
		byOutputPath: new Map<
			/** Forward-slash relative path. */
			FilePathRel,
			RenderedPage
		>(),

		/** Rendered pages by URL alias. */
		byUrl: new Map<
			/** URL pathname. */
			URLPath,
			RenderedPage
		>(),
	});

	const internalPrefix = NULL_BYTE + virtualPrefix;

	/** Returns whether the module id uses the public virtual prefix. */
	const isPublicId = (id: ModuleId): boolean => id.startsWith(virtualPrefix);

	/** Returns the internal prefixed id for the given output-relative path. */
	const toPrefixId = (outputRelativePath: FilePathRel): ModuleId => internalPrefix + outputRelativePath;

	/** Returns whether the module id uses the internal virtual prefix. */
	const isInternalId = (id: ModuleId): boolean => id.startsWith(internalPrefix);

	/** Returns the internal virtual id for the given public module id. */
	const toInternalId = (id: ModuleId): ModuleId => NULL_BYTE + id;

	let eleventy: EleventyInstance | undefined;
	let logger: Logger | undefined;
	let resolvedConfig: ResolvedConfig | undefined;

	/** Resolves the project, input, output, and config paths lazily. */
	const resolveDirs = (): void => {
		if (flags.isEveryDirResolved) {
			return;
		}

		paths.projectDir = resolve(paths.viteRootDir ?? process.cwd());
		paths.inputDir = resolve(paths.projectDir, explicitInput ?? DEFAULT_INPUT_DIR);
		paths.outputDir = resolve(paths.projectDir, explicitOutput ?? DEFAULT_OUTPUT_DIR);

		paths.candidateConfigPaths = new Set(ELEVENTY_CONFIG_NAMES.map((name) => resolve(paths.projectDir, name)));

		paths.eleventyConfigPath = explicitConfigPath
			? resolve(paths.projectDir, explicitConfigPath)
			: detectConfigPath(paths.projectDir);

		flags.isEveryDirResolved = true;
	};

	/** Returns the absolute paths to the config files the watcher should track. */
	const getConfigWatchFiles = (): readonly FilePathAbs[] => {
		resolveDirs();

		return paths.eleventyConfigPath ? [paths.eleventyConfigPath] : [...paths.candidateConfigPaths];
	};

	/** Returns whether the absolute path matches any candidate config path. */
	const isKnownConfigPath = (filePath: FilePathAbs): boolean => {
		resolveDirs();

		return paths.candidateConfigPaths.has(filePath);
	};

	/** Returns the absolute output path Vite should use for the rendered page. */
	const toOutputPath = (page: RenderedPage): FilePathAbs => {
		resolveDirs();

		return resolve(paths.outputDir, page.outputRelativePath);
	};

	/** Transforms rendered page HTML through Vite's HTML pipeline. */
	const transformPageHtml = async (
		server: ViteDevServer,
		page: RenderedPage,
		originalUrl?: URLPath,
	): Promise<string> => {
		/** Represents the URL pathname for the given page. */
		const htmlPath = getHtmlTransformPath(page);

		// In build mode there is no `devHtmlHook`, so inline `<style>` blocks
		// are handled by Rollup's regular CSS pipeline through `resolveId` /
		// `load` against real (or our virtual) module ids.
		if (!flags.isDevMode || !resolvedConfig) {
			return await server.transformIndexHtml(htmlPath, page.content, originalUrl);
		}

		const html = preprocessInlineStyles(page.content, (index) => getInlineStylePath(page, index));

		return await server.transformIndexHtml(htmlPath, html, originalUrl ?? page.url);
	};

	/** Returns the output-relative path for the given module id. */
	const outputRelativeFromAbsolute = (id: ModuleId): FilePathRel | undefined => {
		if (!isAbsolute(id)) {
			return undefined;
		}

		resolveDirs();

		const rel = relative(paths.outputDir, id).split(sep).join("/");

		return rel.startsWith("..") ? undefined : rel;
	};

	/** Returns the absolute virtual CSS id for the given inline style block. */
	const toInlineStyleId = (outputRelativePath: FilePathRel, index: number): FilePathAbs => {
		resolveDirs();

		return resolve(paths.outputDir, `${outputRelativePath}${INLINE_STYLE_SUFFIX}${index}.css`);
	};

	/** Returns the internal inline style descriptor for the given resolved id, when matched. */
	const parseInlineStyleInternalId = (id: ModuleId): { outputRelativePath: FilePathRel; index: number } | undefined => {
		const cleanId = cleanModuleId(id);
		const outputRelativePath = outputRelativeFromAbsolute(cleanId);

		return outputRelativePath ? parseInlineStyleSuffix(outputRelativePath) : undefined;
	};

	/** Returns the output-relative path for the given absolute output path. */
	const normalizeOutputPath = (outputPath: FilePathAbs): FilePathRel => {
		resolveDirs();

		const normalizedOutputPath = outputPath.startsWith("./") ? outputPath.slice(2) : outputPath;
		const absoluteOutputPath = isAbsolute(normalizedOutputPath)
			? normalizedOutputPath
			: resolve(paths.projectDir, normalizedOutputPath);

		return relative(paths.outputDir, absoluteOutputPath).split(sep).join("/");
	};

	/** Maps an Eleventy JSON entry to a rendered page record. */
	const toPage = (entry: JSONMapEntry): RenderedPage => ({
		url: entry.url,
		inputPath: resolve(entry.inputPath),
		outputPath: entry.outputPath,
		outputRelativePath: normalizeOutputPath(entry.outputPath),
		content: entry.content,
		data: (entry.data ?? {}) as Readonly<Record<string, unknown>>,
	});

	/** Returns every URL pathname alias that should resolve to the given page. */
	const pageUrlAliases = (page: RenderedPage): readonly URLPath[] => {
		const aliases = new Set<URLPath>([page.url]);

		if (page.url.endsWith("/")) {
			aliases.add(`${page.url}index.html`);
			aliases.add(page.url.slice(0, -1) || "/");
		} else if (page.url.endsWith(".html")) {
			aliases.add(page.url.slice(0, -5));

			if (page.url.endsWith("/index.html")) {
				aliases.add(page.url.slice(0, -10));
				aliases.add(page.url.slice(0, -11) || "/");
			}
		}

		return [...aliases];
	};

	/** Adds the rendered page to the output-path and URL indexes. */
	const remember = (page: RenderedPage): void => {
		pageMaps.byOutputPath.set(page.outputRelativePath, page);

		for (const urlAlias of pageUrlAliases(page)) {
			pageMaps.byUrl.set(urlAlias, page);
		}
	};

	/** Removes the rendered page from the output-path and URL indexes. */
	const forget = (page: RenderedPage): void => {
		pageMaps.byOutputPath.delete(page.outputRelativePath);

		for (const urlAlias of pageUrlAliases(page)) {
			if (pageMaps.byUrl.get(urlAlias)?.outputRelativePath === page.outputRelativePath) {
				pageMaps.byUrl.delete(urlAlias);
			}
		}
	};

	/** Returns the rendered pages removed for the given absolute input path. */
	const forgetInput = (file: FilePathAbs): RenderedPage[] => {
		const inputPath = resolve(file);
		const removed = [...pageMaps.byOutputPath.values()].filter((page) => page.inputPath === inputPath);

		for (const page of removed) {
			forget(page);
		}

		return removed;
	};

	/** Logs a prefixed plugin error to Vite's logger. */
	const logError = (error: unknown, context: string): void => {
		logger?.error(`[vite-plugin-eleventy] ${context}: ${getErrorMessage(error)}`, {
			error: error instanceof Error ? error : undefined,
		});
	};

	/** Runs the given async operation under the plugin's exclusive queue. */
	const runExclusive = async <T>(fn: () => Promise<T>): Promise<T> => {
		const previous = queues.exclusiveOperation;

		let release = (): void => undefined;

		queues.exclusiveOperation = new Promise<void>((resolve) => {
			release = resolve;
		});

		await previous;

		try {
			return await fn();
		} finally {
			release();
		}
	};

	/** Creates and initializes a fresh Eleventy instance. */
	const createEleventy = async (): Promise<EleventyInstance> => {
		resolveDirs();

		/** Creates Eleventy with absolute input and output paths. */
		const instance = new Eleventy(paths.inputDir, paths.outputDir, {
			configPath: paths.eleventyConfigPath,
			quietMode,
			runMode: flags.isDevMode ? "serve" : "build",
			dryRun: true,
			config(eleventyConfig: { dataFilterSelectors: Set<string> }): void {
				for (const selector of dataFilterSelectors) {
					eleventyConfig.dataFilterSelectors.add(selector);
				}
			},
		});

		instance.setIncrementalBuild(flags.isDevMode || flags.isBuildWatchMode);

		await instance.init();

		// When the user hasn't pinned `output` via plugin options, defer to
		// Eleventy's resolved `outputDir`, which honors `dir.output` from
		// `eleventy.config.js`. Without this, our `outputDir` would stay at the
		// `_site` default and downstream path math (`toOutputPath`,
		// `outputRelativeFromAbsolute`) would compute against the wrong dir.
		if (!explicitOutput) {
			paths.outputDir = resolve(instance.outputDir);
		}

		return instance;
	};

	/** Returns the active Eleventy instance, creating it when needed. */
	const getEleventy = async (): Promise<EleventyInstance> => {
		if (eleventy) {
			return eleventy;
		}

		const version = flags.version;
		const instance = await createEleventy();

		if (version !== flags.version) {
			throw new StaleEleventyStateError();
		}

		eleventy = instance;

		return eleventy;
	};

	/** Invalidates the current Eleventy instance and rendered page indexes. */
	const resetEleventy = (): void => {
		// Eleventy 3.x exposes no general `close()` API and we never start its own
		// watch mode; Vite owns watching, so dropping references is sufficient.
		flags.version += 1;

		eleventy = undefined;

		pageMaps.byOutputPath.clear();
		pageMaps.byUrl.clear();
	};

	/** Reconciles the rendered page indexes with the latest rendered pages. */
	const reconcilePages = (pages: readonly RenderedPage[]): IncrementalRenderResult => {
		const previousPages = new Map(pageMaps.byOutputPath);
		const updated: RenderedPage[] = [];

		pageMaps.byOutputPath.clear();
		pageMaps.byUrl.clear();

		for (const page of pages) {
			const previous = previousPages.get(page.outputRelativePath);

			if (!previous || previous.content !== page.content || previous.url !== page.url) {
				updated.push(page);
			}

			previousPages.delete(page.outputRelativePath);

			remember(page);
		}

		return {
			updated,
			removed: [...previousPages.values()],
		};
	};

	/** Renders and returns the full set of Eleventy pages. */
	const renderAll = async (): Promise<readonly RenderedPage[]> => {
		const version = flags.version;

		try {
			const pages = (await (await getEleventy()).toJSON()).map(toPage);

			if (version !== flags.version) {
				return [...pageMaps.byOutputPath.values()];
			}

			reconcilePages(pages);

			return pages;
		} catch (error) {
			if (error instanceof StaleEleventyStateError) {
				return [...pageMaps.byOutputPath.values()];
			}

			throw error;
		}
	};

	/** Returns the incremental render result for the given absolute input path. */
	const renderIncremental = async (file: FilePathAbs): Promise<IncrementalRenderResult> => {
		const empty: IncrementalRenderResult = { updated: [], removed: [] };
		const version = flags.version;
		const instance = await getEleventy();

		instance.setIncrementalFile(file);

		try {
			// `toJSON()` with `setIncrementalFile()` re-renders only the targeted
			// file but still returns the full set, so reconcile the entire in-memory
			// page map to remove stale URLs/output aliases when a rerender moves a
			// page to a different permalink or output path.
			const pages = (await instance.toJSON()).map(toPage);

			return version === flags.version ? reconcilePages(pages) : empty;
		} catch (error) {
			if (error instanceof StaleEleventyStateError) {
				return empty;
			}

			throw error;
		} finally {
			instance.unsetIncrementalFile();
		}
	};

	/** Finds a rendered page by the URL pathname. */
	const findPageByUrl = (url: URLPath): RenderedPage | undefined => pageMaps.byUrl.get(normalizePageLookupUrl(url));

	/** Builds an entry-point map from the given rendered pages. */
	const createEntryPoints = (
		pages: readonly RenderedPage[],
		filter?: (page: RenderedPage) => boolean,
	): EleventyEntryOverride.EntryMap => {
		const entries: EleventyEntryOverride.EntryMap = {};

		for (const page of pages) {
			if (!filter || filter(page)) {
				const entryName = page.outputRelativePath.endsWith(HTML_ENTRY_SUFFIX)
					? page.outputRelativePath.slice(0, -HTML_ENTRY_SUFFIX.length)
					: page.outputRelativePath;

				entries[entryName] = toOutputPath(page);
			}
		}

		return entries;
	};

	/** Ensures the rendered page indexes have been populated. */
	const ensureRenderedPages = async (): Promise<void> => {
		if (pageMaps.byOutputPath.size === 0) {
			await renderAll();
		}
	};

	/** Triggers a full browser reload through the Vite dev server. */
	const reloadServer = (server: ViteDevServer): void => {
		server.ws.send({ type: "full-reload" });
	};

	/** Invalidates the module identified by the given module id. */
	const invalidateModuleById = (server: ViteDevServer, id: ModuleId): void => {
		const module = server.moduleGraph.getModuleById(id);

		if (module) {
			server.moduleGraph.invalidateModule(module);
		}
	};

	/** Invalidates every module derived from the given rendered page. */
	const invalidatePage = (server: ViteDevServer, page: RenderedPage): void => {
		invalidateModuleById(server, toOutputPath(page));
		invalidateModuleById(server, toPrefixId(page.outputRelativePath));

		for (let index = 0; index < getInlineStyleCount(page.content); index += 1) {
			invalidateModuleById(server, toInlineStyleId(page.outputRelativePath, index));
		}
	};

	/** Invalidates every module derived from the given rendered pages. */
	const invalidatePages = (server: ViteDevServer, pages: readonly RenderedPage[]): void => {
		for (const page of pages) {
			invalidatePage(server, page);
		}
	};

	/** Returns whether the given absolute path should be handled as an Eleventy input. */
	const isEleventyInput = (filePath: FilePathAbs): boolean => {
		resolveDirs();

		// Accept the resolved config and any candidate filename so that creating
		// a fresh `eleventy.config.*` triggers a reset before it has been
		// auto-detected.
		if (filePath === paths.eleventyConfigPath || isKnownConfigPath(filePath)) {
			return true;
		}

		const rel = relative(paths.inputDir, filePath);

		return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
	};

	/** Returns the pages removed before re-rendering the given absolute path. */
	const fullResetAndRender = async (file: FilePathAbs): Promise<RenderedPage[]> => {
		const removedPages = forgetInput(file);

		flags.isEveryDirResolved = false;

		resetEleventy();

		await renderAll();

		return removedPages;
	};

	/** Handles a change to the given absolute path and optionally forces a full reset. */
	const handleChange = async (server: ViteDevServer, filePath: FilePathAbs, fullReset: boolean): Promise<void> => {
		await runExclusive(async () => {
			if (fullReset) {
				const removedPages = await fullResetAndRender(filePath);

				invalidatePages(server, removedPages);

				reloadServer(server);

				return;
			}

			const instance = await getEleventy();

			if (instance.shouldTriggerConfigReset([filePath])) {
				const removedPages = await fullResetAndRender(filePath);

				invalidatePages(server, removedPages);

				reloadServer(server);

				return;
			}

			const { updated, removed } = await renderIncremental(filePath);

			invalidatePages(server, updated);
			invalidatePages(server, removed);

			if (updated.length > 0 || removed.length > 0) {
				reloadServer(server);
			}
		});
	};

	/** Returns the current set of rendered Eleventy pages. */
	const getRenderedPages = async (): Promise<readonly RenderedPage[]> =>
		runExclusive(async () => {
			await ensureRenderedPages();

			return [...pageMaps.byOutputPath.values()];
		});

	/** Finds and returns a rendered page by the given URL pathname. */
	const findRenderedPageByUrl = async (url: URLPath): Promise<RenderedPage | undefined> =>
		runExclusive(async () => {
			await ensureRenderedPages();

			return findPageByUrl(url);
		});

	/** Builds and returns a Rollup-compatible entry-point map. */
	const getEntryPoints = async (filter?: (page: RenderedPage) => boolean): Promise<EleventyEntryOverride.EntryMap> =>
		createEntryPoints(await getRenderedPages(), filter);

	const plugin: EleventyPlugin = {
		name: "vite-plugin-eleventy",
		enforce: "pre",

		async config(userConfig, env): Promise<UserConfig> {
			if (explicitDev === undefined) {
				flags.isDevMode = env.command === "serve";
			}

			if (userConfig.root) {
				paths.viteRootDir = resolve(userConfig.root);

				flags.isEveryDirResolved = false;
			}

			const overrides: UserConfig = {};

			if (userConfig.appType === undefined) {
				overrides.appType = "mpa";
			}

			// Skip auto-wiring when the user already supplied their own input map
			// (or function). Stomping on a user-provided value breaks composability
			// for projects that mix Eleventy pages with bespoke entry points.
			if (env.command === "build" && entriesOption !== false && userConfig.build?.rollupOptions?.input === undefined) {
				try {
					const pages = await getRenderedPages();
					const input = entriesOption(createEntryPoints(pages), pages);

					overrides.build = { rollupOptions: { input } };
				} catch (error) {
					// Defer fatal reporting to `buildStart`, where Vite reports
					// the error in build context with proper stack frames.
					logError(error, "failed to compute build entry points");
				}
			}

			return overrides;
		},

		configResolved(config): void {
			logger = config.logger;
			resolvedConfig = config;

			if (paths.viteRootDir === undefined) {
				paths.viteRootDir = config.root;

				flags.isEveryDirResolved = false;
			}
		},

		async buildStart(): Promise<void> {
			if (flags.isDevMode) {
				return;
			}

			try {
				// Honour `vite build --watch`. Eleventy's incremental flag is
				// fixed at construction, so update both this flag (consumed by
				// `createEleventy` next time it runs) and the existing
				// instance, if any.
				flags.isBuildWatchMode = this.meta?.watchMode === true;

				eleventy?.setIncrementalBuild(flags.isDevMode || flags.isBuildWatchMode);

				/** Primes the rendered-page cache when `config()` has not already done so. */
				const pages = await getRenderedPages();

				/** Collects watch files for rendered pages and candidate config files. */
				const watched = new Set<FilePathAbs>();

				for (const page of pages) {
					watched.add(page.inputPath);
				}

				for (const configFile of getConfigWatchFiles()) {
					watched.add(configFile);
				}

				for (const file of watched) {
					this.addWatchFile(file);
				}
			} catch (error) {
				this.error(getErrorMessage(error));
			}
		},

		async watchChange(id, change): Promise<void> {
			/** Normalized absolute path for the changed file. */
			const file = resolve(id);

			if (flags.isDevMode || !isEleventyInput(file)) {
				return;
			}

			try {
				await runExclusive(async () => {
					if (change.event !== "update") {
						await fullResetAndRender(file);

						return;
					}

					const instance = await getEleventy();

					if (instance.shouldTriggerConfigReset([file])) {
						await fullResetAndRender(file);

						return;
					}

					await renderIncremental(file);
				});
			} catch (error) {
				logError(error, `failed to update after ${file}`);
			}
		},

		resolveId(id): ModuleId | null {
			const inlineStyle = parseInlineStylePublicId(id);

			if (inlineStyle) {
				return withModuleIdSuffix(
					toInlineStyleId(inlineStyle.outputRelativePath, inlineStyle.index),
					getModuleIdSuffix(id),
				);
			}

			if (parseInlineStyleInternalId(id)) {
				return id;
			}

			if (isPublicId(id)) {
				return toInternalId(id);
			}

			if (isInternalId(id)) {
				return id;
			}

			const rel = outputRelativeFromAbsolute(id);

			return rel !== undefined && pageMaps.byOutputPath.has(rel) ? id : null;
		},

		load(id: ModuleId): string | null {
			const inlineStyle = parseInlineStyleInternalId(id);

			if (inlineStyle) {
				const page = pageMaps.byOutputPath.get(inlineStyle.outputRelativePath);
				const source = page ? getInlineStyleSource(page.content, inlineStyle.index) : undefined;

				return source ?? this.error(`No Eleventy inline style found for ${id}`);
			}

			if (isInternalId(id)) {
				const page = pageMaps.byOutputPath.get(id.slice(internalPrefix.length));

				return page ? page.content : this.error(`No Eleventy page found for ${id}`);
			}

			const rel = outputRelativeFromAbsolute(id);

			return rel !== undefined ? (pageMaps.byOutputPath.get(rel)?.content ?? null) : null;
		},

		async configureServer(server): Promise<() => void> {
			await getRenderedPages();

			resolveDirs();

			server.watcher.add(paths.inputDir);

			for (const configFile of getConfigWatchFiles()) {
				server.watcher.add(configFile);
			}

			/** Creates a watcher callback that forces a full reset for topology changes. */
			const onTopologyChange =
				(
					/** The verb used when reporting the topology change. */
					verb: string,
				) =>
				(
					/** The absolute path of the changed file. */
					file: FilePathAbs,
				): void => {
					if (!isEleventyInput(file)) {
						return;
					}

					void handleChange(server, file, true).catch((error: unknown) => {
						logError(error, `failed to update after ${verb} ${file}`);
						reloadServer(server);
					});
				};

			server.watcher.on("add", onTopologyChange("adding"));
			server.watcher.on("unlink", onTopologyChange("deleting"));

			// Returning a setup hook registers the middleware after Vite's internal
			// middlewares and after every other plugin's pre-middleware, so URL
			// rewrites by neighbouring plugins (e.g. fallback routing) run first.
			return () => {
				server.middlewares.use(serveRenderedPagesMiddleware(plugin, { server, logger }));
			};
		},

		async handleHotUpdate(ctx): Promise<void> {
			if (!isEleventyInput(ctx.file)) {
				return;
			}

			try {
				await handleChange(ctx.server, ctx.file, false);
			} catch (error) {
				logError(error, `failed to update after ${ctx.file}`);

				reloadServer(ctx.server);
			}
		},

		closeBundle(): void {
			resetEleventy();
		},

		getRenderedPages,
		findRenderedPageByUrl,
		getEntryPoints,
		getHtmlTransformPath,
		transformPageHtml,
	};

	return plugin;
};

/** Describes the pages added, changed, or removed by an incremental render. */
interface IncrementalRenderResult {
	/** The pages that were added or rerendered during the incremental pass. */
	readonly updated: readonly RenderedPage[];

	/** The pages that were removed from the previous render state. */
	readonly removed: readonly RenderedPage[];
}

// #endregion

// -----------------------------------------------------------------------------
// #region Internal Helpers
// -----------------------------------------------------------------------------

/** Returns the URL pathname Vite uses to transform the given page. */
const getHtmlTransformPath: EleventyPlugin["getHtmlTransformPath"] = (page: RenderedPage): URLPath =>
	`/${page.outputRelativePath}`;

/** Returns the public CSS URL Vite uses to process the given inline style block. */
const getInlineStylePath = (page: RenderedPage, index: number): URLPath =>
	`/${page.outputRelativePath}${INLINE_STYLE_SUFFIX}${index}.css`;

/** Returns the public inline style descriptor for the given request id, when matched. */
const parseInlineStylePublicId = (id: ModuleId): { outputRelativePath: FilePathRel; index: number } | undefined => {
	const cleanId = cleanModuleId(id);

	return cleanId.startsWith("/") ? parseInlineStyleSuffix(cleanId.slice(1)) : undefined;
};

/** Parses the inline-style suffix from the given output-relative path, when present. */
const parseInlineStyleSuffix = (path: string): { outputRelativePath: FilePathRel; index: number } | undefined => {
	const markerIndex = path.lastIndexOf(INLINE_STYLE_SUFFIX);

	if (markerIndex === -1 || !path.endsWith(".css")) {
		return undefined;
	}

	const indexText = path.slice(markerIndex + INLINE_STYLE_SUFFIX.length, -CSS_SUFFIX.length);
	const index = Number(indexText);

	if (!Number.isInteger(index) || index < 0) {
		return undefined;
	}

	return { outputRelativePath: path.slice(0, markerIndex), index };
};

/** Removes any query string or hash fragment from the module id. */
const cleanModuleId = (id: ModuleId): ModuleId => {
	const suffixIndex = id.search(/[?#]/u);

	return suffixIndex === -1 ? id : id.slice(0, suffixIndex);
};

/** Returns any query string or hash fragment from the module id. */
const getModuleIdSuffix = (id: ModuleId): string => {
	const suffixIndex = id.search(/[?#]/u);

	return suffixIndex === -1 ? "" : id.slice(suffixIndex);
};

/** Re-attaches a module-id query/hash suffix after resolution. */
const withModuleIdSuffix = (id: ModuleId, suffix: string): ModuleId => `${id}${suffix}`;

/** Normalizes a page lookup URL pathname by removing any query string. */
const normalizePageLookupUrl = (url: URLPath): URLPath => {
	const queryIndex = url.indexOf("?");

	return (queryIndex === -1 ? url : url.slice(0, queryIndex)) || "/";
};

/** Returns the first existing Eleventy config file in resolution order. */
const detectConfigPath = (
	/** The absolute path to the project root. */
	projectDir: FilePathAbs,
): FilePathAbs | undefined => {
	for (const name of ELEVENTY_CONFIG_NAMES) {
		const candidate = resolve(projectDir, name);

		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return undefined;
};

const CSS_SUFFIX = ".css";
const INLINE_STYLE_SUFFIX = ".__eleventy_inline_style_";
const defaultEntriesOption = (defaults: EleventyEntryOverride.EntryMap): EleventyEntryOverride.EntryMap => defaults;

// #endregion

// -----------------------------------------------------------------------------
// #region Internal Constants
// -----------------------------------------------------------------------------

/** Default virtual module prefix for rendered Eleventy pages. */
const DEFAULT_VIRTUAL_PREFIX = "virtual:eleventy/";

/** Default Eleventy input directory. */
const DEFAULT_INPUT_DIR = ".";

/** Default Eleventy output directory. */
const DEFAULT_OUTPUT_DIR = "_site";

/** Lists the supported Eleventy config filenames in resolution order. */
const ELEVENTY_CONFIG_NAMES: readonly string[] = [
	"eleventy.config.js",
	"eleventy.config.mjs",
	"eleventy.config.cjs",
	"eleventy.config.ts",
	".eleventy.js",
	".eleventy.mjs",
	".eleventy.cjs",
];

/** Null-byte prefix used for Vite internal module ids. */
const NULL_BYTE = "\0";

/** HTML file suffix used when deriving entry names from output paths. */
const HTML_ENTRY_SUFFIX = ".html";

// #endregion

// -----------------------------------------------------------------------------
// #region Internal Types
// -----------------------------------------------------------------------------

/** Represents an Eleventy instance created and managed by the plugin. */
type EleventyInstance = InstanceType<typeof Eleventy>;

// #endregion
