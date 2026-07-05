# @jsxtools/vite-plugin-11ty

A [Vite] plugin that renders [Eleventy] pages in memory and lets Vite serve and
bundle them like regular HTML entry points.

In `vite serve`, changes to Eleventy inputs or config trigger an incremental
Eleventy rerender and a full browser reload. In `vite build`, rendered pages
become Vite build entries. In `vite build --watch`, Rollup watches Eleventy
inputs and rerenders them before rebuilding.

## Install

```sh
npm install --save-dev @jsxtools/vite-plugin-11ty @11ty/eleventy
```

`@11ty/eleventy` and `vite` 8 or newer are peer dependencies. Install them in
the same project as this plugin.

## Usage

```ts
import { defineConfig } from "vite";
import { eleventyPlugin } from "@jsxtools/vite-plugin-11ty";

export default defineConfig({
	plugins: [eleventyPlugin({ input: "src/site" })],
});
```

The plugin auto-detects `vite serve` vs `vite build`, wires rendered pages into
`build.rollupOptions.input`, and defaults `appType` to `"mpa"` so Vite's SPA
fallback does not intercept Eleventy URLs.

## Options

| Option                | Type                                     | Description                                                                                                                                                               |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`               | `string`                                 | Sets the Eleventy input directory. Defaults to `"."` (Eleventy's default) and is resolved relative to Vite's project root.                                                |
| `output`              | `string`                                 | Sets the Eleventy output directory. Defaults to `"_site"` and is resolved relative to Vite's project root.                                                                |
| `configPath`          | `string`                                 | Sets the path to a custom Eleventy config file. When omitted, the plugin searches Vite's project root for `eleventy.config.{js,mjs,cjs,ts}` and `.eleventy.{js,mjs,cjs}`. |
| `dataFilterSelectors` | `readonly string[]`                      | Limits which data properties Eleventy exposes to templates. Each selector is forwarded to Eleventy's `dataFilterSelectors` option.                                        |
| `quietMode`           | `boolean`                                | Suppresses Eleventy console output. Defaults to `true`.                                                                                                                   |
| `virtualPrefix`       | `string`                                 | Sets the virtual module prefix used for rendered page ids. Defaults to `virtual:eleventy/`.                                                                               |
| `dev`                 | `boolean`                                | Overrides the dev/build mode auto-detected from Vite's `command`. Rarely needed outside tests or non-Vite consumers.                                                      |
| `entries`             | `false \| (defaults, pages) => entryMap` | Customizes how `build.rollupOptions.input` is generated during `vite build`. Pass `false` to disable auto-wiring, or a function to transform the default entry map.       |

### Customizing build entries

Pass `entries` to override or augment the default build entry map:

```ts
eleventyPlugin({
	input: "src/site",
	entries: (defaults, pages) => {
		// Skip drafts and rename the home page key
		const { index, ...rest } = defaults;
		const filtered = Object.fromEntries(Object.entries(rest).filter(([, p]) => !p.includes("/drafts/")));
		return { home: index, ...filtered };
	},
});
```

Pass `entries: false` to disable auto-wiring entirely and call
`getEntryPoints()` yourself.

## Plugin API

The returned object is a Vite `Plugin` with these extra methods:

- `getRenderedPages()` — resolves with all currently rendered Eleventy pages.
- `findRenderedPageByUrl(url)` — resolves with the page matching `url`,
  including trailing-slash, `index.html`, and query-string variants.
- `getEntryPoints(filter?)` — resolves with a `Record<string, string>` suitable
  for `rollupOptions.input`, mapping each page's output-relative path without
  `.html` to an absolute path under the Eleventy output directory.
- `getHtmlTransformPath(page)` — returns the URL-form HTML path Vite uses when
  transforming a rendered page.
- `transformPageHtml(server, page, originalUrl?)` — runs rendered page HTML
  through Vite's HTML pipeline and returns the transformed HTML.

## `serveRenderedPagesMiddleware`

The middleware used by the dev server is also exposed as a standalone factory,
so you can mount it on any Connect-style app:

```ts
import express from "express";
import { eleventyPlugin, serveRenderedPagesMiddleware } from "@jsxtools/vite-plugin-11ty";

const eleventy = eleventyPlugin({ input: "src/site" });
const app = express();
app.use(serveRenderedPagesMiddleware(eleventy));
```

Pass a `ViteDevServer` via `{ server }` to run rendered HTML through Vite's
`transformIndexHtml`, which injects the dev client and runs other plugins'
HTML transforms. The plugin's own `configureServer` hook does this
automatically.

## How it works

The plugin asks Eleventy for rendered pages via `toJSON()` and indexes them by
URL and output path. Vite's resolve/load hooks recognize both the absolute
output path and a `virtual:eleventy/<output-path>` specifier, then return the
rendered HTML so Vite's HTML pipeline can take over.

In `serve` mode the plugin attaches to Vite's watcher, runs an incremental
Eleventy rebuild for the changed file, invalidates the relevant modules in
Vite's module graph, and triggers a full reload. Vite's own HMR still handles
`.ts` and `.css` changes within the page, so the SSG pass does not stomp on
faster client-side updates.

## License

MIT-0

[Vite]: https://vite.dev
[Eleventy]: https://www.11ty.dev
