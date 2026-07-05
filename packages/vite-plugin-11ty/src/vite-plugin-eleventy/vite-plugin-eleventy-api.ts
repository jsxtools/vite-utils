import type { Plugin, ViteDevServer } from "vite";

/** Absolute or relative file system path. */
export type FilePath = string;

/** Absolute file system path. */
export type FilePathAbs = string;

/** Relative file system path. */
export type FilePathRel = string;

/** Rollup or Vite module identifier. */
export type ModuleId = string;

/** Represents a URL or URL pathname. */
export type URLPath = string;

/** Describes the page-rendering API exposed by the Eleventy plugin. */
export interface EleventyPageRenderer {
	/**
	 * Finds and returns a rendered page by URL.
	 *
	 * Matching is performed against the same URL variants the dev server serves,
	 * including canonical URLs, trailing-slash forms, `index.html` aliases, and
	 * URLs with query strings.
	 */
	findRenderedPageByUrl(
		/** URL pathname that Vite's dev pipeline uses to address a page. */
		url: URLPath,
	): Promise<RenderedPage | undefined>;

	/**
	 * Transforms rendered page HTML through Vite's HTML pipeline and returns the
	 * transformed HTML.
	 *
	 * In development, eligible inline `<style>` blocks are externalized to
	 * page-scoped virtual stylesheets before calling `server.transformIndexHtml()`
	 * so Vite can process them through its normal CSS pipeline.
	 */
	transformPageHtml(server: ViteDevServer, page: RenderedPage, originalUrl?: URLPath): Promise<string>;
}

/** Extends Vite's plugin interface with Eleventy-specific runtime helpers. */
export interface EleventyPlugin extends Plugin, EleventyPageRenderer {
	/**
	 * Returns the current set of rendered Eleventy pages known to the plugin.
	 *
	 * The result is produced from the plugin's in-memory render cache. If the
	 * cache has not been populated yet, the plugin renders Eleventy first.
	 */
	getRenderedPages(): Promise<readonly RenderedPage[]>;

	/**
	 * Builds and returns a Rollup-compatible input map from the current rendered
	 * pages.
	 *
	 * Each entry key is the page's output-relative path without its `.html`
	 * suffix, and each value is the absolute output path Vite should treat as the
	 * HTML entry module.
	 */
	getEntryPoints(filter?: (page: RenderedPage) => boolean): Promise<EleventyEntryOverride.EntryMap>;

	/**
	 * Returns the URL pathname Vite uses to transform the given page.
	 *
	 * This is the path passed to Vite's HTML pipeline when applying
	 * `transformIndexHtml`, such as `/index.html` or `/about/index.html`.
	 */
	getHtmlTransformPath(page: RenderedPage): URLPath;
}

/** Configures how the plugin resolves Eleventy input, output, and build entries. */
export interface EleventyPluginOptions {
	/**
	 * Sets the Eleventy input directory.
	 *
	 * Defaults to `"."` (Eleventy's default) and is resolved relative to Vite's
	 * project root.
	 */
	readonly input?: FilePath;

	/**
	 * Sets the Eleventy output directory.
	 *
	 * Defaults to `"_site"` and is resolved relative to Vite's project root.
	 */
	readonly output?: FilePath;

	/**
	 * Sets the path to a custom Eleventy config file.
	 *
	 * When omitted, the plugin searches Vite's project root for
	 * `eleventy.config.{js,mjs,cjs,ts}` and `.eleventy.{js,mjs,cjs}`.
	 */
	readonly configPath?: FilePath;

	/**
	 * Limits which data properties Eleventy exposes to templates.
	 *
	 * Each selector is forwarded to Eleventy's `dataFilterSelectors` option.
	 */
	readonly dataFilterSelectors?: readonly string[];

	/**
	 * Suppresses Eleventy console output.
	 *
	 * Defaults to `true`.
	 */
	readonly quietMode?: boolean;

	/**
	 * Sets the virtual module prefix used for rendered page ids.
	 *
	 * Defaults to `virtual:eleventy/`.
	 */
	readonly virtualPrefix?: string;

	/**
	 * Overrides the dev/build mode auto-detected from Vite's `command`.
	 *
	 * This is rarely needed outside tests or non-Vite consumers.
	 */
	readonly dev?: boolean;

	/**
	 * Customizes how `build.rollupOptions.input` is generated during `vite build`.
	 *
	 * Pass a function to transform the default entry map, or `false` to disable
	 * auto-wiring entirely. Defaults to the identity mapping.
	 */
	readonly entries?: EleventyEntryOverride;
}

/** Describes a page rendered by Eleventy and tracked by the plugin. */
export interface RenderedPage {
	/** The URL pathname Eleventy generated for the page. */
	readonly url: URLPath;

	/** The absolute path to the source file that produced the page. */
	readonly inputPath: FilePathAbs;

	/** The absolute output path Eleventy assigned to the page. */
	readonly outputPath: FilePathAbs;

	/** The page output path relative to the resolved output directory. */
	readonly outputRelativePath: FilePathRel;

	/** The rendered HTML content for the page. */
	readonly content: string;

	/** The data Eleventy exposed while rendering the page. */
	readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Controls how the plugin generates `build.rollupOptions.input` during
 * `vite build`.
 *
 * Set to `false` to disable auto-wiring, or provide a function to transform
 * the default entry map before it is passed to Vite.
 */
export type EleventyEntryOverride = false | EleventyEntryOverride.Callback;

/** Provides helper types for {@link EleventyEntryOverride}. */
export namespace EleventyEntryOverride {
	/** Maps entry point names to absolute output paths. */
	export interface EntryMap {
		[entryPointName: string]: FilePathAbs;
	}

	/**
	 * Transforms the default build entry map generated from the current
	 * rendered pages.
	 */
	export interface Callback {
		(
			/**
			 * The default entry map generated from the current rendered pages.
			 *
			 * Each key is the page output-relative path without its `.html`
			 * suffix, and each value is the absolute output path Vite should
			 * use as an HTML entry.
			 */
			defaults: EntryMap,

			/**
			 * The rendered pages used to produce the default entry map.
			 *
			 * Use this to filter, rename, or regroup entries before returning
			 * the final input record.
			 */
			pages: readonly RenderedPage[],
		): EntryMap;
	}
}
