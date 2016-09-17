[![NPM Package](https://badge.fury.io/js/tsconfig-files-synchronizer.svg)](https://www.npmjs.com/package/tsconfig-files-synchronizer)
[![Build Status](https://travis-ci.org/maolion/tsconfig-files-synchronizer.svg)](https://travis-ci.org/maolion/tsconfig-files-synchronizer)

# TSConfig Files Synchronizer

用于 自动同步 TypeScript 的 tsconfig 编译配置文件

##  版本更新提示
- 0.1.x

    组件被实现

## 安装

```
npm install tsconfig-files-synchronizer --save-dev
```

## 使用
```
var TSConfigFilesSynchronizer = require('tsconfig-files-synchronizer').TSConfigFilesSynchronizer;
// or 
// import TSConfigFilesSynchronizer from 'tsconfig-files-synchronizer';

var synchronizer = new TSConfigFilesSynchronizer(
    'path/to/tsconfig.json' [, ...]
);

```

## 文档

数据类型
```
export interface SynchronizerOptions {
    projectDir: string;   // 监听的目标目录，默认是 tsconfig.json所在目录
    fileGlobs: string[];  // 文件匹配条件 (glob 表达式)
    files: string[];      // 需要被包含的文件
}

----

interface FileAction {
    type: string; // 文件变化类型, 包含的值有 'add', 'unlink', 'change'
    file: string; // 文件路径
}
```

实例 方法 和 属性
```

new TSConfigFilesSynchronizer(tsconfigFile: string, options: SynchronizerOptions);
构造函数, 继承 events.EventEmitter
@param tsconfigFile 指定tsconfig.json文件路径__
@param options 可选的配置信息

----

files: string[];
可读写的files属性, 内存中tsconfig.json files属于的映射

----

ready: Promise<void>
首次同步完成状态属性

----

sync(): Promise<void>;
执行同步 

----

destroy()
销毁同步实例, 停止同步
```

事件

```

action
监听的目标目录 文件发生的变化

事件传递参数
@param action: FileAction


----

syncBefore
tsconfig.json files项目被同步执行之前 触发

----

sync 
tsconfig.json files项目被同步执行之后 触发

----
syncError
tsconfig.json files项目被同步执行之后发生错误 触发

事件传递参数
@param reason: Error

```
