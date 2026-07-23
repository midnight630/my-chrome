const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

// Firefox 使用 browserAction/sidebarAction API，和 Chromium 的 sidePanel API 不同。
if (isFirefoxLike) {
  // 点击浏览器工具栏图标时，直接打开 Firefox 侧边栏。
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })

  // content script 会发送 openSidebar 消息，用来从页面按钮打开侧边栏。
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'openSidebar') return

    browser.sidebarAction.open()
  })
}

if (!isFirefoxLike) {
  // setPanelBehavior 只影响之后的工具栏点击，所以要提前注册。
  // 如果放进 onClicked 里，第一次点击工具栏图标会被吞掉。
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
}

// Chromium 分支：接收页面按钮发来的消息，并打开当前标签页对应的 side panel。
chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'openSidebar') return

  // 确保工具栏图标点击也能打开侧边栏。
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})

  // 旧版 Chromium 可能没有 open 方法，避免直接调用报错。
  if (!chrome.sidePanel.open) return

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTabId = tabs?.[0]?.id
    if (!activeTabId) return

    try {
      // sidePanel.open 需要指定 tabId，表示打开当前活动标签页的侧边栏。
      chrome.sidePanel.open({tabId: activeTabId})
    } catch (error) {
      console.error(error)
    }
  })
})
