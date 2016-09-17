"use strict";
var FS = require('fs-extra');
var Path = require('path');
var chai_1 = require('chai');
var _1 = require('../');
var TEST_PROJECT_DIR = Path.join(__dirname, '../../.cache/test-project-' + Date.now());
var TEST_PROJECT_TSCONFIG_FILE = Path.join(TEST_PROJECT_DIR, "tsconfig.json");
var FILES = [
    "extra-file.ts",
    "file1.ts",
    "dir1/file1.ts",
].sort(sortFunc);
initTestProject();
describe("tsconfig-files-synchronizer", function () {
    var synchronizer;
    it("new TSConfigFilesSynchronizer(...)", function () {
        synchronizer = new _1["default"](TEST_PROJECT_TSCONFIG_FILE, {
            files: [
                "extra-file.ts"
            ]
        });
        return true;
    });
    it("TSConfigFilesSynchronizer.ready", function (done) {
        synchronizer.ready
            .then(done)
            .fail(function (reason) {
            chai_1.expect(reason, reason).to.be.equal('');
            done();
        });
    });
    it("检查files是否同步正常", function () {
        compareList(getFiles(), FILES);
        return true;
    });
    it("检查新目标文件添加", function (done) {
        var count = 0;
        synchronizer.on('action', function (action) {
            if (action && action.type == 'add') {
                count++;
            }
        });
        synchronizer.once('sync', function () {
            chai_1.expect(count).to.be.equal(2);
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir1/file2.ts'])
                .sort(sortFunc));
            done();
        });
        FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'file2.ts'));
        FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir1/file2.ts'));
        FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir1/file3.tsx'));
    });
    it("目标tsconfig.json文件被修改", function (done) {
        var count = 0;
        synchronizer.once('sync', function () {
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir1/file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        var tsconfig = FS.readJSONSync(TEST_PROJECT_TSCONFIG_FILE);
        tsconfig.fileGlobs.push('./**/*.tsx');
        FS.writeFileSync(TEST_PROJECT_TSCONFIG_FILE, JSON.stringify(tsconfig, null, 4));
    });
    it("添加新目录且包含匹配文件", function (done) {
        synchronizer.once('sync', function () {
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir2/file1.ts', 'dir1/file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir2/file1.ts'));
    });
    it("删除匹配文件和删除目录", function (done) {
        var count = 0;
        synchronizer.once('sync', function () {
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        FS.unlinkSync(Path.join(TEST_PROJECT_DIR, 'dir1/file2.ts'));
        FS.remove(Path.join(TEST_PROJECT_DIR, 'dir2'));
    });
    it("销毁", function () {
        synchronizer.destroy();
        try {
            FS.removeSync(TEST_PROJECT_DIR);
        }
        catch (e) {
            console.log(e);
        }
        return true;
    });
});
function sortFunc(a, b) {
    return a > b ? 1 : -1;
}
function initTestProject() {
    FS.ensureDirSync(TEST_PROJECT_DIR);
    FS.emptyDirSync(TEST_PROJECT_DIR);
    FS.writeFileSync(Path.join(TEST_PROJECT_DIR, 'tsconfig.json'), "\n        {\n            \"compilerOptions\": {\n                \"target\": \"es6\",\n                \"module\": \"commonjs\",\n                \"declaration\": false,\n                \"noImplicitAny\": true,\n                \"removeComments\": true,\n                \"noEmitOnError\": false,\n                \"preserveConstEnums\": true,\n                \"noLib\": false,\n                \"sourceMap\": false,\n                \"experimentalDecorators\": true\n            },\n            \"fileGlobs\": [\n                \"./**/*.ts\"\n            ],\n            \"files\": []\n        }\n        ");
    FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'file1.ts'));
    FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir1/file1.ts'));
}
function getFiles() {
    var tsconfig = FS.readJSONSync(TEST_PROJECT_TSCONFIG_FILE);
    return tsconfig.files || [];
}
function compareList(listA, listB, message) {
    chai_1.expect(listA.join(','), message).to.be.equal(listB.join(','));
}
