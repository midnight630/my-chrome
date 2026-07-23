export default function createContentApp() {
  const container = document.createElement('div')
  container.className = 'content_script'

  const pill = document.createElement('button')
  pill.type = 'button'
  pill.className = 'content_pill'
  pill.setAttribute('aria-label', '打开侧边栏')
  pill.addEventListener('click', () => {
    try {
      if (
        import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
        import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'
      ) {
        browser.runtime.sendMessage({type: 'openSidebar'})
      } else {
        chrome.runtime.sendMessage({type: 'openSidebar'})
      }
    } catch (error) {
      console.error(error)
    }
  })

  const text = document.createElement('span')
  text.className = 'content_pill_text'
  text.textContent = '打开侧边栏'

  pill.appendChild(text)
  container.appendChild(pill)

  return container
}
