import './styles.css'
import createSidebarApp from './SidebarApp.js'

function renderSidebar() {
  createSidebarApp()
}

renderSidebar()

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./SidebarApp.js', () => {
    const root = document.getElementById('root')
    if (root) root.innerHTML = ''
    renderSidebar()
  })
}
