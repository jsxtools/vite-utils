declare module "@11ty/eleventy" {
	// -----------------------------------------------------------------------------
	// Classes
	// -----------------------------------------------------------------------------

	export declare class Eleventy extends Core {
		static getHelp(): string;

		constructor(input: string, output: string, options: EleventyOptions = {}, eleventyConfig: TemplateConfig = null);

		close(): Promise<boolean>;
		getHelp(): string;
		getWatchedFiles(): void;
		getWatchedTargets(): Promise<{ targets: string[]; ignores: string[] }>;
		init(options?: {}): Promise<void>;
		initializeConfig(initOverrides: object): Promise<void>;
		initWatch(): void;
		resetConfig(): Promise<void>;
		serve(port: number): Promise<unknown>;
		setIncrementalBuild(isIncremental: boolean): void;
		shouldTriggerConfigReset(changedFiles: string[]): boolean;
		startWatch(): Promise<(path: string) => Promise<void>>;
		stopWatch(): Promise<boolean>;
		watch(): Promise<(path: string) => Promise<void>>;

		readonly watcherBench: unknown;
		readonly watchQueue: unknown;
	}

	export declare class Core extends MinimalCore {
		init(options?: object): Promise<void>;
		initializeConfig(initOverrides: object): Promise<void>;
		restart(): Promise<void>;

		fileSystemSearch: FileSystemSearch;
	}

	export declare class MinimalCore {
		static getVersion(): string;

		constructor(
			options?: {
				input?: string;
				output?: string;
			},
			eleventyConfig?: TemplateConfig,
		);
		constructor(input: string, output: string, options?: {}, eleventyConfig?: TemplateConfig);

		buildCount: number;
		config: Config;
		eleventyConfig: TemplateConfig;
		env: EnvironmentVariableValues;
		isDryRun: boolean;
		isIncremental: boolean;
		isRunInitialBuild: boolean;
		loader: Loader;
		logger: unknown;
		options: {};
		programmaticApiIncrementalFile: string | undefined;
		rawInput: string | undefined;
		rawOutput: string | undefined;
		runMode: RunMode;
		source: Source;
		start: number;
		verboseMode: boolean;
		writer: TemplateWriter;

		readonly configPath: string | undefined;
		readonly directories: ProjectDirectories;
		readonly errorHandler: unknown;
		readonly input: string;
		readonly inputDir: string;
		readonly inputFile: string;
		readonly isEsm: boolean;
		readonly outputDir: string;
		readonly pathPrefix: string;
		readonly projectPackageJson: unknown;
		readonly projectPackageJsonPath: string | false;
		readonly templateFormats: ProjectTemplateFormats;

		disableLogger(): void;
		executeBuild(to?: OutputFormat): Promise<unknown[]>;
		getEnvironmentVariableValues(): EnvironmentVariableValues;
		getNewTimestamp(): number;
		init(options?: {}): Promise<void>;
		initializeConfig(initOverrides: object): Promise<void>;
		initializeEnvironmentVariables(env: UserEnvironmentVariableValues): void;
		logFinished(): string;
		resetConfig(): Promise<void>;
		restart(): void;
		setDryRun(isDryRun: boolean): void;
		setFormats(formats: string | string[]): void;
		setIgnoreInitial(ignoreInitialBuild: boolean): void;
		setIncrementalBuild(isIncremental: boolean): void;
		setIncrementalFile(incrementalFile: string): void;
		setInputDir(): void;
		setIsVerbose(isVerbose: boolean): void;
		setPathPrefix(pathPrefix: string): void;
		setRunMode(runMode: RunMode): void;
		toJSON(): Promise<JSONMapEntry[]>;
		unsetIncrementalFile(): void;
		write(subtype: string): Promise<unknown[]>;
	}

	export declare class ProjectTemplateFormats {
		static union(...sets: Set<string>[]): Set<string>;

		addViaConfig(formats: string | string[]): void;
		getAllTemplateFormats(): string[];
		getTemplateFormats(): string[];
		isWildcard(): boolean;
		setViaCommandLine(formats: string | string[]): void;
		setViaConfig(formats: string | string[]): void;
	}

	export declare class TemplateWriter {
		constructor(templateFormats: ProjectTemplateFormats, templateData: TemplateData, templateConfig: TemplateConfig);

		generateTemplates(paths: string[], to?: OutputFormat): Promise<Promise<JSONMapEntry[]>[]>;
		getFileShape(paths: string[], incrementalFile: string): FileShape | undefined;
		getJSON(to: OutputFormat): Promise<{ templates: JSONMapEntry[] }>;
		getMetadata(): unknown;
		getPassthroughGlobs(): unknown;
		getPathsWithVirtualTemplates(paths: string[]): unknown;
		resetIncrementalFile(): void;
		setDryRun(isDryRun: boolean): void;
		setEleventyFiles(eleventyFiles: EleventyFiles): void;
		setIncrementalBuild(isIncremental: boolean): void;
		setIncrementalFile(incrementalFile: string): void;
		setPassthroughManager(passthroughManager: TemplatePassthroughManager): void;
		setRunInitialBuild(runInitialBuild: boolean): void;
		setVerboseOutput(isVerbose: boolean): void;
		write(): Promise<WriteResult>;
		writePassthroughCopy(templateExtensionPaths: unknown): Promise<{ count: number; map: EleventyMap }[]>;
		writeTemplates(): Promise<JSONMapEntry[]>;

		readonly caches: string[];
		readonly dirs: TemplateConfig;

		templateMap: TemplateMap;
	}

	export declare class TemplateConfig {
		constructor(customRootConfig: unknown, projectConfigPath?: string);

		appendToRootConfig(obj: unknown): void;
		forceReloadConfig(): Promise<void>;
		getConfig(): unknown;
		getIsProjectUsingEsm(): boolean;
		getLocalProjectConfigFile(): string | undefined;
		getLocalProjectConfigFiles(): string[];
		getPathPrefix(): string | undefined;
		getPreviousBuildModifiedFile(): string | undefined;
		hasInitialized(): boolean;
		init(overrides: unknown): Promise<void>;
		initializeRootConfig(): Promise<void>;
		mergeConfig(): Promise<unknown>;
		processPlugins(options: { dir: string; pathPrefix: string }): Promise<void>;
		requireLocalConfigFile(): Promise<{ localConfig: unknown; exportedConfig: unknown }>;
		reset(): Promise<void>;
		resetOnWatch(): void;
		setDirectories(directories: ProjectDirectories): void;
		setLogger(logger: unknown): void;
		setPathPrefix(pathPrefix: string): void;
		setPreviousBuildModifiedFile(inputPath: string, metadata?: {}): void;
		setProjectConfigPath(path: string): Promise<void>;
		setProjectUsingEsm(isEsmProject: boolean): void;
		setRunMode(runMode: RunMode): void;
		setTemplateFormats(templateFormats: ProjectTemplateFormats): void;
		shouldSpiderJavaScriptDependencies(): boolean;

		readonly uses: GlobalDependencyMap;
		readonly usesGraph: boolean;
		readonly aggregateBenchmark: unknown;
		readonly inputDir: string;
		readonly templateFormats: ProjectTemplateFormats;
		readonly userConfig: UserConfig;
		readonly existsCache: ExistsCache;

		config: Config;
		directories: ProjectDirectories;
	}

	export declare class ProjectDirectories implements Readonly<Partial<UserspaceInstance>> {
		static normalizePath(fileOrDir: string): string;
		static normalizeDirectory(fileOrDir: string): string;
		static addTrailingSlash(path: string): string;
		static getRelativeTo(targetPath: string, cwd: string): string;

		static defaults: {
			input: "./";
			data: "./_data/"; // Relative to input directory
			includes: "./_includes/"; // Relative to input directory
			layouts: "./_layouts/"; // Relative to input directory
			output: "./_site/";
		};

		freeze(): void;
		getInputPath(filePathRelativeToInputDir: string): string;
		getInputPathRelativeToInputDirectory(filePathRelativeToInputDir: string): string;
		getLayoutPath(filePathRelativeToLayoutDir: string): string;
		getLayoutPathRelativeToInputDirectory(filePathRelativeToLayoutDir: string): string;
		getProjectPath(filePath: string): string;
		getUserspaceInstance(): Readonly<UserspaceInstance>;
		isFileInOutputFolder(filePath: string): boolean;
		isFileInProjectFolder(filePath: string): boolean;
		isTemplateFile(filePath: string): boolean;
		normalizeDirectoryPathRelativeToInputDirectory(filePath: string): string;
		setData(dir: string): void;
		setIncludes(dir: string): void;
		setInputDir(dir: string, inputDir?: string): void;
		setLayouts(dir: string): void;
		setOutput(dir: string): void;
		setViaConfigObject(configDirs: unknown): void;
		toString(): UserspaceInstance;
		updateInputDependencies(): void;

		inputFile: string | undefined;
		inputGlob: string | undefined;

		readonly input: string | undefined;
		readonly data: string | undefined;
		readonly includes: string | undefined;
		readonly layouts: string | undefined;
		readonly output: string | undefined;
	}

	export declare class GlobalDependencyMap {}

	export declare class ExistsCache {}

	export declare class TemplatePassthroughManager {
		constructor(templateConfig: TemplateConfig);

		copyAll(templateExtensionPaths: string[]): Promise<unknown[]>;
		copyPassthrough(): Promise<unknown[]>;
		enqueueCopy(source: string, target: string, copyOptions: unknown): void;
		getAliasesFromPassthroughResults(results: unknown[]): Record<string, string>;
		getAllNormalizedPaths(paths?: string[]): string[];
		getConfigPathGlobs(): string[];
		getConfigPaths(): string[];
		getCopyCount(): number;
		getCopySize(): number;
		getMetadata(): { getMetadata: number; copySize: number };
		getNonTemplatePaths(): string[];
		getTemplatePassthroughForPath(path: string): TemplatePassthrough;
		isPassthroughCopyFile(paths: string[], changedFile: string): boolean;
		reset(): void;
		resetIncrementalFile(): void;
		setDryRun(isDryRun: boolean): void;
		setFileSystemSearch(fileSystemSearch: unknown): void;
		setIncrementalFile(path: string): void;
		setRunMode(runMode: RunMode): void;

		readonly inputDir: string | undefined;
		readonly outputDir: string | undefined;

		extensionMap: EleventyExtensionMap;
		templateConfig: TemplateConfig;
		config: Config;
	}

	export declare class TemplatePassthrough {}

	export declare class EleventyExtensionMap {}

	export declare class EleventyFiles {
		static getFileIgnores(): string[];
		static normalizeIgnoreContent(dir: string, ignoreContent: string): string;

		constructor(formats: string | string[], templateConfig: TemplateConfig);

		getDataDir(): string;
		getFileGlobs(): string[];
		getFiles(): Promise<string[]>;
		getFileShape(paths: string[], filePath: string): FileShape | undefined;
		getGlobWatcherFiles(): Promise<string[]>;
		getIgnoreFiles(): string[];
		getIgnoreGlobs(): string[];
		getIgnores(): string[];
		getIncludesDir(): string;
		getLayoutsDir(): string;
		getRawFiles(): string[];
		getWatchPathCache(): Promise<string[]>;
		init(): void;
		isFullTemplateFile(paths: string[], filePath: string): boolean;
		isPassthroughCopyFile(paths: string[], filePath: string): boolean;
		normalizeIgnoreEntry(entry: string): string;
		restart(): void;
		setFileSystemSearch(fileSystemSearch: unknown): void;
		setPassthroughManager(passthroughManager: TemplatePassthroughManager): void;
		setRunMode(runMode: RunMode): void;
		setupGlobs(): void;

		readonly passthroughGlobs: string[];
		readonly dirs: ProjectDirectories;
		readonly inputDir: string;
		readonly outputDir: string;
		readonly includesDir: string;
		readonly layoutsDir: string;
		readonly dataDir: string;

		extensionMap: EleventyExtensionMap;
		templateData: unknown;
		templateGlobs: TemplateGlob;
	}

	export declare class TemplateGlob {}

	export declare class TemplateData {
		static calculateExtensionPriority(path: string, priorities: unknown): number;
		static cleanupData(data: object, options?: unknown): object;
		static getCleanedTagsImmutable(data: object, options?: unknown): string[];
		static getIncludedCollectionNames(data: object): string[];
		static getIncludedTagNames(data: object): string[];
		static getNormalizedExcludedCollections(data: object): { excludes: string[]; excludeAll: boolean };
		static merge(target: object, ...source: object[]): object;
		static mergeDeep(deepMerge: boolean, target: object, ...source: object[]): object;

		constructor(templateConfig: TemplateConfig);

		clearData(): void;
		combineLocalData(localDataPaths: string[]): Promise<unknown>;
		exists(pathname: string): boolean;
		getAllGlobalData(): Promise<unknown>;
		getDataDir(): string;
		getDataFileSuffixes(): string[];
		getDataValue(path: string): Promise<unknown>;
		getGlobalData(): Promise<unknown>;
		getGlobalDataExtensionPriorities(): string[];
		getGlobalDataFiles(): Promise<string[]>;
		getGlobalDataGlob(): string;
		getInitialGlobalData(): Promise<unknown>;
		getInputDir(): string;
		getLocalDataPaths(templatePath: string): Promise<string[]>;
		getObjectPathForDataFile(dataFilePath: string): string[];
		getRawImports(): unknown;
		getTemplateDataFileGlob(): Promise<string>;
		getTemplateDirectoryData(templatePath: string): Promise<unknown>;
		getTemplateJavaScriptDataFileGlob(): string;
		getUserDataExtensions(): string[];
		getUserDataParser(): unknown;
		getWatchPathCache(): unknown;
		hasUserDataExtensions(): boolean;
		isUserDataExtension(extension: unknown): boolean;
		setFileSystemSearch(fileSystemSearch: unknown): void;
		setProjectUsingEsm(isEsmProject: boolean): void;

		readonly absoluteDataDir: string;
		readonly dataDir: string;
		readonly dirs: ProjectDirectories;
		readonly inputDir: string;

		benchmarks: { data: unknown; aggregate: unknown };
		config: Config;
		environmentVariables: unknown;
		extensionMap: EleventyExtensionMap;
		globalData: null;
		initialGlobalData: TemplateDataInitialGlobalData;
		isEsm: boolean;
		rawImports: {};
		templateConfig: TemplateConfig;
		templateDirectoryData: {};
	}

	export declare class TemplateDataInitialGlobalData {}

	export declare class UserConfig {
		addAsyncFilter(name: string, callback: Callback): void;
		addAsyncShortcode(name: string, callback: Callback): void;
		addDataExtension(extensionList: string, parser: unknown): void;
		addFilter(name: string, callback: Callback): void;
		addJavaScriptFilter(name: string, callback: Callback): void;
		addJavaScriptFunction(name: string, callback: Callback): void;
		addJavaScriptShortcode(name: string, callback: Callback): void;
		addLiquidFilter(name: string, callback: Callback): void;
		addLiquidShortcode(name: string, callback: Callback): void;
		addLiquidTag(name: string, tagFn: any): void;
		addMarkdownHighlighter(highlightFn: any): void;
		addNunjucksAsyncFilter(name: string, callback: Callback): void;
		addNunjucksAsyncShortcode(name: string, callback: Callback): void;
		addNunjucksFilter(name: string, callback: Callback, isAsync?: boolean): void;
		addNunjucksShortcode(name: string, callback: Callback, isAsync?: boolean): void;
		addNunjucksTag(name: string, tagFn: TagFunction): void;
		addPairedAsyncShortcode(name: string, callback: Callback): void;
		addPairedJavaScriptShortcode(name: string, callback: Callback): void;
		addPairedLiquidShortcode(name: string, callback: Callback): void;
		addPairedNunjucksAsyncShortcode(name: string, callback: Callback): void;
		addPairedNunjucksShortcode(name: string, callback: Callback, isAsync?: boolean): void;
		addPairedShortcode(name: string, callback: Callback): void;
		addShortcode(name: string, callback: Callback): void;
		emit(eventName: string, ...args: unknown[]): unknown;
		getFilter(name: string): unknown;
		getFilters(options?: {}): unknown;
		getPairedShortcode(name: string): unknown;
		getPairedShortcodes(options?: {}): unknown;
		getShortcode(name: string): unknown;
		getShortcodes(options?: {}): unknown;
		isPluginExecution(): boolean;
		on(eventName: string, callback: Callback): unknown;
		once(eventName: string, callback: Callback): unknown;
		reset(): void;
		setEventEmitterMode(mode: RunMode): void;
		setHtmlTemplateEngine(engineName: string): void;
		setLibrary(engineName: string, libraryInstance: unknown): void;
		setMarkdownTemplateEngine(engineName: string): void;
		setUseTemplateCache(bypass: boolean): void;
		versionCheck(compatibleRange: string): void;

		dataExtensions: Map<string, unknown>;
		quietMode: boolean;
		plugins: unknown[];
		dataFilterSelectors: Set<string>;
		libraryAmendments: object;
		serverPassthroughCopyBehavior: string;
		urlTransforms: Callback[];
		useTemplateCache: boolean;
		dataFileSuffixesOverride: boolean;
		dataFileDirBaseNameOverride: boolean;
		frontMatterParsingOptions: object;
		virtualTemplates: object;
		freezeReservedData: boolean;
		customDateParsingCallbacks: Set<Callback>;
		errorReporting: object;
	}

	export declare class FileSystemSearch {
		add(path: string): void;
		delete(path: string): void;
		getCacheKey(key: string, globs: string[], options: object): string;
		search(key: string, globs: string[], options?: object): string[];

		inputs: Record<string, string[]>;
		outputs: Record<string, string[]>;
		promises: Record<string, Promise<string[]>>;
		count: number;
	}

	export declare class TemplateMap {
		constructor(eleventyConfig?: TemplateConfig);

		readonly config: UserConfig;

		add(template: Template): Promise<void>;
		addAllToGlobalDependencyGraph(): void;
		cache(): Promise<void>;
		checkForDuplicatePermalinks(): void;
		checkForMissingFileExtensions(): void;
		generateInputUrlContentMap(orderedMap: any): {};
		generateLayoutsMap(): Promise<{}>;
		generateUrlMap(orderedMap: any): {};
		getMap(): Template[];
		getMapEntryForInputPath(inputPath: string): any;
		getPaginationTagTarget(entry: any): any;
		getTaggedCollection(tag: string): any;
		getTagTarget(str: string): any;
		getTemplateOrder(): any;
		getUserConfigCollection(name: string): Promise<any>;
		getUserConfigCollectionNames(): string[];
		hasMapEntryForInputPath(inputPath: string): boolean;
		initDependencyMap(fullTemplateOrder: any): Promise<void>;
		isUserConfigCollectionName(name: string): any;
		populateCollectionsWithContent(): void;
		populateContentDataInMap(orderedMap: any): Promise<void>;
		resolveRemainingComputedData(): Promise<any[]>;
		runDataSchemas(orderedMap: any): Promise<void>;
		setCollectionByTagName(tagName: string): Promise<void>;
	}

	export declare class Template {}

	// -----------------------------------------------------------------------------
	// Interfaces
	// -----------------------------------------------------------------------------

	export interface EleventyOptions {
		/**
		 * Called via CLI (`cli`) or programmatically (`script`).
		 * @default "script"
		 */
		source?: "cli" | "script";

		/**
		 * One of: build, serve, or watch.
		 * @default "build"
		 */
		runMode?: "build" | "serve" | "watch";

		/**
		 * Run Eleventy in dry-run mode (no writes).
		 * @default false
		 */
		dryRun?: boolean;

		/**
		 * Path to the Eleventy config file.
		 */
		configPath?: string;

		/**
		 * Path prefix for URLs.
		 */
		pathPrefix?: string;

		/**
		 * Suppress console output.
		 */
		quietMode?: boolean;

		/**
		 * A function that receives the EleventyConfig instance.
		 * Equivalent to the config callback in `.eleventy.js`.
		 */
		config?: (eleventyConfig: any) => void;

		/**
		 * Override the input directory (normally passed as the first constructor arg).
		 */
		inputDir?: string;

		/**
		 * Force ESM or CJS loader mode.
		 * @default "auto"
		 */
		loader?: "auto" | "cjs" | "esm";
	}

	export interface Config {
		templateFormats: string[];
		pathPrefix: string;
		markdownTemplateEngine: string;
		htmlTemplateEngine: string;
		dataFileSuffixes: string[];
		dataFileDirBaseNameOverride: false;
		keys: Record<string, string>;
		dir: {
			input: string;
			includes: string;
			data: string;
			output: string;
			templateFormats: string[];
		};
		nunjucksFilters: unknown;
		directories: unknown;
		transforms: Record<string, unknown>;
		linters: {};
		preprocessors: {};
		globalData: {};
		layoutAliases: {};
		layoutResolution: true;
		passthroughCopiesHtmlRelative: Set<unknown>;
		passthroughCopies: {};
		liquidOptions: {};
		liquidTags: {};
		liquidPairedShortcodes: {};
		liquidParameterParsing: "legacy";
		nunjucksEnvironmentOptions: {
			dev: true;
		};
		nunjucksLoaders: [];
		nunjucksPrecompiledTemplates: {};
		nunjucksTags: {};
		nunjucksGlobals: {};
		nunjucksAsyncShortcodes: {};
		nunjucksAsyncPairedShortcodes: {};
		nunjucksPairedShortcodes: {};
		javascriptFunctions: Record<string, unknown>;
		javascriptPairedShortcodes: {};
		javascriptFilters: {};
		markdownHighlighter: null;
		dynamicPermalinks: true;
		useGitIgnore: true;
		ignores: Set<string>;
		watchIgnores: Set<string>;
		dataDeepMerge: true;
		watchJavaScriptDependencies: true;
		additionalWatchTargets: [];
		watchTargetsConfigReset: Set<string>;
		serverOptions: {};
		chokidarConfig: {};
		watchThrottleWaitTime: 0;
		frontMatterParsingOptions: {};
		dataExtensions: Map<unknown, unknown>;
		extensionMap: Set<unknown>;
	}

	export interface WriteResult {
		passthroughCopy: TemplatePassthroughManager[];
		templates: JSONMapEntry[];
	}

	export interface EnvironmentVariableValues extends UserEnvironmentVariableValues {
		config?: string;
	}

	export interface UserEnvironmentVariableValues {
		root: string;
		runMode: RunMode;
		source: Source;
	}

	export interface EleventyMap {
		template: this;
		inputPath: string;
		data: unknown;
	}

	export interface UserspaceInstance {
		input: string;
		inputFile: string;
		inputGlob: string;
		data: string;
		includes: string;
		layouts: string;
		output: string;
	}

	export interface JSONMapEntry {
		url: URLPath;
		inputPath: string;
		outputPath: string;
		rawInput: string;
		content: string;
		data?: unknown;
	}

	export type FileShape = "copy" | "template";
	export type Loader = "esm" | "cjs" | "auto";
	export type OutputFormat = "fs" | "fs:templates" | "json";
	export type RunMode = "build" | "serve" | "watch";
	export type Source = "cli" | "script";
	export type Callback = (...args: unknown[]) => unknown;
	export type TagFunction = (...args: unknown[]) => unknown;

	export default Eleventy;
}
