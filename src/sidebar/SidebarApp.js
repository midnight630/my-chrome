const state = {
  images: [],
  selectedUrls: new Set(),
  previewImageIndex: -1,
  status: '准备查找评论区图片',
  statusTone: 'info',
  activeAction: '',
  busy: false,
  picking: false,
  recognitionEnabled: localStorage.getItem('recognitionEnabled') !== 'false'
}

const MAX_RENDERED_IMAGES = 160

export default function createSidebarApp() {
  bindStaticEvents()
  render()
}

function render() {
  renderStatus()
  renderSelectionCount()
  renderSelectionAction()
  renderImageList()
  renderImagePreview()
  renderRecognitionToggle()
  renderActiveAction()
  syncDisabledState()
}

function renderStatus() {
  const statusText = document.getElementById('status_text')
  if (!statusText) return

  statusText.textContent = state.status
  statusText.dataset.tone = state.statusTone
}

function renderSelectionCount() {
  const selectionCount = document.getElementById('selection_count')
  if (!selectionCount) return

  selectionCount.textContent = `${state.selectedUrls.size} / ${state.images.length} 已选择`
}

function renderSelectionAction() {
  const button = document.getElementById('select_all_button')
  if (!button) return

  const hasImages = state.images.length > 0
  const allSelected = hasImages && state.selectedUrls.size === state.images.length
  button.textContent = allSelected ? '取消全选' : '全选'
}

function renderImageList() {
  const imageList = document.getElementById('image_list')
  if (!imageList) return

  if (!state.recognitionEnabled) {
    imageList.innerHTML = `
      <div class="empty_state">
        识别已关闭。点击“开启识别”后再扫描页面图片。
      </div>
    `
    return
  }

  if (!state.images.length) {
    imageList.innerHTML = `
      <div class="empty_state">
        点击“查找图片”扫描当前页面，或点击“指点图片”后到页面上点选图片区域。
      </div>
    `
    return
  }

  const visibleImages = state.images.slice(0, MAX_RENDERED_IMAGES)
  const hiddenCount = state.images.length - visibleImages.length
  const imageItems = visibleImages
    .map((image, imageIndex) => {
      const checked = state.selectedUrls.has(image.url) ? 'checked' : ''
      const size = image.width && image.height ? `${image.width} x ${image.height}` : '未知尺寸'

      return `
        <div class="image_item">
          <input type="checkbox" aria-label="选择图片" data-url="${escapeAttribute(image.url)}" ${checked} />
          <span class="image_index">${image.index}</span>
          <button
            class="image_preview_button"
            type="button"
            data-preview-index="${imageIndex}"
            aria-label="查看大图"
          >
            <img
              src="${escapeAttribute(image.url)}"
              alt="${escapeAttribute(image.alt || '')}"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />
          </button>
          <span class="image_meta">
            <strong>${escapeHtml(size)}</strong>
            <span>${escapeHtml(image.source === 'picked' ? '点选结构' : '页面扫描')}</span>
          </span>
        </div>
      `
    })
    .join('')

  imageList.innerHTML = `
    ${hiddenCount > 0 ? `<div class="result_notice">为避免占用过多内存，当前仅预览前 ${MAX_RENDERED_IMAGES} 张；下载仍会包含已选结果。</div>` : ''}
    ${imageItems}
  `

  bindImageSelectionEvents(imageList)
}

function bindStaticEvents() {
  if (document.body.dataset.sidebarEventsBound === 'true') return
  document.body.dataset.sidebarEventsBound = 'true'

  document.querySelector('[data-action="scan"]')?.addEventListener('click', scanPageImages)
  document.querySelector('[data-action="pick"]')?.addEventListener('click', startImagePick)
  document.querySelector('[data-action="toggle-recognition"]')?.addEventListener('click', toggleRecognition)
  document.querySelector('[data-action="select-all"]')?.addEventListener('click', selectAllImages)
  document.querySelector('[data-action="clear"]')?.addEventListener('click', clearImages)
  document.querySelector('[data-action="scroll-top"]')?.addEventListener('click', scrollToTop)
  document.querySelector('[data-action="download"]')?.addEventListener('click', downloadSelectedImages)

  document.getElementById('image_preview')?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.matches('[data-action="close-preview"]')) {
      closeImagePreview()
      return
    }

    if (target.matches('[data-action="previous-preview"]')) {
      showPreviousPreviewImage()
      return
    }

    if (target.matches('[data-action="next-preview"]')) {
      showNextPreviewImage()
      return
    }

    if (target.matches('[data-action="download-preview"]')) {
      downloadPreviewImage()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImagePreview()
      return
    }

    if (event.key === 'ArrowLeft') {
      showPreviousPreviewImage()
      return
    }

    if (event.key === 'ArrowRight') {
      showNextPreviewImage()
    }
  })
}

