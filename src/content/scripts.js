import {
  collectPageImages,
  collectRelatedImages,
  getImageRelatedTarget
} from '../shared/imageCollector.js'

export default function initial() {
  const cleanupImageBridge = setupImageBridge()

  return () => {
    cleanupImageBridge()
  }
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
