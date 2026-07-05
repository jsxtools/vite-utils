import { describe, expect, it } from "vitest";
import { vitePolyfiller } from "../src/vite-plugin-polyfiller.js";

describe("performance", () => {
	const plugin = vitePolyfiller();
	const transform = plugin.transform as (code: string, id: string) => unknown;

	// Sample code snippets of varying sizes
	const smallCode = `const x = Symbol.dispose;`;
	const smallCodeNoMatch = `const x = Symbol.iterator;`;

	const mediumCode = `
		import { something } from 'somewhere';

		export class ResourceManager {
			constructor() {
				this.resources = new Map();
			}

			acquire(name) {
				const resource = { name, [Symbol.dispose]() { console.log('disposed'); } };
				this.resources.set(name, resource);
				return resource;
			}

			release(name) {
				const resource = this.resources.get(name);
				if (resource) {
					resource[Symbol.dispose]();
					this.resources.delete(name);
				}
			}
		}
	`;

	const largeCode = `
		import { something } from 'somewhere';
		${Array.from(
			{ length: 100 },
			(_, i) => `
			export class ResourceManager${i} {
				constructor() {
					this.resources = new Map();
				}

				acquire(name) {
					const resource = { name, [Symbol.dispose]() { console.log('disposed'); } };
					this.resources.set(name, resource);
					return resource;
				}

				release(name) {
					const resource = this.resources.get(name);
					if (resource) {
						resource[Symbol.dispose]();
						this.resources.delete(name);
					}
				}
			}
		`,
		).join("\n")}
	`;

	const largeCodeNoMatch = `
		import { something } from 'somewhere';
		${Array.from(
			{ length: 100 },
			(_, i) => `
			export function process${i}(data) {
				return data.map(x => x * 2).filter(x => x > 10).reduce((a, b) => a + b, 0);
			}
		`,
		).join("\n")}
	`;

	it("handles small files quickly", () => {
		const iterations = 1000;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(smallCode, "/src/file.js");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Small file (match): ${perFile.toFixed(3)}ms per file`);
		expect(perFile).toBeLessThan(1); // Should be < 1ms per file
	});

	it("handles small files without match quickly", () => {
		const iterations = 1000;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(smallCodeNoMatch, "/src/file.js");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Small file (no match): ${perFile.toFixed(3)}ms per file`);
		expect(perFile).toBeLessThan(1);
	});

	it("handles medium files efficiently", () => {
		const iterations = 500;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(mediumCode, "/src/file.js");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Medium file (~500 chars): ${perFile.toFixed(3)}ms per file`);
		expect(perFile).toBeLessThan(2);
	});

	it("handles large files reasonably", () => {
		const iterations = 50;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(largeCode, "/src/file.js");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Large file (~50KB): ${perFile.toFixed(3)}ms per file`);
		expect(perFile).toBeLessThan(50); // Large files take longer
	});

	it("handles large files without match", () => {
		const iterations = 50;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(largeCodeNoMatch, "/src/file.js");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Large file no match (~50KB): ${perFile.toFixed(3)}ms per file`);
		expect(perFile).toBeLessThan(50);
	});

	it("skips non-JS files instantly", () => {
		const iterations = 10000;
		const start = performance.now();

		for (let i = 0; i < iterations; i++) {
			transform(largeCode, "/src/styles.css");
		}

		const elapsed = performance.now() - start;
		const perFile = elapsed / iterations;

		console.log(`Non-JS file skip: ${perFile.toFixed(4)}ms per file`);
		expect(perFile).toBeLessThan(0.01); // Should be nearly instant
	});
});
