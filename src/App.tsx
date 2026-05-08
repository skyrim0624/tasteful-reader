import {
  Bookmark,
  BookOpen,
  Check,
  Highlighter,
  ListFilter,
  Moon,
  PanelRight,
  Search,
  Sun,
  Type,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import './App.css'

type ReadingTheme = 'paper' | 'night'

interface Book {
  id: string
  title: string
  author: string
  category: string
  progress: number
  accent: string
  excerpt: string
  chapters: string[]
}

const books: Book[] = [
  {
    id: 'quiet-craft',
    title: '安静的工艺',
    author: '林川',
    category: '随笔',
    progress: 68,
    accent: '#b75d4a',
    excerpt: '好的界面不是把所有东西都喊出来，而是让重要的东西自然靠近手边。',
    chapters: [
      '早晨的光落在书页上，字的边缘并不锋利。真正耐读的东西，往往先把速度降下来，让眼睛和念头有一段重新对齐的时间。',
      '阅读器的气质来自克制。行宽、灰度、留白、页边距，每一项都不该成为装饰，而应该像一只合适的杯子，让水保持原来的味道。',
      '如果一个工具总在提醒你它很聪明，它就已经离阅读远了一步。好的辅助应当在需要时出现，在不需要时退回背景。',
      '收藏、划线、笔记和搜索都不是炫技。它们只是为了让一个人回到某句话、某个段落、某个突然变清楚的问题。',
    ],
  },
  {
    id: 'city-notes',
    title: '城市慢读',
    author: '季南',
    category: '旅行',
    progress: 42,
    accent: '#2f7f73',
    excerpt: '一座城市最值得读的部分，常常藏在日常动作里。',
    chapters: [
      '地图告诉你街道的形状，散步告诉你城市的句法。转角、雨棚、旧招牌、清晨第一家开门的店，都是段落之间的停顿。',
      '慢读不是慢动作，而是把注意力从目的地移回过程。你开始记得一杯咖啡的温度，也记得坐在窗边的人怎样翻过一页报纸。',
      '旅行笔记真正有用的地方，不是告诉别人该去哪，而是保留当时判断的纹理：为什么停下，为什么绕路，为什么那一刻没有拍照。',
    ],
  },
  {
    id: 'margin-system',
    title: '页边系统',
    author: '周醒',
    category: '设计',
    progress: 15,
    accent: '#5f6f9f',
    excerpt: '版式不是把内容摆满，而是安排沉默如何服务内容。',
    chapters: [
      '页边距是阅读的呼吸。它保护正文不被边界追赶，也保护读者不被屏幕逼近。',
      '字号与行高之间的关系像椅子和桌子的高度。单看任何一个数值都不够，只有组合起来，身体才知道舒不舒服。',
      '真正可靠的系统会允许内容有差异：短句不显得稀薄，长段不显得拥挤，标题不会把正文挤到角落。',
    ],
  },
]

const notes = [
  '把深夜模式的对比度再压低一点。',
  '笔记面板需要支持段落引用。',
  '稍后测试移动端单手阅读。',
]

function App() {
  const [selectedBookId, setSelectedBookId] = useState(books[0].id)
  const [theme, setTheme] = useState<ReadingTheme>('paper')
  const [fontSize, setFontSize] = useState(18)
  const [showNotes, setShowNotes] = useState(true)
  const [focused, setFocused] = useState(false)

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? books[0],
    [selectedBookId],
  )

  return (
    <main className={`reader-app theme-${theme} ${focused ? 'is-focused' : ''}`}>
      <aside className="library-panel" aria-label="书库">
        <div className="brand-row">
          <div className="brand-mark">
            <BookOpen size={20} aria-hidden="true" />
          </div>
          <div>
            <h1>品读器</h1>
            <span>阅读工作台</span>
          </div>
        </div>

        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder="搜索书名、作者、划线" />
        </label>

        <div className="section-heading">
          <span>正在阅读</span>
          <button type="button" aria-label="筛选书库">
            <ListFilter size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="book-list">
          {books.map((book) => (
            <button
              type="button"
              className={`book-item ${book.id === selectedBook.id ? 'is-active' : ''}`}
              key={book.id}
              onClick={() => setSelectedBookId(book.id)}
            >
              <span className="book-cover" style={{ '--cover-accent': book.accent } as CSSProperties}>
                <span>{book.title.slice(0, 2)}</span>
              </span>
              <span className="book-meta">
                <strong>{book.title}</strong>
                <small>{book.author} · {book.category}</small>
                <span className="progress-track">
                  <span style={{ width: `${book.progress}%` }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="reading-panel" aria-label="阅读区">
        <header className="reader-toolbar">
          <div className="chapter-label">
            <span>{selectedBook.category}</span>
            <strong>{selectedBook.progress}%</strong>
          </div>
          <div className="toolbar-actions">
            <button type="button" aria-label="加入书签">
              <Bookmark size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="标注段落">
              <Highlighter size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="切换主题"
              onClick={() => setTheme(theme === 'paper' ? 'night' : 'paper')}
            >
              {theme === 'paper' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              aria-label="打开或收起笔记"
              onClick={() => setShowNotes((value) => !value)}
            >
              <PanelRight size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <article className="reader-page" style={{ '--reader-font-size': `${fontSize}px` } as CSSProperties}>
          <div className="book-kicker">{selectedBook.author}</div>
          <h2>{selectedBook.title}</h2>
          <p className="lede">{selectedBook.excerpt}</p>
          {selectedBook.chapters.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>

        <footer className="reader-controls">
          <button
            type="button"
            className={focused ? 'is-selected' : ''}
            onClick={() => setFocused((value) => !value)}
          >
            <Check size={17} aria-hidden="true" />
            <span>专注</span>
          </button>
          <label>
            <Type size={17} aria-hidden="true" />
            <input
              type="range"
              min="16"
              max="22"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
            <span>{fontSize}px</span>
          </label>
        </footer>
      </section>

      {showNotes && (
        <aside className="notes-panel" aria-label="笔记">
          <div className="notes-header">
            <span>页边笔记</span>
            <strong>{notes.length}</strong>
          </div>
          <div className="quote-box">
            <Highlighter size={17} aria-hidden="true" />
            <p>{selectedBook.excerpt}</p>
          </div>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <button type="button" className="note-button">
            <span>新笔记</span>
          </button>
        </aside>
      )}
    </main>
  )
}

export default App
