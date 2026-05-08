import {
  Bookmark,
  BookOpen,
  Check,
  Highlighter,
  ListFilter,
  Moon,
  Pause,
  Play,
  Search,
  Settings,
  Sun,
  Type,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type BookGenre =
  | '文学小说'
  | '悬疑/犯罪'
  | '科幻'
  | '奇幻'
  | '历史'
  | '传记/纪实'
  | '哲学/心理'
  | '商业/管理'
  | '科普'
  | '诗歌/散文'
  | '学术/专业'
  | '儿童/轻阅读'
  | '通用'

type ThemeMode = 'dark' | 'light'
type ReaderMode = 'regular' | 'immersive' | 'focus'
type LineHeight = 'compact' | 'standard' | 'relaxed'

interface DetectionResult {
  type: BookGenre
  confidence: number
  reason: string
  fallbackType: BookGenre
}

interface Book {
  id: string
  title: string
  author: string
  category: string
  progress: number
  chapterProgress: number
  remaining: string
  detection: DetectionResult
  excerpt: string
  chapters: string[]
}

interface ReaderSettings {
  theme: ThemeMode
  mode: ReaderMode
  fontSize: number
  lineHeight: LineHeight
  intensity: number
  motionEnabled: boolean
  reducedMotion: boolean
  followType: boolean
  manualType: BookGenre | null
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'dark',
  mode: 'regular',
  fontSize: 20,
  lineHeight: 'relaxed',
  intensity: 18,
  motionEnabled: true,
  reducedMotion: false,
  followType: true,
  manualType: null,
}

const STORAGE_KEY = 'wanman-premium-reader-settings-v1'

const genrePresets: Record<
  BookGenre,
  {
    label: string
    description: string
    palette: string
    accent: string
    secondary: string
    scene: string
  }
> = {
  文学小说: {
    label: '文学',
    description: '墨色山影与纸面光纤缓慢漂移',
    palette: 'linear-gradient(135deg, #101820 0%, #22332c 45%, #6d5941 100%)',
    accent: '#77D6B6',
    secondary: '#C6A15B',
    scene: 'ink',
  },
  '悬疑/犯罪': {
    label: '悬疑',
    description: '低雾、雨痕与斜向暗影降速流动',
    palette: 'linear-gradient(135deg, #0B0F14 0%, #172231 52%, #4b3d2d 100%)',
    accent: '#8DB7C7',
    secondary: '#C6A15B',
    scene: 'fog',
  },
  科幻: {
    label: '科幻',
    description: '星云、轨道线与远景城市光的低频视差',
    palette: 'linear-gradient(135deg, #07111f 0%, #142033 47%, #273457 100%)',
    accent: '#77D6B6',
    secondary: '#86A8FF',
    scene: 'stars',
  },
  奇幻: {
    label: '奇幻',
    description: '森林剪影、月光雾层与微光尘埃',
    palette: 'linear-gradient(135deg, #0b1718 0%, #17342d 48%, #425038 100%)',
    accent: '#9DDDBB',
    secondary: '#C6A15B',
    scene: 'forest',
  },
  历史: {
    label: '历史',
    description: '羊皮纸地图、档案线与烛光般暖度',
    palette: 'linear-gradient(135deg, #17120e 0%, #3c2f24 48%, #79613b 100%)',
    accent: '#C6A15B',
    secondary: '#B77E4C',
    scene: 'archive',
  },
  '传记/纪实': {
    label: '纪实',
    description: '桌面、照片边缘与自然光轻微变化',
    palette: 'linear-gradient(135deg, #131816 0%, #28332d 54%, #806c4f 100%)',
    accent: '#96C9AB',
    secondary: '#D0B47B',
    scene: 'documentary',
  },
  '哲学/心理': {
    label: '哲学',
    description: '留白空间与水面明暗缓慢呼吸',
    palette: 'linear-gradient(135deg, #0f1518 0%, #20313a 48%, #586c64 100%)',
    accent: '#A7D6C4',
    secondary: '#B9C1C8',
    scene: 'water',
  },
  '商业/管理': {
    label: '商业',
    description: '城市晨光与安静工作台的低频光移',
    palette: 'linear-gradient(135deg, #10151b 0%, #263444 48%, #766646 100%)',
    accent: '#8FCAB5',
    secondary: '#C6A15B',
    scene: 'city',
  },
  科普: {
    label: '科普',
    description: '自然纹理、等高线与宇宙尺度的慢视差',
    palette: 'linear-gradient(135deg, #0b1520 0%, #243241 48%, #405d57 100%)',
    accent: '#8FD7CD',
    secondary: '#B7D66C',
    scene: 'science',
  },
  '诗歌/散文': {
    label: '诗歌',
    description: '水彩晕染、风吹纸页与淡墨扩散',
    palette: 'linear-gradient(135deg, #161b1c 0%, #354641 45%, #7a6658 100%)',
    accent: '#9FD6BC',
    secondary: '#D8B174',
    scene: 'poetry',
  },
  '学术/专业': {
    label: '学术',
    description: '低饱和图书馆光，仅保留细微照度',
    palette: 'linear-gradient(135deg, #11161a 0%, #27303a 50%, #5f625b 100%)',
    accent: '#A9C7BD',
    secondary: '#B9C1C8',
    scene: 'library',
  },
  '儿童/轻阅读': {
    label: '轻读',
    description: '柔和插画形状与温暖漂移',
    palette: 'linear-gradient(135deg, #172026 0%, #415348 48%, #95704c 100%)',
    accent: '#A9DEBF',
    secondary: '#F0C77D',
    scene: 'warm',
  },
  通用: {
    label: '通用',
    description: '高级纸感与自然光渐变',
    palette: 'linear-gradient(135deg, #111820 0%, #273238 50%, #5f5342 100%)',
    accent: '#77D6B6',
    secondary: '#C6A15B',
    scene: 'paper',
  },
}

const books: Book[] = [
  {
    id: 'far-mountain',
    title: '远山与星河',
    author: '沈砚',
    category: '科幻长篇',
    progress: 12,
    chapterProgress: 28,
    remaining: '42 分钟',
    detection: {
      type: '科幻',
      confidence: 0.86,
      reason: '标题、章节名和简介中出现星河、轨道、远景城市等高权重词。',
      fallbackType: '通用',
    },
    excerpt: '远山在暮色中凝成一线，像是大地的脊梁，沉默而悠远。',
    chapters: [
      '星河从天幕缓缓铺展，微光落在湖面，碎成无数细小的颤动，如同古老的约定，悄然照亮了夜的尽头。',
      '少年独自伫立在岸边，衣袂被晚风轻轻吹起，他抬头望向那无垠的星空，心中不知为何生出一种渺小而又辽阔的感觉。',
      '他曾读到过一句话：“人的一生，不过是宇宙长河中的一瞬。”那时并不理解，如今却在这静谧的夜里，忽然有些明白。',
      '远处传来渔火的微光，隐隐摇曳，像是生活在黑暗中不肯熄灭的希望。他深吸一口气，转身沿着湖岸缓缓走去。',
      '前路未知，但是河长明。那些被风吹散的念头，终于在脚步声里慢慢安定下来。',
    ],
  },
  {
    id: 'rain-alley',
    title: '雨巷证词',
    author: '许临',
    category: '悬疑',
    progress: 47,
    chapterProgress: 63,
    remaining: '1 小时 18 分钟',
    detection: {
      type: '悬疑/犯罪',
      confidence: 0.78,
      reason: '目录与简介包含证词、雨夜、旧案等悬疑关键词。',
      fallbackType: '通用',
    },
    excerpt: '雨水把巷口的灯压得很低，所有脚印都像刚刚离开。',
    chapters: [
      '钟楼敲过十一下之后，街面只剩下雨声。陈述者把伞收在门外，袖口却没有湿，这个细节让记录员停下了笔。',
      '他说自己只是路过，可那条巷子没有第二个出口。墙上的旧海报被雨水泡开，露出多年以前同一张失踪启事。',
      '房间里很安静，安静到每一次呼吸都像是在替某个人辩解。她把证词翻回第一页，终于看见日期旁边那枚淡淡的指印。',
    ],
  },
  {
    id: 'morning-board',
    title: '晨光董事会',
    author: '周醒',
    category: '商业/管理',
    progress: 31,
    chapterProgress: 44,
    remaining: '56 分钟',
    detection: {
      type: '商业/管理',
      confidence: 0.69,
      reason: '副标题偏管理，但章节中有散文表达，先以建议类型呈现。',
      fallbackType: '通用',
    },
    excerpt: '真正困难的决策，往往不是选择增长，而是选择什么不再增长。',
    chapters: [
      '会议室的窗帘被清晨的光推开一条细缝。屏幕上有四条曲线，每一条都像在讲一个不同版本的未来。',
      '负责人没有先谈目标，而是把团队已经承受的成本逐项写在白板上。沉默持续了很久，因为每个人都看见了增长背后的形状。',
      '好的管理不是把噪音变大，而是让真正重要的信号可以被听见。它需要速度，也需要把速度暂时放下的勇气。',
    ],
  },
]

const genreOptions = Object.keys(genrePresets) as BookGenre[]
const swatchGenres: BookGenre[] = ['文学小说', '科幻', '奇幻', '历史']

function getInitialSettingsByBook(): Record<string, ReaderSettings> {
  if (typeof window === 'undefined') {
    return Object.fromEntries(books.map((book) => [book.id, { ...DEFAULT_SETTINGS }]))
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const defaults = { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion }
  const freshSettings = Object.fromEntries(books.map((book) => [book.id, { ...defaults }]))

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return freshSettings
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, Partial<ReaderSettings>>
    return Object.fromEntries(
      books.map((book) => [book.id, { ...defaults, ...(parsed[book.id] ?? {}) }]),
    ) as Record<string, ReaderSettings>
  } catch {
    return freshSettings
  }
}

function App() {
  const [selectedBookId, setSelectedBookId] = useState(books[0].id)
  const [settingsByBook, setSettingsByBook] = useState<Record<string, ReaderSettings>>(getInitialSettingsByBook)

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? books[0],
    [selectedBookId],
  )

  const settings = settingsByBook[selectedBook.id] ?? DEFAULT_SETTINGS
  const selectedGenre = settings.followType
    ? selectedBook.detection.confidence >= 0.7
      ? selectedBook.detection.type
      : selectedBook.detection.fallbackType
    : settings.manualType ?? selectedBook.detection.type
  const preset = genrePresets[selectedGenre]
  const effectiveIntensity =
    settings.mode === 'focus'
      ? Math.min(settings.intensity, 12)
      : settings.mode === 'immersive'
        ? Math.min(settings.intensity, 30)
        : settings.intensity
  const motionIntensity =
    settings.motionEnabled && !settings.reducedMotion ? effectiveIntensity : Math.min(effectiveIntensity, 5)
  const isQuiet = !settings.motionEnabled || settings.reducedMotion || motionIntensity <= 5

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsByBook))
  }, [settingsByBook])

  function updateSetting<Key extends keyof ReaderSettings>(key: Key, value: ReaderSettings[Key]) {
    setSettingsByBook((current) => ({
      ...current,
      [selectedBook.id]: {
        ...(current[selectedBook.id] ?? DEFAULT_SETTINGS),
        [key]: value,
      },
    }))
  }

  function chooseManualType(type: BookGenre) {
    setSettingsByBook((current) => ({
      ...current,
      [selectedBook.id]: {
        ...(current[selectedBook.id] ?? DEFAULT_SETTINGS),
        followType: false,
        manualType: type,
      },
    }))
  }

  const appStyle = {
    '--genre-palette': preset.palette,
    '--genre-accent': preset.accent,
    '--genre-secondary': preset.secondary,
    '--reader-font-size': `${settings.fontSize}px`,
    '--line-height': settings.lineHeight === 'compact' ? 1.58 : settings.lineHeight === 'standard' ? 1.72 : 1.88,
    '--motion-intensity': motionIntensity,
  } as CSSProperties

  const railItems: Array<[string, LucideIcon]> = [
    ['书架', BookOpen],
    ['发现', Search],
    ['书签', Bookmark],
    ['笔记', Highlighter],
    ['设置', Settings],
  ]

  return (
    <main
      className={`reader-app theme-${settings.theme} mode-${settings.mode} scene-${preset.scene} ${
        isQuiet ? 'is-quiet-motion' : ''
      }`}
      style={appStyle}
    >
      <AmbientBackground genre={selectedGenre} intensity={motionIntensity} paused={isQuiet} />

      <aside className="library-rail" aria-label="书架导航">
        <div className="brand">
          <BookOpen size={29} aria-hidden="true" />
          <strong>沉浸阅读</strong>
        </div>
        {railItems.map(([label, Icon]) => (
          <button type="button" className="rail-button" aria-label={label} key={label}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </aside>

      <section className="reader-stage" aria-label="沉浸阅读区">
        <LightPreview book={selectedBook} />

        <article className="reading-card" aria-label={`${selectedBook.title} 正文`}>
          <header className="reader-topbar">
            <button type="button" aria-label="返回书架" className="icon-button">
              <BookOpen size={20} aria-hidden="true" />
            </button>
            <div className="chapter-progress" aria-label={`阅读进度 ${selectedBook.progress}%`}>
              <span>第一章 远山与星河</span>
              <div className="progress-line">
                <span style={{ width: `${selectedBook.progress}%` }} />
              </div>
            </div>
            <strong>{selectedBook.progress}%</strong>
            <button type="button" aria-label="打开目录" className="icon-button">
              <ListFilter size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="reading-surface">
            <div className="book-kicker">
              <span>{selectedBook.author}</span>
              <span>{genrePresets[selectedGenre].label}</span>
            </div>
            <h1>{selectedBook.title}</h1>
            <p className="lede">{selectedBook.excerpt}</p>
            {selectedBook.chapters.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <footer className="minimal-controls" aria-label="阅读快捷控制">
            <button type="button" aria-label="目录" className="icon-button">
              <ListFilter size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="切换亮暗主题"
              className="icon-button"
              onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark')}
            >
              {settings.theme === 'dark' ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
            </button>
            <button type="button" aria-label="字体设置" className="icon-button">
              <Type size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={settings.motionEnabled ? '暂停动态背景' : '恢复动态背景'}
              className="icon-button"
              onClick={() => updateSetting('motionEnabled', !settings.motionEnabled)}
            >
              {settings.motionEnabled ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
            </button>
          </footer>
        </article>

        <div className="ambient-dock" aria-label="动态背景强度">
          <span>动态背景强度</span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.intensity}
            aria-label="动态背景强度百分比"
            onChange={(event) => updateSetting('intensity', Number(event.target.value))}
          />
          <strong>{effectiveIntensity}%</strong>
        </div>
      </section>

      <aside className="control-panel" aria-label="阅读控制">
        <PanelSection title="正在阅读">
          <div className="book-switcher">
            {books.map((book) => (
              <button
                type="button"
                className={book.id === selectedBook.id ? 'is-active' : ''}
                key={book.id}
                onClick={() => setSelectedBookId(book.id)}
              >
                <strong>{book.title}</strong>
                <span>{genrePresets[book.detection.type].label} · {book.progress}%</span>
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="动态背景" action={<Toggle checked={settings.motionEnabled} label="动态背景" onChange={(checked) => updateSetting('motionEnabled', checked)} />}>
          <label className="select-row">
            <span>类型：{genrePresets[selectedGenre].label}</span>
            <select value={selectedGenre} onChange={(event) => chooseManualType(event.target.value as BookGenre)}>
              {genreOptions.map((genre) => (
                <option value={genre} key={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>
          <div className="genre-grid">
            {swatchGenres.map((genre) => (
              <button
                type="button"
                className={`genre-card ${genre === selectedGenre ? 'is-selected' : ''}`}
                key={genre}
                onClick={() => chooseManualType(genre)}
                style={{ '--swatch': genrePresets[genre].palette } as CSSProperties}
              >
                <span aria-hidden="true" />
                <strong>{genrePresets[genre].label}</strong>
                {genre === selectedGenre && <Check size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="hint">
            {settings.followType ? '自动识别' : '手动覆盖'} · 置信度 {Math.round(selectedBook.detection.confidence * 100)}% ·{' '}
            {selectedBook.detection.reason}
          </p>
          {!settings.followType && (
            <button type="button" className="text-button" onClick={() => updateSetting('followType', true)}>
              恢复自动识别
            </button>
          )}
        </PanelSection>

        <PanelSection title={`强度 ${effectiveIntensity}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.intensity}
            aria-label="动态背景强度"
            onChange={(event) => updateSetting('intensity', Number(event.target.value))}
          />
          <div className="range-labels">
            <span>0%</span>
            <span>100%</span>
          </div>
          {settings.intensity > 55 && <p className="hint strong">高强度仅适合预览，长时间阅读建议降至 30% 以下。</p>}
        </PanelSection>

        <PanelSection title="亮 / 暗">
          <div className="segmented" role="group" aria-label="主题">
            <button
              type="button"
              className={settings.theme === 'light' ? 'is-active' : ''}
              onClick={() => updateSetting('theme', 'light')}
            >
              <Sun size={18} aria-hidden="true" />
              <span>亮</span>
            </button>
            <button
              type="button"
              className={settings.theme === 'dark' ? 'is-active' : ''}
              onClick={() => updateSetting('theme', 'dark')}
            >
              <Moon size={18} aria-hidden="true" />
              <span>暗</span>
            </button>
          </div>
        </PanelSection>

        <PanelSection title="字体大小">
          <div className="stepper">
            <button type="button" aria-label="减小字号" onClick={() => updateSetting('fontSize', Math.max(17, settings.fontSize - 1))}>
              A-
            </button>
            <input
              type="range"
              min="17"
              max="24"
              value={settings.fontSize}
              aria-label="字号"
              onChange={(event) => updateSetting('fontSize', Number(event.target.value))}
            />
            <button type="button" aria-label="增大字号" onClick={() => updateSetting('fontSize', Math.min(24, settings.fontSize + 1))}>
              A+
            </button>
          </div>
        </PanelSection>

        <PanelSection title="行间距">
          <div className="segmented" role="group" aria-label="行距">
            {(['compact', 'standard', 'relaxed'] as LineHeight[]).map((value) => (
              <button
                type="button"
                className={settings.lineHeight === value ? 'is-active' : ''}
                key={value}
                onClick={() => updateSetting('lineHeight', value)}
              >
                <span>{value === 'compact' ? '紧' : value === 'standard' ? '中' : '舒'}</span>
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="阅读模式">
          <div className="mode-grid" role="group" aria-label="阅读模式">
            {[
              ['regular', '常规'],
              ['immersive', '沉浸'],
              ['focus', '专注'],
            ].map(([mode, label]) => (
              <button
                type="button"
                className={settings.mode === mode ? 'is-active' : ''}
                key={mode}
                onClick={() => updateSetting('mode', mode as ReaderMode)}
              >
                {label}
              </button>
            ))}
          </div>
          <Toggle checked={settings.reducedMotion} label="减少动态" onChange={(checked) => updateSetting('reducedMotion', checked)} />
          <p className="hint">专注模式会自动把背景降噪到 12% 以下，并隐藏非必要控制。</p>
        </PanelSection>
      </aside>
    </main>
  )
}

function AmbientBackground({ genre, intensity, paused }: { genre: BookGenre; intensity: number; paused: boolean }) {
  const preset = genrePresets[genre]
  return (
    <div className={`ambient-background ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <div className="ambient-gradient" />
      <div className="ambient-map" />
      <div className="ambient-orbits" />
      <div className="ambient-fibers" />
      <div className="ambient-scrim" style={{ opacity: 0.42 + Math.min(intensity, 55) / 180 }} />
      <span className="sr-only">{preset.description}</span>
    </div>
  )
}

function LightPreview({ book }: { book: Book }) {
  return (
    <aside className="light-preview" aria-hidden="true">
      <div className="preview-top" />
      <h2>{book.title}</h2>
      <p>{book.excerpt}</p>
      <p>{book.chapters[0]}</p>
      <div className="preview-progress">
        <span style={{ width: `${book.progress}%` }} />
      </div>
    </aside>
  )
}

function PanelSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

export default App