function bindImageSelectionEvents(imageList) {
  imageList.querySelectorAll('.image_item input').forEach((input) => {
    input.addEventListener('change', () => {
      const url = input.dataset.url
      if (!url) return

      if (input.checked) {
        state.selectedUrls.add(url)
      } else {
        state.selectedUrls.delete(url)
      }
      renderSelectionCount()
      renderSelectionAction()
      syncDisabledState()
    })
  })

  imageList.querySelectorAll('.image_preview_button').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.previewIndex)
      if (!Number.isInteger(index)) return

      openImagePreview(index)
    })
  })
}

function renderActiveAction() {
  document.querySelectorAll('.tool_button').forEach((button) => {
    button.classList.toggle('is_active', button.dataset.action === state.activeAction)
  })
}

function renderRecognitionToggle() {
  const button = document.getElementById('recognition_toggle')
  if (!button) return

  button.textContent = state.recognitionEnabled ? '关闭识别' : '开启识别'
  button.classList.toggle('is_off', !state.recognitionEnabled)
}

async function scanPageImages() {
  if (!ensureRecognitionEnabled()) return

  await cancelImagePickIfNeeded()
  state.activeAction = 'scan'

  await runImageTask('正在扫描当前页面图片...', async () => {
    const response = await sendActiveTabMessage({type: 'scanPageImages'})
    applyImages(response.images || [], '已扫描当前页面')
  })
}

async function startImagePick() {
  if (!ensureRecognitionEnabled()) return

  await cancelImagePickIfNeeded()

  state.activeAction = 'pick'
  state.picking = true
  state.busy = false
  updateStatus('请到页面上点击图片所在位置；也可以直接点击“查找图片”取消点选并扫描。', 'info')

  try {
    const response = await sendActiveTabMessage({type: 'startImagePick'})
    applyImages(response.images || [], '已读取点选位置附近的 DOM 图片')
  } catch (error) {
    updateStatus(error.message || '点选失败', 'error')
  } finally {
    state.picking = false
    render()
  }
}

async function downloadSelectedImages() {
  if (!ensureRecognitionEnabled()) return

  const selectedImages = state.images.filter((image) => state.selectedUrls.has(image.url))
  if (!selectedImages.length) {
    updateStatus('请先选择要下载的图片', 'error')
    return
  }

  await runImageTask('正在下载选中的图片...', async () => {
    const response = await sendRuntimeMessage({
      type: 'downloadImages',
      images: selectedImages
    })

    if (!response?.ok) {
      throw new Error(response?.error || '下载失败')
    }

    updateStatus(`已开始下载 ${response.count} 张图片`, 'success')
  })
}

function selectAllImages() {
  if (state.images.length && state.selectedUrls.size === state.images.length) {
    state.selectedUrls.clear()
    updateStatus('已取消全选', 'info')
    return
  }

  state.images.forEach((image) => state.selectedUrls.add(image.url))
  updateStatus(`已选择 ${state.selectedUrls.size} 张图片`, 'success')
}

function clearImages() {
  state.images = []
  state.selectedUrls.clear()
  closeImagePreview()
  updateStatus('已清空图片结果', 'info')
}

async function toggleRecognition() {
  if (state.recognitionEnabled) {
    await cancelImagePickIfNeeded()
    state.recognitionEnabled = false
    state.images = []
    state.selectedUrls.clear()
    closeImagePreview()
    state.activeAction = ''
    state.busy = false
    localStorage.setItem('recognitionEnabled', 'false')
    updateStatus('识别已关闭，不会扫描任何页面', 'error')
    return
  }

  state.recognitionEnabled = true
  localStorage.setItem('recognitionEnabled', 'true')
  updateStatus('识别已开启，可以查找当前页面图片', 'success')
}

function scrollToTop() {
  const imageList = document.getElementById('image_list')
  const root = document.getElementById('root')
  const scrollingElement = document.scrollingElement || document.documentElement

  imageList?.scrollTo({top: 0, behavior: 'smooth'})
  root?.scrollTo?.({top: 0, behavior: 'smooth'})
  scrollingElement?.scrollTo({top: 0, behavior: 'smooth'})
  window.scrollTo({top: 0, behavior: 'smooth'})
}

