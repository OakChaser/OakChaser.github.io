---
title: "在 Neovim 0.11 中配置 LSP"
description:
    - Neovim 0.11 更新后，简化了lsp配置流程，不再需要 nvim-lspconfig。本文通过实际配置，介绍如何启用 LSP 客户端、安装语言服务器、配置诊断提示与快捷键。
author: "OakChaser"
minutes: 20
date: "2025-07-30"
tags:
    - Technical
    - Tutor
    - Neovim
---

Neovim 0.11 极大地简化了 LSP 配置。本文将带你一步步在 Neovim 0.11 中启用 LSP。

有关更多信息，请查阅 [Neovim 官方文档](https://neovim.io/doc/user/lsp.html)，本文只是对它的个人理解，本人才疏学浅，不当之处还请斧正。

## 1. 什么是 LSP

如果你已经知道这是什么，请直接看下一部分。

LSP 的全称是 Language Server Protocol，它是一个协议，定义了语言服务器应该如何与客户端交流。如果没有 LSP，语言提供者就不得不为每一个编辑器都编写一个插件，由于编辑器不同，他们不得不为每个编辑器实现一套这样的逻辑，每个编辑器同样需要自己实现一套协议。LSP出现后，每个编辑器只需要实现LSP的所有功能，语言提供者只需要编写一个语言服务器，就可以兼容所有编辑器。

其中，服务器负责接收编辑器的命令，并将结果返回给编辑器，LSP 在这里就规定了编辑器发送命令的方式，以及服务器进行回应的方式。

我们看个例子，这里假设你的编辑器就是客户端：当你想跳转到某处，就像你在VS Code里按住Ctrl点击某个东西时那样，你的编辑器会问服务器这个东西的引用在哪里，请求看起来长这样：

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "textDocument/definition",
    "params": {
        "textDocument": {
            "uri": "file:///home/user/project/main.py"
        },
        "position": {
            "line": 42,
            "character": 10
        }
    }
}
```

然后，语言服务器会进行一系列处理，并返回它的位置。响应看起来像这样：

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "uri": "file:///home/user/project/lib/utils.py",
        "range": {
            "start": { "line": 5, "character": 0 },
            "end": { "line": 5, "character": 12 }
        }
    }
}
```

然后，编辑器处理这个响应，执行跳转操作。

LSP 是一个通用的协议，因此任何实现 LSP 的编辑器都可以像这样与语言服务器交流，实现该协议的语言服务器也可以被用作任何实现此协议的编辑器。

## 2. 基本配置

我们首先要配置基本的功能，例如一些快捷键，以及自动高亮。**确保你已经安装 Telescope 插件**

