"use strict";
const FS = require('fs-extra');
const Path = require('path');
const chai_1 = require('chai');
const _1 = require('../');
const TEST_PROJECT_DIR = Path.join(__dirname, '../../.cache/test-project');
const TEST_PROJECT_TSCONFIG_FILE = Path.join(TEST_PROJECT_DIR, "tsconfig.json");
const FILES = [
    "extra-file.ts",
    "file1.ts",
    "dir1/file1.ts",
].sort(sortFunc);
initTestProject();
describe("tsconfig-files-synchronizer", () => {
    let synchronizer;
    it("new TSConfigFilesSynchronizer(...)", () => {
        synchronizer = new _1.default(TEST_PROJECT_TSCONFIG_FILE, {
            files: [
                "extra-file.ts"
            ]
        });
        return true;
    });
    it("TSConfigFilesSynchronizer.ready", (done) => {
        synchronizer.ready
            .then(done)
            .fail(reason => {
            chai_1.expect(reason, reason).to.be.equal('');
            done();
        });
    });
    it("检查files是否同步正常", () => {
        compareList(getFiles(), FILES);
        return true;
    });
    it("检查新目标文件添加", (done) => {
        let count = 0;
        synchronizer.on('action', (action) => {
            if (action && action.type == 'add') {
                count++;
            }
        });
        synchronizer.once('sync', () => {
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
    it("目标tsconfig.json文件被修改", (done) => {
        let count = 0;
        synchronizer.once('sync', () => {
            console.log(getFiles().join('\n'));
            console.log('------------');
            console.log(FILES
                .concat(['file2.ts', 'dir1/file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc).join('\n'));
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir1/file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        const tsconfig = FS.readJSONSync(TEST_PROJECT_TSCONFIG_FILE);
        tsconfig.fileGlobs = ['./**/*.{ts,tsx}'];
        console.log(JSON.stringify(tsconfig, null, 4));
        FS.writeFileSync(TEST_PROJECT_TSCONFIG_FILE, JSON.stringify(tsconfig, null, 4));
    });
    it("添加新目录且包含匹配文件", (done) => {
        synchronizer.once('sync', () => {
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir2/file1.ts', 'dir1/file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir2/file1.ts'));
    });
    it("删除匹配文件和删除目录", (done) => {
        let count = 0;
        synchronizer.once('sync', () => {
            compareList(getFiles(), FILES
                .concat(['file2.ts', 'dir1/file3.tsx'])
                .sort(sortFunc));
            done();
        });
        FS.unlinkSync(Path.join(TEST_PROJECT_DIR, 'dir1/file2.ts'));
        FS.remove(Path.join(TEST_PROJECT_DIR, 'dir2'));
    });
    it("销毁", () => {
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
    FS.writeFileSync(Path.join(TEST_PROJECT_DIR, 'tsconfig.json'), `
        {
            "compilerOptions": {
                "target": "es6",
                "module": "commonjs",
                "declaration": false,
                "noImplicitAny": true,
                "removeComments": true,
                "noEmitOnError": false,
                "preserveConstEnums": true,
                "noLib": false,
                "sourceMap": false,
                "experimentalDecorators": true
            },
            "fileGlobs": [
                "./**/*.ts"
            ],
            "files": []
        }
        `);
    FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'file1.ts'));
    FS.ensureFileSync(Path.join(TEST_PROJECT_DIR, 'dir1/file1.ts'));
}
function getFiles() {
    const tsconfig = FS.readJSONSync(TEST_PROJECT_TSCONFIG_FILE);
    return tsconfig.files || [];
}
function compareList(listA, listB, message) {
    chai_1.expect(listA.join(','), message).to.be.equal(listB.join(','));
}
