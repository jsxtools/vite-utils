# vite-utils

Vite plugins and utilities published under the `@jsxtools` scope.

## Packages

| Package                                                                 | Description                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`@jsxtools/vite-plugin-polyfiller`](./packages/vite-plugin-polyfiller) | Detects polyfillable language features in source files and injects the runtime only when needed. |
| [`@jsxtools/vite-plugin-11ty`](./packages/vite-plugin-11ty)             | Integrates the [Eleventy] static site generator into a Vite-driven build.                        |

## Development

This repo uses npm workspaces. From the root:

```sh
npm install           # install all workspace dependencies
npm test              # run tests across all workspaces
npm run build         # build every workspace
npm run typecheck     # run the root TypeScript check
npm run lint          # run Biome checks
npm run format        # format the repo with dprint
npm run format:check  # verify formatting without writing changes
```

Run a script for one package with:

```sh
npm run <script> --workspace @jsxtools/<package-name>
```

## License

MIT-0

[Vite]: https://vite.dev
[Eleventy]: https://www.11ty.dev