async function cancelImagePickIfNeeded() {
  if (!state.picking) return

  try {
    await sendActiveTabMessage({type: 'cancelImagePick'})
  } catch (_error) {
    // 页面可能已经刷新或点选监听已消失，侧边栏状态继续复位即可。
  }

  state.picking = false
  render()
}

async function runImageTask(status, task) {
  state.busy = true
  updateStatus(status, 'info')

  try {
    await task()
  } catch (error) {
    updateStatus(error.message || '操作失败', 'error')
  } finally {
    state.busy = false
    state.picking = false
    render()
  }
}

function applyImages(images, status) {
  state.images = images
  state.selectedUrls.clear()
  closeImagePreview()
  updateStatus(`${status}，找到 ${images.length} 张图片`, 'success')
}

function openImagePreview(index) {
  if (!state.images[index]) return

  state.previewImageIndex = index
  renderImagePreview()
}

function closeImagePreview() {
  if (state.previewImageIndex < 0) return

  state.previewImageIndex = -1
  renderImagePreview()
}

function renderImagePreview() {
  const overlay = document.getElementById('image_preview')
  const image = document.getElementById('image_preview_img')
  const caption = document.getElementById('image_preview_caption')
  const counter = document.getElementById('image_preview_counter')
  const previousButton = document.querySelector('[data-action="previous-preview"]')
  const nextButton = document.querySelector('[data-action="next-preview"]')
  const downloadButton = document.querySelector('[data-action="download-preview"]')
  if (!overlay || !image || !caption || !counter) return

  const previewImage = getPreviewImage()

  if (!previewImage) {
    overlay.hidden = true
    image.removeAttribute('src')
    image.alt = ''
    caption.textContent = ''
    counter.textContent = ''
    if (previousButton) previousButton.disabled = true
    if (nextButton) nextButton.disabled = true
    if (downloadButton) downloadButton.disabled = true
    return
  }

  overlay.hidden = false
  image.src = previewImage.url
  image.alt = previewImage.alt || ''
  caption.textContent = previewImage.alt || previewImage.url
  counter.textContent = `${state.previewImageIndex + 1} / ${state.images.length}`
  if (previousButton) previousButton.disabled = state.images.length < 2
  if (nextButton) nextButton.disabled = state.images.length < 2
  if (downloadButton) downloadButton.disabled = false
}

function getPreviewImage() {
  return state.previewImageIndex >= 0 ? state.images[state.previewImageIndex] : null
}

function showPreviousPreviewImage() {
  if (!getPreviewImage() || state.images.length < 2) return

  state.previewImageIndex =
    (state.previewImageIndex - 1 + state.images.length) % state.images.length
  renderImagePreview()
}

function showNextPreviewImage() {
  if (!getPreviewImage() || state.images.length < 2) return

  state.previewImageIndex = (state.previewImageIndex + 1) % state.images.length
  renderImagePreview()
}

async function downloadPreviewImage() {
  const previewImage = getPreviewImage()
  if (!previewImage) return

  try {
    const response = await sendRuntimeMessage({
      type: 'downloadImages',
      images: [previewImage]
    })

    if (!response?.ok) {
      throw new Error(response?.error || '下载失败')
    }

    updateStatus('已开始下载当前图片', 'success')
  } catch (error) {
    updateStatus(error.message || '下载失败', 'error')
  }
}

function updateStatus(status, tone = 'info') {
  state.status = status
  state.statusTone = tone
  render()
}

function ensureRecognitionEnabled() {
  if (state.recognitionEnabled) return true

  updateStatus('识别已关闭，请先点击“开启识别”', 'error')
  return false
}

async function sendActiveTabMessage(message) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true})
  if (!tab?.id) throw new Error('没有找到当前活动页面')

  if (!isScanableUrl(tab.url || tab.pendingUrl || '')) {
    throw new Error('当前页面不支持识别，请切换到普通网页里的抖音或小红书内容页后重试')
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message)
  } catch (error) {
    const text = String(error?.message || error)
    if (text.includes('Could not establish connection')) {
      throw new Error('页面里还没有注入识别脚本，请刷新当前网页后再试')
    }
    throw error
  }
}

function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message)
}

function syncDisabledState() {
  document.querySelectorAll('[data-action="scan"], [data-action="pick"]').forEach((button) => {
    button.disabled = state.busy || !state.recognitionEnabled
  })

  const downloadButton = document.querySelector('[data-action="download"]')
  if (downloadButton) {
    downloadButton.disabled = !state.selectedUrls.size || !state.recognitionEnabled
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}

function isScanableUrl(url) {
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url)
}
