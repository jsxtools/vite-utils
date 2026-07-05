import type { URLPath } from "./vite-plugin-eleventy-api.js";

/**
 * Replaces eligible inline `<style>` blocks with page-scoped stylesheet links.
 * Vite can then process those virtual CSS files through its normal CSS
 * pipeline before the HTML is returned to the browser.
 */
export const preprocessInlineStyles = (
	/** The rendered page HTML to preprocess. */
	html: string,

	/** Returns the virtual stylesheet URL for the given inline style index. */
	getStyleUrl: (index: number) => URLPath,
): string => {
	const styles = collectInlineStyles(html);

	if (styles.length === 0) {
		return html;
	}

	let result = "";
	let cursor = 0;

	for (const { start, end, index, attrs } of styles) {
		result += html.slice(cursor, start) + `<link rel="stylesheet" href="${getStyleUrl(index)}"${attrs}>`;
		cursor = end;
	}

	result += html.slice(cursor);

	return result;
};

/** Returns the inline CSS source at the given eligible style index. */
export const getInlineStyleSource = (
	/** The rendered page HTML to inspect. */
	html: string,

	/** Eligible plain-CSS style index within the page. */
	index: number,
): string | undefined => collectInlineStyles(html)[index]?.source;

/** Returns the number of eligible inline plain-CSS style blocks in the HTML. */
export const getInlineStyleCount = (
	/** The rendered page HTML to inspect. */
	html: string,
): number => collectInlineStyles(html).length;

// -----------------------------------------------------------------------------
// #region Internals
// -----------------------------------------------------------------------------

interface InlineStyleMatch {
	readonly index: number;
	readonly start: number;
	readonly end: number;
	readonly attrs: string;
	readonly source: string;
}

const collectInlineStyles = (html: string): readonly InlineStyleMatch[] => {
	const styles: InlineStyleMatch[] = [];
	let index = 0;

	for (const match of html.matchAll(STYLE_BLOCK_RE)) {
		const [full, attrs = "", source = ""] = match;
		const start = match.index ?? 0;

		if (!source.trim() || !isPlainCSSStyle(attrs)) {
			continue;
		}

		styles.push({ index, start, end: start + full.length, attrs, source });
		index += 1;
	}

	return styles;
};

const isPlainCSSStyle = (attrs: string): boolean => {
	for (const match of attrs.matchAll(STYLE_OPTS_OUT_RE)) {
		const value = (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();

		if (value && value !== "css" && value !== "text/css") {
			return false;
		}
	}

	return true;
};

// Matches `<style>...</style>` blocks. Skips elements that opt into a non-CSS
// language via `lang=` or `type=` (for example `<style lang="scss">` or
// `<style type="text/x-template">`). Plain `type="text/css"` is allowed.
const STYLE_OPTS_OUT_RE = /\b(?:lang|type)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const STYLE_BLOCK_RE = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
