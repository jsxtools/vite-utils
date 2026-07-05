/** Signals that Eleventy state changed while a render was in flight. */
export class StaleEleventyStateError extends Error {
	constructor() {
		super("Eleventy state changed during an in-flight render.");
	}
}

/** Returns a string form of an error, preferring the stack trace. */
export const getErrorMessage = (error: unknown): string =>
	error instanceof Error ? (error.stack ?? error.message) : String(error);
