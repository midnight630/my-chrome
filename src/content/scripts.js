import createContentApp from './ContentApp.js'
import './styles.css'

const MAX_IMAGES = 500
const MAX_SCAN_NODES = 2500
const MIN_IMAGE_SIZE = 40
const IMAGE_SELECTOR = [
  'img',
  'picture',
  'source[srcset]',
  '[style*="background"]',
  '[data-src]',
  '[data-original]',
  '[data-lazy-src]',
  '[data-actualsrc]',
  '[data-image]',
  '[data-url]'
].join(',')

export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  rootDiv.style.cssText = 'all: initial !important'
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then((response) => (styleElement.textContent = response))
  shadowRoot.appendChild(createContentApp())

  const cleanupImageBridge = setupImageBridge()

  return () => {
    cleanupImageBridge()
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}

function setupImageBridge() {
  let cleanupPickMode = null

  const handleMessage = (message, _sender, sendResponse) => {
    if (!message || !message.type) return

    if (message.type === 'scanPageImages') {
      sendResponse({
        ok: true,
        images: collectPageImages()
      })
      return
    }

    if (message.type === 'startImagePick') {
      cleanupPickMode?.()
      cleanupPickMode = startImagePickMode(sendResponse)
      return true
    }

    if (message.type === 'cancelImagePick') {
      cleanupPickMode?.({notify: true})
      cleanupPickMode = null
      sendResponse({ok: true})
      return
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage)

  return () => {
    cleanupPickMode?.()
    chrome.runtime.onMessage.removeListener(handleMessage)
  }
}

function startImagePickMode(sendResponse) {
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: fixed',
    'z-index: 2147483647',
    'pointer-events: none',
    'border: 2px solid #22c55e',
    'background: rgba(34, 197, 94, 0.12)',
    'box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.12)',
    'display: none'
  ].join(';')
  document.documentElement.appendChild(overlay)

  const updateOverlay = (target) => {
    const rect = target.getBoundingClientRect()
    overlay.style.display = 'block'
    overlay.style.left = `${rect.left}px`
    overlay.style.top = `${rect.top}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
  }

  const handleMove = (event) => {
    const target = getImageRelatedTarget(event.target)
    if (!target) {
      overlay.style.display = 'none'
      return
    }

    updateOverlay(target)
  }

  const handleClick = (event) => {
    const target = getImageRelatedTarget(event.target)
    if (!target) return

    event.preventDefault()
    event.stopPropagation()

    const images = collectRelatedImages(target)
    cleanup()
    sendResponse({ok: true, images})
  }

  const handleKeydown = (event) => {
    if (event.key !== 'Escape') return

    cleanup()
    sendResponse({ok: false, error: '已取消点选'})
  }

  let cleaned = false

  const cleanup = (options = {}) => {
    if (cleaned) return
    cleaned = true

    overlay.remove()
    document.removeEventListener('mousemove', handleMove, true)
    document.removeEventListener('click', handleClick, true)
    document.removeEventListener('keydown', handleKeydown, true)

    if (options.notify) {
      sendResponse({ok: false, error: '已取消点选'})
    }
  }

  document.addEventListener('mousemove', handleMove, true)
  document.addEventListener('click', handleClick, true)
  document.addEventListener('keydown', handleKeydown, true)

  return cleanup
}

function getImageRelatedTarget(target) {
  if (!(target instanceof Element)) return null

  if (target instanceof HTMLImageElement) return target

  return target.closest('img, picture, [style*="background-image"]')
}

function collectRelatedImages(target) {
  const nodes = new Set()
  let current = target

  for (let depth = 0; current && depth < 4; depth += 1) {
    nodes.add(current)
    current.querySelectorAll?.(IMAGE_SELECTOR).forEach((node) =>
      nodes.add(node)
    )

    current.parentElement?.querySelectorAll?.(IMAGE_SELECTOR).forEach((node) =>
      nodes.add(node)
    )

    current.previousElementSibling
      ?.querySelectorAll?.(IMAGE_SELECTOR)
      .forEach((node) => nodes.add(node))
    current.nextElementSibling
      ?.querySelectorAll?.(IMAGE_SELECTOR)
      .forEach((node) => nodes.add(node))

    current = current.parentElement
  }

  return collectImagesFromNodes(nodes, 'picked')
}

function collectPageImages() {
  const nodes = new Set(document.querySelectorAll(IMAGE_SELECTOR))
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  let scanned = 0

  while (walker.nextNode() && scanned < MAX_SCAN_NODES) {
    scanned += 1

    const node = walker.currentNode
    if (!(node instanceof Element)) continue

    const backgroundImage = window.getComputedStyle(node).backgroundImage
    if (backgroundImage && backgroundImage !== 'none') {
      nodes.add(node)
    }
  }

  return collectImagesFromNodes(nodes, 'page')
}

function collectImagesFromNodes(nodes, source) {
  const images = []
  const seen = new Set()

  for (const node of nodes) {
    if (images.length >= MAX_IMAGES) break

    const candidates = extractImageCandidates(node)

    for (const candidate of candidates) {
      if (images.length >= MAX_IMAGES) break

      const normalizedUrl = normalizeImageUrl(candidate.url)
      if (!normalizedUrl || seen.has(normalizedUrl)) continue
      if (candidate.width < MIN_IMAGE_SIZE && candidate.height < MIN_IMAGE_SIZE) continue

      seen.add(normalizedUrl)
      images.push({
        ...candidate,
        url: normalizedUrl,
        source,
        index: images.length + 1
      })
    }
  }

  return images
}

function extractImageCandidates(node) {
  if (node instanceof HTMLImageElement) {
    const rect = node.getBoundingClientRect()
    return getImageUrls(node).map((url) => ({
      url,
      alt: node.alt || '',
      width: Math.round(node.naturalWidth || rect.width),
      height: Math.round(node.naturalHeight || rect.height)
    }))
  }

  if (node instanceof HTMLPictureElement) {
    return Array.from(node.querySelectorAll('source, img')).flatMap(extractImageCandidates)
  }

  if (node instanceof HTMLSourceElement) {
    return parseSrcset(node.srcset).map((url) => ({
      url,
      alt: '',
      width: 0,
      height: 0
    }))
  }

  if (node instanceof Element) {
    const urls = [
      getBackgroundImageUrl(node),
      ...getLazyImageUrls(node)
    ].filter(Boolean)

    const rect = node.getBoundingClientRect()
    return urls.map((url) => ({
      url,
      alt: node.getAttribute('aria-label') || '',
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }))
  }

  return []
}

function getImageUrls(image) {
  return [
    image.currentSrc,
    image.src,
    ...parseSrcset(image.srcset),
    ...getLazyImageUrls(image)
  ].filter(Boolean)
}

function getLazyImageUrls(element) {
  return [
    element.getAttribute('data-src'),
    element.getAttribute('data-original'),
    element.getAttribute('data-lazy-src'),
    element.getAttribute('data-actualsrc'),
    element.getAttribute('data-image'),
    element.getAttribute('data-url')
  ].filter(isLikelyImageUrl)
}

function parseSrcset(srcset) {
  if (!srcset) return []

  return srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(isLikelyImageUrl)
}

function getBackgroundImageUrl(element) {
  const backgroundImage = window.getComputedStyle(element).backgroundImage
  const match = backgroundImage.match(/url\(["']?(.+?)["']?\)/)
  return isLikelyImageUrl(match?.[1]) ? match[1] : ''
}

function isLikelyImageUrl(url) {
  if (!url) return false
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('blob:')) return true

  return /^https?:\/\//.test(url) || url.startsWith('//') || url.startsWith('/')
}

function normalizeImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:image/') || url.startsWith('blob:')) return url

  try {
    return new URL(url, window.location.href).href
  } catch (_error) {
    return ''
  }
}
