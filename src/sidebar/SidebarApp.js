import './styles.css'

export default function createSidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  const app = document.createElement('main')
  app.className = 'sidebar_app'
  app.innerHTML = `<div>232</div>`

  root.replaceChildren(app)

  //  root.innerHTML = `
  //   <div class="sidebar_app">
  //     从这里开始2
  //   </div>
  // `
}
