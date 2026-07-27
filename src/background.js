const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  // Firefox 使用 browserAction/sidebarAction API，和 Chromium 的 sidePanel API 不同。
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
}

if (!isFirefoxLike) {
  // setPanelBehavior 只影响之后的工具栏点击，所以要提前注册。
  // 如果放进 onClicked 里，第一次点击工具栏图标会被吞掉。
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return

  if (message.type === 'downloadImages') {
    downloadImages(message.images || [])
      .then((count) => sendResponse({ok: true, count}))
      .catch((error) => sendResponse({ok: false, error: error.message}))
    return true
  }
})

async function downloadImages(images) {
  if (!chrome.downloads?.download) {
    throw new Error('当前浏览器不支持 downloads API')
  }

  const validImages = images.filter((image) => image?.url)

  for (const [index, image] of validImages.entries()) {
    await chrome.downloads.download({
      url: image.url,
      filename: createImageFilename(image, index),
      saveAs: false
    })
  }

  return validImages.length
}

function createImageFilename(image, index) {
  let extension = image.url.match(/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i)?.[1]

  if (extension) {
    extension = `.${extension.toLowerCase()}`
  }

  if (!extension) {
    try {
      const url = new URL(image.url)
      const pathnameName = decodeURIComponent(url.pathname.split('/').pop() || '')
      extension = pathnameName.match(/\.(avif|gif|jpe?g|png|webp)$/i)?.[0]
    } catch (_error) {
      extension = ''
    }
  }

  const suffix = extension || '.jpg'

  return `shiqu-images/${String(index + 1).padStart(3, '0')}${suffix}`
}
