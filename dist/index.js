"use strict";
const FS = require('fs-extra');
const Path = require('path');
const Chokidar = require('chokidar');
const Events = require('events');
const thenfail_1 = require('thenfail');
let uid = 0;
class TSConfigFilesSynchronizer extends Events.EventEmitter {
    constructor(targetFilePath, options) {
        super();
        options = options || {};
        this._targetFilePath = Path.resolve(targetFilePath);
        this._projectDir = options.projectDir || Path.dirname(this._targetFilePath);
        this._extraFileGlobs = options.fileGlobs || [];
        this._fileGlobs = [];
        this._syncLocker = new thenfail_1.Lock();
        this._tsconfig = null;
        this._readyPromise = new thenfail_1.Promise();
        this._options = options;
        if (!FS.existsSync(this._targetFilePath)) {
            throw new Error(`${this._targetFilePath} is not found`);
        }
        this._watch();
    }
    set files(files) {
        if (!this._tsconfig) {
            this._tsconfig = {};
        }
        this._tsconfig.files = files || [];
    }
    get files() {
        return (this._tsconfig || {}).files || [];
    }
    get ready() {
        return this._readyPromise;
    }
    sync(callback, delay) {
        clearTimeout(this._syncDelayTimerId);
        if (Object.keys(this._tsconfig).join('') == 'files') {
            return thenfail_1.Promise.void;
        }
        const promise = new thenfail_1.Promise();
        if (delay) {
            this._syncDelayTimerId = setTimeout(() => {
                this.sync(callback)
                    .handle(promise);
            }, delay);
        }
        else {
            this._files = uniqueArrayItems(this.files);
            this._files.sort(function (a, b) {
                return a > b ? 1 : -1;
            });
            this.emit('syncBefore');
            let tsconfig = this._tsconfig;
            this._syncLocker.queue(() => {
                return thenfail_1.Promise.invoke(FS.writeFile, this._targetFilePath, JSON.stringify(tsconfig, null, 4))
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
        try {
            if (this._watcher) {
                this._watcher.close();
            }
        }
        catch (e) { }
    }
    _watch() {
        let id = ++uid;
        let isReady = false;
        this.files = this._options.files || [];
        this._closeWatcher();
        this._watcher = Chokidar.watch(uniqueArrayItems(this._fileGlobs.concat('tsconfig.json', this._extraFileGlobs)), { cwd: this._projectDir });
        this._watcher.on("add", (file) => {
            if (id != uid) {
                return;
            }
            if (!this._handleChange(file)) {
                this.files.push(file);
                this.sync(null, 100);
            }
            this.emit('action', { type: 'add', file: file });
        });
        this._watcher.on("change", (file) => {
            if (id != uid) {
                return;
            }
            this.emit('action', { type: 'change', file: file });
            this._handleChange(file);
        });
        this._watcher.on("unlink", (file) => {
            if (id != uid) {
                return;
            }
            let n = 0;
            let files = this.files;
            for (let i = 0, l = files.length; i < l; i++) {
                if (files[i] != file) {
                    files[n++] = files[i];
                }
            }
            files.length = n;
            this.files = files;
            this.sync(null, 100);
            this.emit('action', { type: 'unlink', file: file });
        });
    }
    _handleChange(file) {
        switch (file) {
            case 'tsconfig.json':
                this._handleTSConfigChanged();
                return true;
        }
    }
    _handleTSConfigChanged() {
        let id = uid;
        FS.readFile(this._targetFilePath, (err, tsconfig) => {
            if (err || id != uid) {
                return;
            }
            try {
                tsconfig = JSON.parse(tsconfig || '{}');
            }
            catch (e) {
                return;
            }
            let newFileGlobs = tsconfig.fileGlobs || [];
            let oldFileGlobs = this._fileGlobs;
            for (let i = 0, globs = oldFileGlobs.length > newFileGlobs.length ? oldFileGlobs : newFileGlobs, l = globs.length; i < l; i++) {
                let glob = globs[i];
                if (newFileGlobs.indexOf(glob) > -1 && oldFileGlobs.indexOf(glob) > -1) {
                    continue;
                }
                else {
                    this._fileGlobs = newFileGlobs;
                    this._tsconfig = tsconfig;
                    this._watch();
                    return;
                }
            }
        });
    }
}
exports.TSConfigFilesSynchronizer = TSConfigFilesSynchronizer;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TSConfigFilesSynchronizer;
function uniqueArrayItems(list) {
    const map = {};
    let n = 0;
    for (let i = 0, l = list.length; i < l; i++) {
        let item = list[i];
        if (!map[item]) {
            map[item] = true;
            list[n++] = item;
        }
    }
    list.length = n;
    return list;
}
