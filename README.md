# 识趣图片

识趣图片是一个基于 Extension.js 的浏览器扩展项目，目标是辅助识别社交媒体网页中的图片内容。目前项目保留了基础扩展骨架：网页悬浮按钮、后台消息处理、浏览器侧边栏打开能力，以及一个可继续开发的侧边栏页面入口。

当前侧边栏业务逻辑还未实现，新页面逻辑从 `src/sidebar/SidebarApp.js` 开始编写。

## 当前功能

- 在匹配页面中注入一个“打开侧边栏”按钮。
- 点击页面按钮后，通过 background 打开浏览器侧边栏。
- 点击浏览器扩展图标时，也可以打开侧边栏。
- Chromium 使用 `chrome.sidePanel`。
- Firefox 使用 `browser.sidebarAction`。

## 技术栈

- JavaScript ES Modules
- Extension.js
- Chrome Manifest V3
- Firefox Manifest V2 兼容声明

## 环境要求

项目要求 Node.js `>=22.12.0`，仓库内已提供 `.nvmrc`：

```bash
nvm use
```

当前推荐版本：

```text
22.23.1
```

## 安装依赖

```bash
npm install
```

## 开发

默认开发命令会启动 Extension.js dev server，生成支持热更新的 Chromium 开发目录：

```bash
npm run dev
```

然后在 Chrome 中手动加载开发目录：

```text
dist/chromium
```

加载方式：

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目下的 `dist/chromium`

开发时保持 `npm run dev` 运行。修改 `src` 下的源码后，Extension.js 会重新编译到 `dist/chromium`。

## 自动打开浏览器

如果希望 Extension.js 自动打开独立 Chrome 并加载扩展，可以先安装托管浏览器：

```bash
npm run dev:install-browser
```

然后运行：

```bash
npm run dev:auto
```

如果想使用本机 Chrome，可以尝试：

```bash
npm run dev:system
```

macOS 上如果普通 Chrome 已经运行，系统 Chrome 可能不会正确接收开发参数；这种情况下建议使用默认的 `npm run dev`，再手动加载 `dist/chromium`。

## 构建

构建 Chromium 生产版本：

```bash
npm run build
```

构建指定浏览器版本：

```bash
npm run build:chrome
npm run build:firefox
npm run build:edge
```

生产构建输出在 `dist` 目录。注意：生产构建目录不提供热更新。

## 目录结构

```text
src/
  manifest.json              扩展声明、权限、入口配置
  background.js              后台脚本，负责打开侧边栏
  content/
    scripts.js               content script 入口，注入页面按钮
    ContentApp.js            页面悬浮按钮逻辑
    styles.css               页面悬浮按钮样式
  sidebar/
    index.html               侧边栏 HTML 入口
    scripts.js               侧边栏 JS 入口和 HMR 挂载
    SidebarApp.js            侧边栏页面逻辑入口
    styles.css               侧边栏基础样式
  images/
    icon.png                 扩展图标
```

## 主要开发入口

侧边栏页面：

```text
src/sidebar/SidebarApp.js
```

网页按钮：

```text
src/content/ContentApp.js
```

打开侧边栏逻辑：

```text
src/background.js
```

## 注意事项

- `dist/chromium` 是开发模式常用加载目录。
- `dist/chrome` 是 Chrome 生产构建目录，不适合用来观察热更新。
- `node_modules` 和 `dist` 已在 `.gitignore` 中忽略，不需要提交。
