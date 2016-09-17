import * as FS from 'fs-extra';
import * as Path from 'path';
import * as Chokidar from 'chokidar';
import * as Events from 'events';
import { Promise, Lock as PromiseLock } from 'thenfail';

let uid = 0;

export interface SynchronizerOptions {
    projectDir?: string;
    fileGlobs?: string[];
    files?: string[];
}

export class TSConfigFilesSynchronizer extends Events.EventEmitter {

    private _targetFilePath: string;
    private _projectDir: string;
    private _extraFileGlobs: string[];
    private _fileGlobs: string[];
    private _syncLocker: PromiseLock;
    private _files: string[];
    private _tsconfig: any;
    private _syncDelayTimerId: number;
    private _watcher: FS.FSWatcher;
    private _readyPromise: Promise<void>;
    private _options: SynchronizerOptions;
    constructor(targetFilePath: string, options?: SynchronizerOptions) {
        super();

        options = options || {};
        this._targetFilePath = Path.resolve(targetFilePath);
        this._projectDir = options.projectDir || Path.dirname(this._targetFilePath);
        this._extraFileGlobs = options.fileGlobs || [];
        this._fileGlobs = [];
        this._syncLocker = new PromiseLock();
        this._tsconfig = null;
        this._readyPromise = new Promise<void>();
        this._options = options;
        
        if (!FS.existsSync(this._targetFilePath)) {
            throw new Error(`${this._targetFilePath} is not found`);
        }

        this._watch();
    }
    
    set files(files) {
        if (!this._tsconfig) {
            this._tsconfig = {};
        }
        
        this._tsconfig.files = files || [];
    }
    
    get files() {
        return (this._tsconfig||{}).files || [];
    }
    
    get ready(): Promise<void> {
        return this._readyPromise;
    }

    sync(callback: Function, delay?: number) {
        clearTimeout(this._syncDelayTimerId);

        if (Object.keys(this._tsconfig).join('') == 'files') {
            return Promise.void;
        }
        
        const promise = new Promise<void>();

        if (delay) {
            this._syncDelayTimerId = setTimeout(() => {
                this.sync(callback)
                    .handle(promise);
            }, delay) as any;
        } else {
            this._files = uniqueArrayItems(this.files);
            this._files.sort(function(a, b) {
                return a > b ? 1 : -1
            });

            this.emit('syncBefore');
            let tsconfig = this._tsconfig;
            this._syncLocker.queue(() => {
                return Promise.invoke(
                    FS.writeFile, 
                    this._targetFilePath, 
                    JSON.stringify(tsconfig, null, 4)
                )
                    .then(() => {
                        callback && callback();
                        this.emit('sync');
                        if (this._readyPromise.pending) {
                            this._readyPromise.resolve();
                        }
                        promise.resolve();
                    })
                    .fail(reason => {
                        this.emit('syncError', reason);
                        if (this._readyPromise.pending) {
                            this._readyPromise.reject(reason);
                        }
                        promise.reject(reason);
                    });
            });
        }

        return promise;
    }

    destroy() {
        this._closeWatcher();
        this._tsconfig = null;
        this._files = null;
        this._watcher = null;
    }

    _closeWatcher() {
        try{
            if (this._watcher) {
                this._watcher.close();
            }
        } catch (e) {}
    }

    _watch() {
        let id = ++uid;
        let isReady = false;
        this.files = this._options.files || [];
        
        this._closeWatcher();

        this._watcher =  Chokidar.watch(
            uniqueArrayItems(this._fileGlobs.concat(
                'tsconfig.json', 
                this._extraFileGlobs as any
            )), 
            { cwd: this._projectDir }
        );
        
        this._watcher.on("add", (file: string) => {
            if (id != uid) {
                return;
            }
            if (!this._handleChange(file)) {
                this.files.push(file);
                this.sync(null, 100);
            }

            this.emit('action', { type: 'add', file });
        });
        
        this._watcher.on("change", (file: string) => {
            if (id != uid) {
                return;
            }
            this.emit('action', { type: 'change', file });
            this._handleChange(file);
        });
        
        this._watcher.on("unlink", (file: string) => {
            if (id != uid) {
                return;
            }
            
            let n = 0;
            let files = this.files;
            for(let i = 0, l = files.length; i < l; i++) {
                if (files[i] != file) {
                    files[n++] = files[i];
                }
            }
            
            files.length = n;
            this.files = files;
            this.sync(null, 100);
            this.emit('action', { type: 'unlink', file });
        });
    }
    
    _handleChange(file: string) {
        switch (file) {
            case 'tsconfig.json':
                this._handleTSConfigChanged();
                return true;
        }
    }
    
    _handleTSConfigChanged() {
        let id = uid;
        FS.readFile(this._targetFilePath, 'utf8', (err: any, tsconfig: any) => {
            if (err || id != uid) {
                return;
            }

            try{
                tsconfig = JSON.parse(tsconfig.toString() || '{}');
            } catch (e) {
                console.log(e);
                return;
            }
            
            let newFileGlobs = tsconfig.fileGlobs || [];
            let oldFileGlobs = this._fileGlobs;
            for (let i = 0, globs = oldFileGlobs.length > newFileGlobs.length ? oldFileGlobs : newFileGlobs, l = globs.length; i < l; i++) {
                let glob = globs[i];
                if (newFileGlobs.indexOf(glob) > -1 && oldFileGlobs.indexOf(glob) > -1) {
                    continue;
                } else {
                    this._fileGlobs = newFileGlobs;
                    this._tsconfig = tsconfig;
                    this._watch();
                    return;
                }
            }
        });
    }
}
export default TSConfigFilesSynchronizer;

// helpers 
function uniqueArrayItems(list: any) {
    const map:any = {};
    let n = 0;
    
    for (let i = 0, l = list.length; i < l; i++) {
        let item = list[i];
        if (!map[item]) {
            map[item] = true;
            list[n++] = item;
        }
    }
    
    list.length = n;
    
    return list;
}