创建 `~/.config/nvim/lua/lsp.lua` 并写入以下内容（改自[Kickstart](https://github.com/nvim-lua/kickstart.nvim)）：

```lua
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("lsp-attach", { clear = true }),
  callback = function(event)
    local map = function(keys, func, desc, mode)
      mode = mode or "n"
      vim.keymap.set(mode, keys, func, { buffer = event.buf, desc = "LSP: " .. desc })
    end
    -- 设置一些快捷键，你可以使用这些快捷键进行LSP有关的操作
    -- 你需要安装 Telescope
    map("grn", vim.lsp.buf.rename, "[R]ename")
    map("grs", require("telescope").extensions.aerial.aerial, "LSP Symbols")
    map("gra", vim.lsp.buf.code_action, "[G]oto Code [A]ction", { "n", "x" })
    map("grr", require("telescope.builtin").lsp_references, "[G]oto [R]eferences")
    map("gri", require("telescope.builtin").lsp_implementations, "[G]oto [I]mplementation")
    map("grd", require("telescope.builtin").lsp_definitions, "[G]oto [D]efinition")
    map("grD", vim.lsp.buf.declaration, "[G]oto [D]eclaration")
    map("gO", require("telescope.builtin").lsp_document_symbols, "Open Document Symbols")
    map("grw", require("telescope.builtin").lsp_dynamic_workspace_symbols, "Open Workspace Symbols")
    map("grt", require("telescope.builtin").lsp_type_definitions, "[G]oto [T]ype Definition")
    map("grh", vim.lsp.buf.hover, "Hover")
    local function client_supports_method(client, method, bufnr) return client:supports_method(method, bufnr) end

    -- 自动高亮你光标下内容的引用，并在光标移动时清除
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if
      client
      and client_supports_method(client, vim.lsp.protocol.Methods.textDocument_documentHighlight, event.buf)
    then
      local highlight_augroup = vim.api.nvim_create_augroup("lsp-highlight", { clear = false })
      vim.api.nvim_create_autocmd({ "CursorHold", "CursorHoldI" }, {
        buffer = event.buf,
        group = highlight_augroup,
        callback = vim.lsp.buf.document_highlight,
      })

      vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
        buffer = event.buf,
        group = highlight_augroup,
        callback = vim.lsp.buf.clear_references,
      })

      vim.api.nvim_create_autocmd("LspDetach", {
        group = vim.api.nvim_create_augroup("lsp-detach", { clear = true }),
        callback = function(event2)
          vim.lsp.buf.clear_references()
          vim.api.nvim_clear_autocmds {
            group = "lsp-highlight",
            buffer = event2.buf,
          }
        end,
      })
    end

    -- 创建一个快捷键，以便切换是否启用 Inlay Hints（如果可用）
    if client and client_supports_method(client, vim.lsp.protocol.Methods.textDocument_inlayHint, event.buf) then
      vim.lsp.inlay_hint.enable(true) -- 默认启用，你可以把它改为false
      vim.keymap.set("n", "<leader>uh", function()
        vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled { bufnr = event.buf })
        if vim.lsp.inlay_hint.is_enabled { bufnr = event.buf } then
          vim.notify("Inlay hints: " .. "ON")
        else
          vim.notify("Inlay hints: " .. "OFF")
        end
      end, { desc = "Toggle Inlay Hints" })
    end
  end,
})

-- 诊断信息设置
-- 查看 :help vim.diagnostic.Opts
vim.diagnostic.config {
  severity_sort = true,
  float = { border = "rounded", source = "if_many" },
  underline = { severity = vim.diagnostic.severity.ERROR },
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = " ", -- 这里配置“错误”的图标，需要nerd font字体
      [vim.diagnostic.severity.WARN] = " ",
      [vim.diagnostic.severity.INFO] = " ",
      [vim.diagnostic.severity.HINT] = " ",
    },
  },
  virtual_text = {
    source = "if_many",
    spacing = 2,
    format = function(diagnostic)
      local diagnostic_message = {
        [vim.diagnostic.severity.ERROR] = diagnostic.message,
        [vim.diagnostic.severity.WARN] = diagnostic.message,
        [vim.diagnostic.severity.INFO] = diagnostic.message,
        [vim.diagnostic.severity.HINT] = diagnostic.message,
      }
      return diagnostic_message[diagnostic.severity]
    end,
  },
}

-- 下面这一堆是跳转到诊断信息的快捷键
vim.keymap.set(
  "n",
  "[h",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.HINT, count = -1 } end,
  { desc = "Previous hint" }
)
vim.keymap.set(
  "n",
  "]h",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.HINT, count = 1 } end,
  { desc = "Next hint" }
)
vim.keymap.set(
  "n",
  "[i",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.INFO, count = -1 } end,
  { desc = "Previous info" }
)
vim.keymap.set(
  "n",
  "]i",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.INFO, count = 1 } end,
  { desc = "Next info" }
)
vim.keymap.set(
  "n",
  "[w",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.WARN, count = -1 } end,
  { desc = "Previous warning" }
)
vim.keymap.set(
  "n",
  "]w",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.WARN, count = 1 } end,
  { desc = "Next warning" }
)
vim.keymap.set(
  "n",
  "[e",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.ERROR, count = -1 } end,
  { desc = "Previous error" }
)
vim.keymap.set(
  "n",
  "]e",
  function() vim.diagnostic.jump { severity = vim.diagnostic.severity.ERROR, count = 1 } end,
  { desc = "Next error" }
)

-- 当光标处有诊断信息时自动显示vim.api.nvim_create_autocmd("CursorHold", {
  pattern = "*",
  callback = function()
    vim.diagnostic.open_float(nil, {
      focusable = false,
      close_events = { "CursorMoved", "CursorMovedI", "BufHidden", "InsertCharPre" },
      border = "rounded",
      scope = "cursor",
    })
  end,
})

```

在`init.lua`中，加入这一行：

```lua
require("lsp")
```

接下来，你需要一个自动补全插件 [blink.cmp](https://github.com/Saghen/blink.cmp),和内置的相比，它有更智能的排序，以及更快的响应。下面给出我的配置，你可以按照官方文档自行配置，使它更贴合自己的使用习惯，这里推荐观看[帕特里柯基的视频](https://www.bilibili.com/video/BV1gDETzTEoo)。

```lua
-- Lua/plugins/blink-cmp.lua
local function has_words_before()
  local line, col = (unpack or table.unpack)(vim.api.nvim_win_get_cursor(0))
  return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match "%s" == nil
end

return {
  "Saghen/blink.cmp",
  dependencies = {
    "xzbdmw/colorful-menu.nvim",
    "rafamadriz/friendly-snippets",
  },
  version = "1.*",
  event = { "InsertEnter", "CmdlineEnter" },
  opts = {
    keymap = {
      ["<Up>"] = { "select_prev", "fallback" },
      ["<Down>"] = { "select_next", "fallback" },
      ["<C-U>"] = { "scroll_documentation_up", "fallback" },
      ["<C-D>"] = { "scroll_documentation_down", "fallback" },
      ["<C-e>"] = { "hide", "fallback" },
      ["<CR>"] = { "accept", "fallback" },
      ["<Tab>"] = {
        "snippet_forward",
        "select_next",
        function(cmp)
          if has_words_before() or vim.api.nvim_get_mode().mode == "c" then return cmp.show() end
        end,
        "fallback",
      },
      ["<S-Tab>"] = {
        "select_prev",
        "snippet_backward",
        function(cmp)
          if vim.api.nvim_get_mode().mode == "c" then return cmp.show() end
        end,
        "fallback",
      },
    },

    completion = {
      list = { selection = { preselect = false } },
      documentation = { auto_show = true },
      menu = {
        border = "rounded",
        draw = {
          columns = { { "kind_icon" }, { "label", gap = 1 } },
          components = {
            label = {
              text = function(ctx) return require("colorful-menu").blink_components_text(ctx) end,
              highlight = function(ctx) return require("colorful-menu").blink_components_highlight(ctx) end,
            },
          },
        },
      },
    },
    signature = {
      enabled = true,
    },
    cmdline = {
      completion = {
        list = { selection = { preselect = false } },
        menu = {
          auto_show = true,
        },
      },
    },
    sources = {
      default = { "lsp", "path", "snippets", "buffer" },
    },
  },
  opts_extend = { "sources.default" },
}
```

## 3. Lua 配置

由于我们正在使用Lua，那么就先进行Lua的配置吧。

第一部分中我们讲过LSP的客户端和服务端是干什么的，因此这里的配置分为两部分

### 3.1 客户端配置

将以下内容写入 `~/.config/nvim/lsp/lua_ls.lua`：

```lua
return {
  cmd = { 'lua-language-server' },
  filetypes = { 'lua' },
  root_markers = {
    '.luarc.json',
    '.luarc.jsonc',
    '.luacheckrc',
    '.stylua.toml',
    'stylua.toml',
    'selene.toml',
    'selene.yml',
    '.git',
  },
}
```

这里的 `cmd` 就是语言服务器的可执行文件。在 0.11 版本中，我们不再需要 [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) 插件，但你还可以直接照抄里面的配置。

将以下内容添加到 `~/.config/nvim/lua/lsp.lua` 以告诉Neovim你要启用这个配置：

```lua
vim.lsp.enable('lua_ls')
```

刚刚 `lsp` 文件夹内的文件名是 `lua_ls.lua`，因此这里 `enable` 后面的参数是 `lua_ls` 。

### 3.2 服务端配置

这里需要安装三个插件，示例配置（改自[Kickstart](https://github.com/nvim-lua/kickstart.nvim)）：

```lua
  {
    "mason-org/mason.nvim",
    event = "VeryLazy",
    keys = {
      {
        "<leader>M",
        "<cmd>Mason<cr>",
        desc = "Open Mason",
      },
    },
    opts = {
      ui = {
        icons = {
          package_installed = "●",
          package_pending = "○",
          package_uninstalled = "○",
        },
      },
    },
  },
  {
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    event = "VeryLazy",
  },
  {
    "mason-org/mason-lspconfig.nvim",
    event = "VeryLazy",
    config = function()
      local capabilities = require("blink.cmp").get_lsp_capabilities()

      -- Enable the following language servers
      --  Feel free to add/remove any LSPs that you want here. They will automatically be installed.
      --
      --  Add any additional override configuration in the following tables. Available keys are:
      --  - cmd (table): Override the default command used to start the server
      --  - filetypes (table): Override the default list of associated filetypes for the server
      --  - capabilities (table): Override fields in capabilities. Can be used to disable certain LSP features.
      --  - settings (table): Override the default settings passed when initializing the server.
      --        For example, to see the options for `lua_ls`, you could go to: https://luals.github.io/wiki/settings/
      local servers = {
        lua_ls = {},
      }
      local formatting_tools = {
        "stylua",
      }
      local ensure_installed = vim.list_extend(vim.tbl_keys(servers), formatting_tools)
      ensure_installed = vim.list_extend(ensure_installed, dap)
      require("mason").setup {}
      require("mason-lspconfig").setup {
      automatic_installation = false,
        automatic_enable = {
          "lua_ls",
        },
        handlers = {
          function(server_name)
            local server = servers[server_name] or {}
            -- This handles overriding only values explicitly passed
            -- by the server configuration above. Useful when disabling
            -- certain features of an LSP (for example, turning off formatting for ts_ls)
            server.capabilities = vim.tbl_deep_extend("force", {}, capabilities, server.capabilities or {})
            vim.lsp.config(server_name, server)
          end,
        },
      }
      require("mason-tool-installer").setup {
        ensure_installed = ensure_installed,
        run_on_start = false,
        start_delay = 0,
      }
      vim.cmd "MasonToolsUpdate"
    end,
  },
```

需要注意其中 `servers` 变量，你可以覆盖服务器的默认设置。插件会自动安装其中 `servers`, `formatting_tools`, `dap` 三个变量里面的工具，之后配置其他语言时，你可以自己往里添加。

然后重启你的 Neovim。重启后，运行 `:Mason`，查看lsp服务器安装状态

### 3.3 lazydev 插件（可选）

现在虽然 LSP 已经能用了，但是有一堆 undefined，自动补全也不支持 Neovim 自带的函数。[lazydev](https://github.com/folke/lazydev.nvim) 插件可以为lua语言提供这些功能，其他有些语言也有相应的功能增强插件，比如 [mrcjkb/rustaceanvim](https://github.com/mrcjkb/rustaceanvim) 用于 Rust 语言。

> [!NOTE]
> 如果使用此插件，请删除 `lsp.lua` 中的 `vim.lsp.enable('lua_ls')`，因为插件会自动调用这个函数.

示例配置：

```lua
{
  "folke/lazydev.nvim",
  ft = "lua",
  opts = {
    library = {
      -- Load luvit types when the `vim.uv` word is found
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
    },
  },
}
```

### 3.4 注意事项

- 如果遇到问题，请先尝试 `:checkhealth vim.lsp`，查看配置是否出错
- 如果使用 lazydev 插件，请删除 `lsp.lua` 中的 `vim.lsp.enable('lua_ls')`，因为插件会自动调用这个函数

之后可能再出一篇教程，讲讲如何配置vue和rust。[我的配置仓库](https://github.com/OakChaser/nvim-config)

<p style="text-align: center">
希望这篇文章能帮到你~
</p>
