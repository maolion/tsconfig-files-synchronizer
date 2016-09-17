declare module 'tsconfig-files-synchronizer' {
	import * as Events from 'events';
	import { Promise } from 'thenfail';
	export interface SynchronizerOptions {
	    projectDir?: string;
	    fileGlobs?: string[];
	    files?: string[];
	}
	export class TSConfigFilesSynchronizer extends Events.EventEmitter {
	    private _targetFilePath;
	    private _projectDir;
	    private _extraFileGlobs;
	    private _fileGlobs;
	    private _syncLocker;
	    private _files;
	    private _tsconfig;
	    private _syncDelayTimerId;
	    private _watcher;
	    private _readyPromise;
	    private _options;
	    constructor(targetFilePath: string, options?: SynchronizerOptions);
	    files: any;
	    ready: Promise<void>;
	    sync(callback: Function, delay?: number): Promise<void>;
	    destroy(): void;
	    _closeWatcher(): void;
	    _watch(): void;
	    _handleChange(file: string): boolean;
	    _handleTSConfigChanged(): void;
	}
	export default TSConfigFilesSynchronizer;

}
