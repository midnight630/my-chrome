const DEFAULT_MAX_IMAGES = 500
const DEFAULT_MAX_SCAN_NODES = 2500
const DEFAULT_MIN_IMAGE_SIZE = 40

export const IMAGE_SELECTOR = [
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

export function collectPageImages(options = {}) {
  const context = createCollectContext(options)
  const nodes = new Set(context.document.querySelectorAll(IMAGE_SELECTOR))
  const walker = context.document.createTreeWalker(
    context.document.body,
    NodeFilter.SHOW_ELEMENT
  )
  let scanned = 0

  while (walker.nextNode() && scanned < context.maxScanNodes) {
    scanned += 1

    const node = walker.currentNode
    if (!(node instanceof Element)) continue

    const backgroundImage = context.window.getComputedStyle(node).backgroundImage
    if (backgroundImage && backgroundImage !== 'none') {
      nodes.add(node)
    }
  }

  return collectImagesFromNodes(nodes, 'page', context)
}

export function collectRelatedImages(target, options = {}) {
  const context = createCollectContext(options)
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

  return collectImagesFromNodes(nodes, 'picked', context)
}

export function getImageRelatedTarget(target) {
  if (!(target instanceof Element)) return null

  if (target instanceof HTMLImageElement) return target

  return target.closest('img, picture, [style*="background-image"]')
}

function createCollectContext(options) {
  return {
    document: options.document || document,
    window: options.window || window,
    maxImages: options.maxImages || DEFAULT_MAX_IMAGES,
    maxScanNodes: options.maxScanNodes || DEFAULT_MAX_SCAN_NODES,
    minImageSize: options.minImageSize || DEFAULT_MIN_IMAGE_SIZE
  }
}

function collectImagesFromNodes(nodes, source, context) {
  const images = []
  const seen = new Set()

  for (const node of nodes) {
    if (images.length >= context.maxImages) break

    const candidates = extractImageCandidates(node, context)

    for (const candidate of candidates) {
      if (images.length >= context.maxImages) break

      const normalizedUrl = normalizeImageUrl(candidate.url, context)
      if (!normalizedUrl || seen.has(normalizedUrl)) continue
      if (
        candidate.width < context.minImageSize &&
        candidate.height < context.minImageSize
      ) {
        continue
      }

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

function extractImageCandidates(node, context) {
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
    return Array.from(node.querySelectorAll('source, img')).flatMap((child) =>
      extractImageCandidates(child, context)
    )
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
      getBackgroundImageUrl(node, context),
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

function getBackgroundImageUrl(element, context) {
  const backgroundImage = context.window.getComputedStyle(element).backgroundImage
  const match = backgroundImage.match(/url\(["']?(.+?)["']?\)/)
  return isLikelyImageUrl(match?.[1]) ? match[1] : ''
}

function isLikelyImageUrl(url) {
  if (!url) return false
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('blob:')) return true

  return /^https?:\/\//.test(url) || url.startsWith('//') || url.startsWith('/')
}

function normalizeImageUrl(url, context) {
  if (!url) return ''
  if (url.startsWith('data:image/') || url.startsWith('blob:')) return url

  try {
    return new URL(url, context.window.location.href).href
  } catch (_error) {
    return ''
  }
}
