---
title: "使用内联插件（Inline plugins）的方法重构Tauri项目"
description:
    - 我有一个开发时长两年半的 Minecraft 启动器项目，由于过去经验过于缺乏，模块之间的结构十分混乱，于是我最近对它进行了重构。本文主要记录这一过程中踩过的坑，希望可以帮助到正在使用 Tauri 的你。
author: "OakChaser"
minutes: 40
date: "2025-08-05"
tags:
    - Conic
    - Technical
    - Note
    - Tauri
---

我有一个开发时长两年半的 Minecraft 启动器项目，由于过去经验过于缺乏，模块之间的结构十分混乱，于是我最近对它进行了重构。本文主要记录这一过程中踩过的坑，希望可以帮助到正在使用 Tauri 的你。

本文提到的项目地址：<https://gitHub.com/conic-apps/launcher>

## 为什么要重构？

在 Tauri 中，Web 前端调用 Rust 后端需要用一个 `invoke` 函数，里面的第一个参数是函数名，也称为命令，而每个命令必须在 `main` 函数中调用 `invoke_handler` 注册

**问题是这一堆玩意没法拆分，看着太恶心了：**

![](/img/Screenshot-2025-08-06-07-28-34.png)

于是我在GitHub上搜索，不少人也有类似的感受，比如[这个](https://github.com/tauri-apps/tauri/discussions/13085)，里面的回答提到了可以把模块写成 Tauri 插件，于是我就产生了重构的想法。

## 背景知识

Tauri 框架的后端使用 Rust 语言编写，默认放在 src-tauri 目录里，也可以放在别的目录，而它本身是个 crate。

像这样的 Rust 项目，可以使用 workspace，在一个项目里定义多个 crate，这样模块之间的边界会更清晰，或许有助于日后维护。（~~其实还能更方便地把它们发到 crates.io，到时候发个视频教大家零基础编写启动器~~：）

## 实现过程 / 踩坑过程

### 给原来的模块搬家

这是我原来的项目结构：
```
conic-launcher/
├── package.json           # 前端依赖
├── src/                   # 前端源码
│   └── ...                # 前端 UI 源码（Vue）
├── core/                  # 相当于 src-tauri，Tauri 后端
│   ├── Cargo.toml         # Rust 后端项目配置
│   └── src/
│       ├── main.rs        # Tauri main 启动逻辑
│       ├── install/       # 安装模块（fabric/forge/quilt 等）
│       ├── config/        # 配置模块（解析 config 文件等）
│       ├── account/       # 用户账户管理
│       ├── launch/        # 启动 Minecraft 实例
│       ├── platform.rs    # 平台信息（OS 检测等）
│       └── version.rs     # version.json 文件解析与合并
```

重构后，除了 main.rs，别的模块都被移动到单独的 crate，放在 `conic-launcher/crates` 目录中，并在项目根目录添加了 Cargo.toml文件：

```toml
[workspace]
members = [
    "core/",
    "crates/*"
]
resolver = "3"

[workspace.package]
edition = "2024"
license = "GPL-3.0-only"
repository = "https://github.com/conic-apps/launcher"
rust-version = "1.88"

[workspace.dependencies]
# ----- local crates -----
shared = { path = "./crates/shared", version = "0.0.0"}
account = { path = "./crates/account", version = "0.0.0"}
config = { path = "./crates/config", version = "0.0.0"}
download = { path = "./crates/download", version = "0.0.0"}
folder = { path = "./crates/folder", version = "0.0.0"}
# game_data = { path = "./crates/game_data", version = "0.0.0"}
install = { path = "./crates/install", version = "0.0.0"}
instance = { path = "./crates/instance", version = "0.0.0"}
launch = { path = "./crates/launch", version = "0.0.0"}
platform = { path = "./crates/platform", version = "0.0.0"}
task = { path = "./crates/task", version = "0.0.0"}
version = { path = "./crates/version", version = "0.0.0"}

# NOTE: local crates that aren't published to crates.io. These should not have versions.

# ----- non-local crates -----
tauri = { version = "2", features = ["unstable"] }
tauri-plugin-http = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

...
```
这里面的 `workspace.dependencies` 定义了整个项目使用的依赖，在每个子 crate 里只需要添加 `xxx.workspace = true` 就可以了，这样就能做到整个项目使用同一个版本的依赖了。

移动文件后，还需要为每个 crate 添加 Cargo.toml，包名就写以前的模块名就好了，然后项目结构变成这样：

```
conic-launcher/
├── Cargo.toml
├── package.json
├── src/
│   └── ...
├── core/                # Tauri 主程序
│   ├── Cargo.toml
│   └── src/
│       └── main.rs           # 负责插件注册、窗口初始化、setup 等
├── crates/
│   ├── config/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── install/
│   │   ├── Cargo.toml
│   │   └── src
│   │       ├── forge/
│   │       ├── fabric/
│   │       ├── quilt/
│   │       ├── ...
│   │       └── lib.rs
│   ├── account/
│   ├── launch/
│   ├── utils/
│   └── ...
```
然后我们需要为每个 crate 添加 `init` 函数，用来初始化插件：
```rust
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("config")
        .invoke_handler(tauri::generate_handler![
            cmd_load_config_file,
            cmd_save_config
        ])
        .build()
}
```
然后把所有 `use` 改一下就好了
### 处理报错

#### 循环依赖

首先我遇到的错误是这个：

```log
error: cyclic package dependency: package config v0.0.0 (/home/oakchaser/Desktop/conic-launcher/crates/config) depends on itself. Cycle:
package config v0.0.0 (/home/oakchaser/Desktop/conic-launcher/crates/config)
... which satisfies path dependency config (locked to 0.0.0) of package conic-launcher v0.0.0 (/home/oakchaser/Desktop/conic-launcher/src-tauri)
... which satisfies path dependency conic-launcher (locked to 0.0.0) of package config v0.0.0 (/home/oakchaser/Desktop/conic-launcher/crates/config)
```
这显然是平常不注意项目结构导致的，主包中有一个全局状态的结构体，其中用到了`config` 包里的结构体，而 `config` 包又依赖主包的这个全局状态，所以造成了循环依赖，而在 Rust 项目中，包与包之间的依赖关系是不允许这样的，于是编译器报错。

我这里的解决办法是：不再使用那个全局状态，因为我发现根本没必要，状态已经由前端通过 Pinia 管理了。

还有一些地方，我让主包提供一个全局的 `MAIN_WINDOW`，方便后端主动向前端发送消息，这些我都把它们移动到一个叫 `shared` 的 crate 里了，这也算一种解决办法

#### command 宏报错

使用 `invoke_handler` 注册插件命令后，原先 `#[tauri::command]` 的地方编译器报错：

```log
error[E0255]: the name `__cmd__load_config_file` is defined
 multiple times
  --> crates/config/src/lib.rs:26:8
   |                                                       25 | #[command]                                               | ---------- previous definition of the macro `__cmd__load_config_file` here
26 | pub fn load_config_file() -> Config {
   |        ^^^^^^^^^^^^^^^^ `__cmd__load_config_file` reim
ported here
   |
   = note: `__cmd__load_config_file` must be defined only o
nce in the macro namespace of this module
```
可是只有一处 `load_config_file` 呀，搜索了一下发现了这个：<https://github.com/tauri-apps/tauri/discussions/4665>
所以前面不能有 `pub`，但是其他模块需要这些函数，于是我重新封装了这些命令：
```rust
#[command]
fn cmd_load_config_file() -> Config {
    load_config_file()
}
```

#### 权限问题

接下来我尝试在前端调用这些命令，这里前端 `invoke` 函数中的命令名称需要改成 `plugin:<插件名>|<函数名>`，然后 Web 开发工具中出现了这样的报错：

```log
Unhandled Promise Rejection: config.cmd_load_config_file not allowed. Plugin not found
```
这是因为在 Tauri 中，前端使用插件提供的命令需要手动允许权限，但是这样的话每个插件 crate 都需要有一个 `build.rs` 文件，而这个文件又要求插件必须有 `package.json`，但这样就太复杂了，有没有简单一点的方法呢？于是我找到了这个：<https://github.com/tauri-apps/tauri/discussions/9337>

这里面说，可以把主 `crate` 的 `build.rs` 改一下，在里面声明内联插件，而插件 crate 里面不需要 `build.rs`。主包的 `build.rs` 我改成了这样：

```rust
use tauri_build::InlinedPlugin;

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .plugin(
                "config",
                InlinedPlugin::new().commands(&["cmd_load_config_file", "cmd_save_config"]),
            )
            .plugin(
                "account",
                InlinedPlugin::new().commands(&[
                    "cmd_list_accounts",
                    "cmd_get_account_by_uuid",
                    "cmd_add_microsoft_account",
                    "cmd_delete_accout",
                ]),
            )
            // 继续注册其他插件
    )
    .unwrap();
}
```
这样就能自动生成权限文件了

### 封装 Typescript API

既然项目已经拆分开了，那前端部分也拆开好了。我在每个需要暴露接口给前端的 crate 里面创建 index.ts，然后修改了 `tsconfig.app.json`：

```json
{
    "extends": "@vue/tsconfig/tsconfig.web.json",
    "include": ["env.d.ts", "src/**/*", "src/**/*.vue", "crates/**/*.ts"],
    "exclude": ["src/**/__tests__/*"],
    "compilerOptions": {
        "preserveValueImports": false,
        "importsNotUsedAsValues": "remove",
        "verbatimModuleSyntax": false,
        "ignoreDeprecations": "5.0",
        "composite": true,
        "baseUrl": ".",
        "paths": {
            "@/*": ["./src/*"],
            "@conic/config": ["./crates/config"],
            "@conic/account": ["./crates/account"],
            "@conic/install": ["./crates/install"],
            "@conic/instance": ["./crates/instance"]
        }
    },
    "lib": ["esnext", "dom"]
}
```

然后修改 `vite.config.ts`
```typescript
import { fileURLToPath, URL } from "node:url"

import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import vueDevTools from "vite-plugin-vue-devtools"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue(), vueJsx(), vueDevTools()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@conic": fileURLToPath(new URL("./crates", import.meta.url)),
        },
    },
    build: {
        minify: "esbuild",
        target: "chrome89",
    },
})
```
这样在前端的 Typescript 代码中就可以这样引入后端暴露的 API 了：

```typescript
import { loadConfigFile } from "@conic/config"
```
而且不需要每个 crate 里面都加一个 `package.json`。

## 收获

- 前端实现了类型安全。在以前，调用后端命令使用 `invoke` 函数，用字符串表示后端函数名，编辑器不给提示所以很容易写错，现在写着更顺手了
- `main` 函数里的那一大坨注册命令的可以去掉了，优雅了许多
- 各个模块之间的依赖关系不再混乱了，实现了解耦
- `rust-analyzer` 好像变快了
- ~~可以水一篇文章了~~
