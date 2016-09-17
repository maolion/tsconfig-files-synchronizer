"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var FS = require('fs-extra');
var Path = require('path');
var Chokidar = require('chokidar');
var Events = require('events');
var thenfail_1 = require('thenfail');
var uid = 0;
var TSConfigFilesSynchronizer = (function (_super) {
    __extends(TSConfigFilesSynchronizer, _super);
    function TSConfigFilesSynchronizer(targetFilePath, options) {
        _super.call(this);
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
            throw new Error(this._targetFilePath + " is not found");
        }
        this._watch();
    }
    Object.defineProperty(TSConfigFilesSynchronizer.prototype, "files", {
        get: function () {
            return (this._tsconfig || {}).files || [];
        },
        set: function (files) {
            if (!this._tsconfig) {
                this._tsconfig = {};
            }
            this._tsconfig.files = files || [];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TSConfigFilesSynchronizer.prototype, "ready", {
        get: function () {
            return this._readyPromise;
        },
        enumerable: true,
        configurable: true
    });
    TSConfigFilesSynchronizer.prototype.sync = function (callback, delay) {
        var _this = this;
        clearTimeout(this._syncDelayTimerId);
        if (Object.keys(this._tsconfig).join('') == 'files') {
            return thenfail_1.Promise.void;
        }
        var promise = new thenfail_1.Promise();
        if (delay) {
            this._syncDelayTimerId = setTimeout(function () {
                _this.sync(callback)
                    .handle(promise);
            }, delay);
        }
        else {
            this._files = uniqueArrayItems(this.files);
            this._files.sort(function (a, b) {
                return a > b ? 1 : -1;
            });
            this.emit('syncBefore');
            var tsconfig_1 = this._tsconfig;
            this._syncLocker.queue(function () {
                return thenfail_1.Promise.invoke(FS.writeFile, _this._targetFilePath, JSON.stringify(tsconfig_1, null, 4))
                    .then(function () {
                    callback && callback();
                    _this.emit('sync');
                    if (_this._readyPromise.pending) {
                        _this._readyPromise.resolve();
                    }
                    promise.resolve();
                })
                    .fail(function (reason) {
                    _this.emit('syncError', reason);
                    if (_this._readyPromise.pending) {
                        _this._readyPromise.reject(reason);
                    }
                    promise.reject(reason);
                });
            });
        }
        return promise;
    };
    TSConfigFilesSynchronizer.prototype.destroy = function () {
        this._closeWatcher();
        this._tsconfig = null;
        this._files = null;
        this._watcher = null;
    };
    TSConfigFilesSynchronizer.prototype._closeWatcher = function () {
        try {
            if (this._watcher) {
                this._watcher.close();
            }
        }
        catch (e) { }
    };
    TSConfigFilesSynchronizer.prototype._watch = function () {
        var _this = this;
        var id = ++uid;
        var isReady = false;
        this.files = this._options.files || [];
        this._closeWatcher();
        this._watcher = Chokidar.watch(uniqueArrayItems(this._fileGlobs.concat('tsconfig.json', this._extraFileGlobs)), { cwd: this._projectDir });
        this._watcher.on("add", function (file) {
            if (id != uid) {
                return;
            }
            if (!_this._handleChange(file)) {
                _this.files.push(file);
                _this.sync(null, 100);
            }
            _this.emit('action', { type: 'add', file: file });
        });
        this._watcher.on("change", function (file) {
            if (id != uid) {
                return;
            }
            _this.emit('action', { type: 'change', file: file });
            _this._handleChange(file);
        });
        this._watcher.on("unlink", function (file) {
            if (id != uid) {
                return;
            }
            var n = 0;
            var files = _this.files;
            for (var i = 0, l = files.length; i < l; i++) {
                if (files[i] != file) {
                    files[n++] = files[i];
                }
            }
            files.length = n;
            _this.files = files;
            _this.sync(null, 100);
            _this.emit('action', { type: 'unlink', file: file });
        });
    };
    TSConfigFilesSynchronizer.prototype._handleChange = function (file) {
        switch (file) {
            case 'tsconfig.json':
                this._handleTSConfigChanged();
                return true;
        }
    };
    TSConfigFilesSynchronizer.prototype._handleTSConfigChanged = function () {
        var _this = this;
        var id = uid;
        FS.readFile(this._targetFilePath, function (err, tsconfig) {
            if (err || id != uid) {
                return;
            }
            try {
                tsconfig = JSON.parse(tsconfig || '{}');
            }
            catch (e) {
                return;
            }
            var newFileGlobs = tsconfig.fileGlobs || [];
            var oldFileGlobs = _this._fileGlobs;
            for (var i = 0, globs = oldFileGlobs.length > newFileGlobs.length ? oldFileGlobs : newFileGlobs, l = globs.length; i < l; i++) {
                var glob = globs[i];
                if (newFileGlobs.indexOf(glob) > -1 && oldFileGlobs.indexOf(glob) > -1) {
                    continue;
                }
                else {
                    _this._fileGlobs = newFileGlobs;
                    _this._tsconfig = tsconfig;
                    _this._watch();
                    return;
                }
            }
        });
    };
    return TSConfigFilesSynchronizer;
}(Events.EventEmitter));
exports.TSConfigFilesSynchronizer = TSConfigFilesSynchronizer;
exports.__esModule = true;
exports["default"] = TSConfigFilesSynchronizer;
function uniqueArrayItems(list) {
    var map = {};
    var n = 0;
    for (var i = 0, l = list.length; i < l; i++) {
        var item = list[i];
        if (!map[item]) {
            map[item] = true;
            list[n++] = item;
        }
    }
    list.length = n;
    return list;
}
