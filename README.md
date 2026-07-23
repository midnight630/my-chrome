<a href="https://extension.js.org" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/Powered%20by%20%7C%20Extension.js-0971fe" alt="Powered by Extension.js" align="right" /></a>

# my-chrome

> 识别社交媒体里，目前支持电脑网页直登的抖音/小红书评论区里的无水印图片。

这是一个基于 Extension.js 的浏览器扩展项目。当前保留了打开侧边栏的基础链路，侧边栏页面逻辑可以从 `src/sidebar/SidebarApp.js` 开始继续开发。

![screenshot](./public/screenshot.png)

## Commands

### dev

启动开发模式，生成可热更新的 Chromium 开发目录：

```bash
nvm use
npm run dev
```

然后在 Chrome 的 `chrome://extensions/` 中手动加载：

```text
dist/chromium
```

### build

构建生产版本：

```bash
npm run build           # Chrome (default)
npm run build:firefox
npm run build:edge
```

### preview

Preview the production build in the browser:

```bash
npm run preview
```

## Learn more

[Extension.js docs](https://extension.js.org).
