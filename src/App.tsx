import {
  Bookmark,
  BookOpen,
  Check,
  Highlighter,
  ListFilter,
  Moon,
  Pause,
  Play,
  Settings,
  Sun,
  Type,
  Upload,
  X,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
type BookFormat = 'demo' | 'txt' | 'md'

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
  format: BookFormat
  fileName?: string
  fileSize?: number
  importedAt?: string
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

interface ReadingProgress {
  scrollTop: number
  percent: number
  chapterProgress: number
  updatedAt: string
}

interface ReaderStorage {
  version: 2
  selectedBookId: string
  importedBooks: Book[]
  settingsByBook: Record<string, ReaderSettings>
  progressByBook: Record<string, ReadingProgress>
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

const STORAGE_KEY = 'wanman-premium-reader-local-v2'
const LEGACY_STORAGE_KEY = 'wanman-premium-reader-settings-v1'
const MAX_LOCAL_FILE_SIZE = 2.5 * 1024 * 1024
const HIGH_INTENSITY_THRESHOLD = 55

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
    description: '墨色山影、纸纤维、窗光与细雨低频漂移',
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
    description: '森林剪影、月光雾层与微光符文',
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

const sampleBooks: Book[] = [
  {
    id: 'far-mountain',
    title: '远山与星河',
    author: '沈砚',
    category: '科幻长篇',
    progress: 12,
    chapterProgress: 28,
    remaining: '42 分钟',
    format: 'demo',
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
    format: 'demo',
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
    format: 'demo',
    detection: {
      type: '商业/管理',
      confidence: 0.69,
      reason: '副标题偏管理，但章节中有散文表达，先以低置信建议呈现。',
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
const swatchGenres: BookGenre[] = ['文学小说', '科幻', '奇幻', '历史', '悬疑/犯罪', '商业/管理']
const lineHeights: LineHeight[] = ['compact', 'standard', 'relaxed']
const readerModes: ReaderMode[] = ['regular', 'immersive', 'focus']

function isGenre(value: unknown): value is BookGenre {
  return typeof value === 'string' && value in genrePresets
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function sanitizeSettings(input: unknown, prefersReducedMotion: boolean): ReaderSettings {
  const source = input && typeof input === 'object' ? (input as Partial<ReaderSettings>) : {}
  return {
    theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : DEFAULT_SETTINGS.theme,
    mode: readerModes.includes(source.mode as ReaderMode) ? (source.mode as ReaderMode) : DEFAULT_SETTINGS.mode,
    fontSize: clampNumber(source.fontSize, 17, 24, DEFAULT_SETTINGS.fontSize),
    lineHeight: lineHeights.includes(source.lineHeight as LineHeight)
      ? (source.lineHeight as LineHeight)
      : DEFAULT_SETTINGS.lineHeight,
    intensity: clampNumber(source.intensity, 0, 100, DEFAULT_SETTINGS.intensity),
    motionEnabled: typeof source.motionEnabled === 'boolean' ? source.motionEnabled : DEFAULT_SETTINGS.motionEnabled,
    reducedMotion: typeof source.reducedMotion === 'boolean' ? source.reducedMotion : prefersReducedMotion,
    followType: typeof source.followType === 'boolean' ? source.followType : DEFAULT_SETTINGS.followType,
    manualType: isGenre(source.manualType) ? source.manualType : null,
  }
}

function sanitizeProgress(input: unknown): ReadingProgress {
  const source = input && typeof input === 'object' ? (input as Partial<ReadingProgress>) : {}
  return {
    scrollTop: clampNumber(source.scrollTop, 0, 999999, 0),
    percent: clampNumber(source.percent, 0, 100, 0),
    chapterProgress: clampNumber(source.chapterProgress, 0, 100, 0),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
  }
}

function sanitizeBook(input: unknown): Book | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const source = input as Partial<Book>
  if (typeof source.id !== 'string' || typeof source.title !== 'string' || !Array.isArray(source.chapters)) {
    return null
  }
  const chapters = source.chapters.filter((chapter): chapter is string => typeof chapter === 'string' && chapter.trim().length > 0)
  if (chapters.length === 0) {
    return null
  }
  const detection = source.detection
  const safeDetection: DetectionResult =
    detection && isGenre(detection.type)
      ? {
          type: detection.type,
          confidence: clampNumber(detection.confidence, 0, 1, 0.35),
          reason: typeof detection.reason === 'string' ? detection.reason : '从本机文本片段低置信识别。',
          fallbackType: isGenre(detection.fallbackType) ? detection.fallbackType : '通用',
        }
      : detectBookGenre(source.title, chapters.join('\n').slice(0, 4000), source.fileName)

  return {
    id: source.id,
    title: source.title,
    author: typeof source.author === 'string' ? source.author : '本地文件',
    category: typeof source.category === 'string' ? source.category : '本地书籍',
    progress: clampNumber(source.progress, 0, 100, 0),
    chapterProgress: clampNumber(source.chapterProgress, 0, 100, 0),
    remaining: typeof source.remaining === 'string' ? source.remaining : '本机保存',
    detection: safeDetection,
    excerpt: typeof source.excerpt === 'string' && source.excerpt.trim() ? source.excerpt : chapters[0].slice(0, 80),
    chapters,
    format: source.format === 'md' || source.format === 'txt' ? source.format : 'txt',
    fileName: typeof source.fileName === 'string' ? source.fileName : undefined,
    fileSize: typeof source.fileSize === 'number' ? source.fileSize : undefined,
    importedAt: typeof source.importedAt === 'string' ? source.importedAt : undefined,
  }
}

function getPreferenceDefaults() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }
  return {
    ...DEFAULT_SETTINGS,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    intensity: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 5 : DEFAULT_SETTINGS.intensity,
  }
}

function getInitialStorage(): ReaderStorage {
  const defaults = getPreferenceDefaults()
  const settingsByBook = Object.fromEntries(sampleBooks.map((book) => [book.id, { ...defaults }]))
  const progressByBook = Object.fromEntries(
    sampleBooks.map((book) => [
      book.id,
      { scrollTop: 0, percent: book.progress, chapterProgress: book.chapterProgress, updatedAt: new Date().toISOString() },
    ]),
  )
  const fallback: ReaderStorage = {
    version: 2,
    selectedBookId: sampleBooks[0].id,
    importedBooks: [],
    settingsByBook,
    progressByBook,
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderStorage>
      const importedBooks = Array.isArray(parsed.importedBooks)
        ? parsed.importedBooks.map(sanitizeBook).filter((book): book is Book => Boolean(book))
        : []
      const allBooks = [...sampleBooks, ...importedBooks]
      const safeSettings = Object.fromEntries(
        allBooks.map((book) => [book.id, sanitizeSettings(parsed.settingsByBook?.[book.id], defaults.reducedMotion)]),
      )
      const safeProgress = Object.fromEntries(
        allBooks.map((book) => [
          book.id,
          parsed.progressByBook?.[book.id]
            ? sanitizeProgress(parsed.progressByBook[book.id])
            : { scrollTop: 0, percent: book.progress, chapterProgress: book.chapterProgress, updatedAt: new Date().toISOString() },
        ]),
      )
      return {
        version: 2,
        selectedBookId: allBooks.some((book) => book.id === parsed.selectedBookId) ? String(parsed.selectedBookId) : allBooks[0].id,
        importedBooks,
        settingsByBook: safeSettings,
        progressByBook: safeProgress,
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Record<string, Partial<ReaderSettings>>
      return {
        ...fallback,
        settingsByBook: Object.fromEntries(sampleBooks.map((book) => [book.id, sanitizeSettings(legacy[book.id], defaults.reducedMotion)])),
      }
    }
  } catch {
    return fallback
  }

  return fallback
}

function detectBookGenre(title: string, text: string, fileName = ''): DetectionResult {
  const haystack = `${title} ${fileName} ${text.slice(0, 5000)}`.toLowerCase()
  const rules: Array<[BookGenre, string[], string]> = [
    ['科幻', ['星', '宇宙', '飞船', '轨道', '机器人', 'ai', '量子', '火星', '银河'], '命中宇宙、轨道或技术词。'],
    ['悬疑/犯罪', ['证词', '凶手', '案件', '侦探', '尸体', '雨夜', '失踪', '犯罪', '谋杀'], '命中案件、证词或犯罪词。'],
    ['奇幻', ['魔法', '龙', '森林', '符文', '王国', '精灵', '骑士', '月光'], '命中魔法、森林或符文词。'],
    ['历史', ['王朝', '皇帝', '战役', '史记', '年代', '档案', '地图', '古城'], '命中年代、档案或史事词。'],
    ['商业/管理', ['管理', '增长', '战略', '团队', '董事会', '商业', '市场', '组织'], '命中管理、战略或增长词。'],
    ['文学小说', ['小说', '远山', '河流', '黄昏', '故乡', '命运', '街道', '记忆'], '命中文学叙事与场景词。'],
    ['诗歌/散文', ['诗', '散文', '月色', '纸页', '风', '花', '雨', '春天'], '命中诗歌和散文意象词。'],
    ['科普', ['科学', '细胞', '天文', '自然', '实验', '进化', '数学', '物理'], '命中科学、自然或实验词。'],
  ]
  const scored = rules
    .map(([genre, words, reason]) => ({ genre, hits: words.filter((word) => haystack.includes(word)).length, reason }))
    .sort((a, b) => b.hits - a.hits)
  const best = scored[0]
  if (!best || best.hits === 0) {
    return { type: '通用', confidence: 0.28, reason: '本机识别未找到稳定类型信号，使用通用低干扰背景。', fallbackType: '通用' }
  }
  const confidence = Math.min(0.92, 0.42 + best.hits * 0.14)
  return {
    type: best.genre,
    confidence,
    reason: `${best.reason} 命中 ${best.hits} 个本机关键词。`,
    fallbackType: confidence >= 0.7 ? best.genre : '通用',
  }
}

function parseMarkdown(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>#-]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
}

function splitTextIntoChapters(text: string) {
  const clean = text.replace(/\r\n/g, '\n').trim()
  const sections = clean
    .split(/\n\s*(?=第[一二三四五六七八九十百0-9]+[章节回]|#{1,3}\s+)/)
    .map((section) => section.trim())
    .filter(Boolean)
  const chunks = sections.length > 1 ? sections : clean.split(/\n{2,}/).filter(Boolean)
  return chunks.length > 0 ? chunks.slice(0, 80) : [clean]
}

function getBookProgress(book: Book, progress?: ReadingProgress) {
  return Math.round(progress?.percent ?? book.progress)
}

function App() {
  const initialStorageRef = useRef<ReaderStorage | null>(null)
  if (!initialStorageRef.current) {
    initialStorageRef.current = getInitialStorage()
  }
  const initialStorage = initialStorageRef.current
  const [importedBooks, setImportedBooks] = useState<Book[]>(initialStorage.importedBooks)
  const [selectedBookId, setSelectedBookId] = useState(initialStorage.selectedBookId)
  const [settingsByBook, setSettingsByBook] = useState<Record<string, ReaderSettings>>(initialStorage.settingsByBook)
  const [progressByBook, setProgressByBook] = useState<Record<string, ReadingProgress>>(initialStorage.progressByBook)
  const [importStatus, setImportStatus] = useState('本地 TXT / Markdown 可直接打开；正文不会上传。')
  const [pendingIntensity, setPendingIntensity] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const readingSurfaceRef = useRef<HTMLDivElement | null>(null)
  const progressSaveRef = useRef<number | null>(null)

  const books = useMemo(() => [...sampleBooks, ...importedBooks], [importedBooks])
  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? books[0], [books, selectedBookId])
  const settings = settingsByBook[selectedBook.id] ?? getPreferenceDefaults()
  const progress = progressByBook[selectedBook.id]
  const progressPercent = getBookProgress(selectedBook, progress)
  const selectedGenre = useMemo(() => {
    const detected = selectedBook.detection.confidence >= 0.7 ? selectedBook.detection.type : selectedBook.detection.fallbackType
    return settings.followType ? detected : settings.manualType ?? detected
  }, [selectedBook, settings.followType, settings.manualType])
  const preset = genrePresets[selectedGenre] ?? genrePresets.通用
  const effectiveIntensity =
    settings.mode === 'focus'
      ? Math.min(settings.intensity, 12)
      : settings.mode === 'immersive'
        ? Math.min(settings.intensity, 24)
        : settings.intensity
  const motionIntensity = settings.motionEnabled ? (settings.reducedMotion ? Math.min(effectiveIntensity, 5) : effectiveIntensity) : 0
  const isQuiet = !settings.motionEnabled || settings.reducedMotion || motionIntensity <= 5
  const intensityLabel = !settings.motionEnabled ? '已暂停' : settings.reducedMotion ? `生效 ${motionIntensity}%` : `${effectiveIntensity}%`

  useEffect(() => {
    const payload: ReaderStorage = {
      version: 2,
      selectedBookId,
      importedBooks,
      settingsByBook,
      progressByBook,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('Unable to persist local reader state', error)
    }
  }, [importedBooks, progressByBook, selectedBookId, settingsByBook])

  useEffect(() => {
    const surface = readingSurfaceRef.current
    if (!surface) {
      return
    }
    window.setTimeout(() => {
      surface.scrollTop = progressByBook[selectedBook.id]?.scrollTop ?? 0
    }, 0)
  }, [progressByBook, selectedBook.id])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && settings.mode !== 'regular') {
        updateSetting('mode', 'regular')
        readingSurfaceRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function updateSetting<Key extends keyof ReaderSettings>(key: Key, value: ReaderSettings[Key]) {
    setSettingsByBook((current) => ({
      ...current,
      [selectedBook.id]: sanitizeSettings(
        {
          ...(current[selectedBook.id] ?? getPreferenceDefaults()),
          [key]: value,
        },
        getPreferenceDefaults().reducedMotion,
      ),
    }))
  }

  function chooseManualType(type: BookGenre) {
    setSettingsByBook((current) => ({
      ...current,
      [selectedBook.id]: sanitizeSettings(
        {
          ...(current[selectedBook.id] ?? getPreferenceDefaults()),
          followType: false,
          manualType: type,
        },
        getPreferenceDefaults().reducedMotion,
      ),
    }))
  }

  function handleIntensityChange(value: number) {
    if (value > HIGH_INTENSITY_THRESHOLD && settings.intensity <= HIGH_INTENSITY_THRESHOLD) {
      setPendingIntensity(value)
      return
    }
    updateSetting('intensity', value)
  }

  function confirmHighIntensity() {
    if (pendingIntensity !== null) {
      updateSetting('intensity', pendingIntensity)
      setPendingIntensity(null)
    }
  }

  function saveScrollProgress() {
    const surface = readingSurfaceRef.current
    if (!surface) {
      return
    }
    const maxScroll = Math.max(1, surface.scrollHeight - surface.clientHeight)
    const percent = Math.min(100, Math.max(0, (surface.scrollTop / maxScroll) * 100))
    if (progressSaveRef.current) {
      window.clearTimeout(progressSaveRef.current)
    }
    progressSaveRef.current = window.setTimeout(() => {
      setProgressByBook((current) => ({
        ...current,
        [selectedBook.id]: {
          scrollTop: surface.scrollTop,
          percent,
          chapterProgress: percent,
          updatedAt: new Date().toISOString(),
        },
      }))
    }, 120)
  }

  async function importFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files)
    if (nextFiles.length === 0) {
      return
    }
    const parsedBooks: Book[] = []
    for (const file of nextFiles) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension !== 'txt' && extension !== 'md' && extension !== 'markdown') {
        setImportStatus(`无法打开 ${file.name}：当前本机解析仅支持 .txt、.md、.markdown；EPUB 将作为后续本地解析能力。`)
        continue
      }
      if (file.size > MAX_LOCAL_FILE_SIZE) {
        setImportStatus(`无法打开 ${file.name}：文件超过 2.5MB，避免本地原型卡顿。`)
        continue
      }
      const rawText = await file.text()
      const content = extension === 'txt' ? rawText : parseMarkdown(rawText)
      if (!content.trim()) {
        setImportStatus(`无法打开 ${file.name}：文件为空或没有可读正文。`)
        continue
      }
      const title = file.name.replace(/\.(txt|md|markdown)$/i, '')
      const chapters = splitTextIntoChapters(content)
      const book: Book = {
        id: `local-${file.name}-${file.size}-${file.lastModified}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        title,
        author: '本地文件',
        category: extension === 'txt' ? 'TXT 本地书籍' : 'Markdown 本地书籍',
        progress: 0,
        chapterProgress: 0,
        remaining: '本机保存',
        format: extension === 'txt' ? 'txt' : 'md',
        fileName: file.name,
        fileSize: file.size,
        importedAt: new Date().toISOString(),
        excerpt: chapters[0].slice(0, 92),
        chapters,
        detection: detectBookGenre(title, content, file.name),
      }
      parsedBooks.push(book)
    }
    if (parsedBooks.length === 0) {
      return
    }
    setImportedBooks((current) => {
      const withoutDuplicates = current.filter((book) => !parsedBooks.some((nextBook) => nextBook.id === book.id))
      return [...parsedBooks, ...withoutDuplicates]
    })
    setSelectedBookId(parsedBooks[0].id)
    setSettingsByBook((current) => ({
      ...current,
      ...Object.fromEntries(parsedBooks.map((book) => [book.id, { ...getPreferenceDefaults() }])),
    }))
    setProgressByBook((current) => ({
      ...current,
      ...Object.fromEntries(
        parsedBooks.map((book) => [book.id, { scrollTop: 0, percent: 0, chapterProgress: 0, updatedAt: new Date().toISOString() }]),
      ),
    }))
    setImportStatus(`已在本机打开 ${parsedBooks.length} 本书：${parsedBooks.map((book) => book.title).join('、')}。`)
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
    ['打开', Upload],
    ['书签', Bookmark],
    ['笔记', Highlighter],
    ['设置', Settings],
  ]

  return (
    <main
      className={`reader-app theme-${settings.theme} mode-${settings.mode} scene-${preset.scene} ${
        isQuiet ? 'is-quiet-motion' : ''
      } ${settings.intensity > HIGH_INTENSITY_THRESHOLD ? 'is-high-intensity' : ''}`}
      style={appStyle}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        void importFiles(event.dataTransfer.files)
      }}
    >
      <AmbientBackground genre={selectedGenre} intensity={motionIntensity} paused={isQuiet} />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            void importFiles(event.target.files)
          }
          event.currentTarget.value = ''
        }}
      />

      {settings.mode !== 'regular' && (
        <button type="button" className="mode-exit" onClick={() => updateSetting('mode', 'regular')}>
          <X size={18} aria-hidden="true" />
          <span>退出{settings.mode === 'focus' ? '专注' : '沉浸'}</span>
        </button>
      )}

      <aside className="library-rail" aria-label="书架导航">
        <div className="brand">
          <BookOpen size={29} aria-hidden="true" />
          <strong>本地沉浸阅读</strong>
        </div>
        {railItems.map(([label, Icon]) => (
          <button
            type="button"
            className="rail-button"
            aria-label={label === '打开' ? '打开本地 TXT 或 Markdown 书籍' : label}
            key={label}
            onClick={() => {
              if (label === '打开') {
                fileInputRef.current?.click()
              }
            }}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </aside>

      <section className="reader-stage" aria-label="沉浸阅读区">
        <LightPreview book={selectedBook} progress={progressPercent} />

        <article className="reading-card" aria-label={`${selectedBook.title} 正文`}>
          <header className="reader-topbar">
            <button type="button" aria-label="打开本地书籍" className="icon-button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} aria-hidden="true" />
            </button>
            <div
              className="chapter-progress"
              role="progressbar"
              aria-label={`阅读进度 ${progressPercent}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <span>{selectedBook.chapters[0]?.slice(0, 18) ?? selectedBook.title}</span>
              <div className="progress-line">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <strong>{progressPercent}%</strong>
            <button type="button" aria-label="目录将在后续版本提供" className="icon-button" disabled>
              <ListFilter size={20} aria-hidden="true" />
            </button>
          </header>

          {isDragging && <div className="drop-overlay">松开即可在本机打开书籍</div>}

          <div
            ref={readingSurfaceRef}
            className="reading-surface"
            role="region"
            aria-label="正文，可滚动。按 Escape 可退出沉浸或专注模式。"
            tabIndex={0}
            onScroll={saveScrollProgress}
          >
            <div className="book-kicker">
              <span>{selectedBook.author}</span>
              <span>{genrePresets[selectedGenre].label}</span>
            </div>
            <h1>{selectedBook.title}</h1>
            <p className="lede">{selectedBook.excerpt}</p>
            {selectedBook.chapters.map((paragraph, index) => (
              <p key={`${selectedBook.id}-${index}`}>{paragraph}</p>
            ))}
          </div>

          <footer className="minimal-controls" aria-label="阅读快捷控制">
            <button type="button" aria-label="打开本地书籍" className="icon-button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="切换亮暗主题"
              className="icon-button"
              onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark')}
            >
              {settings.theme === 'dark' ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
            </button>
            <button
              type="button"
              aria-label={settings.motionEnabled ? '暂停动态背景' : '恢复动态背景'}
              className="icon-button"
              onClick={() => updateSetting('motionEnabled', !settings.motionEnabled)}
            >
              {settings.motionEnabled ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
            </button>
            {settings.mode !== 'regular' ? (
              <button type="button" className="exit-button" onClick={() => updateSetting('mode', 'regular')}>
                退出
              </button>
            ) : (
              <button type="button" aria-label="字体设置在右侧面板调整" className="icon-button" disabled>
                <Type size={19} aria-hidden="true" />
              </button>
            )}
          </footer>
        </article>

        <div className="ambient-dock" aria-label="动态背景强度">
          <span>{!settings.motionEnabled ? '动态背景已暂停' : settings.reducedMotion ? '减少动态生效' : '动态背景强度'}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.intensity}
            aria-label="底部快捷动态背景强度"
            onChange={(event) => handleIntensityChange(Number(event.target.value))}
          />
          <strong>{intensityLabel}</strong>
        </div>
      </section>

      <aside className="control-panel" aria-label="阅读控制">
        <PanelSection
          title="本地打开"
          action={
            <button type="button" className="mini-action" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              打开
            </button>
          }
        >
          <button type="button" className="local-open" onClick={() => fileInputRef.current?.click()}>
            <Upload size={20} aria-hidden="true" />
            <span>选择 TXT / Markdown</span>
          </button>
          <p className="hint" role="status" aria-live="polite">
            {importStatus}
          </p>
        </PanelSection>

        <PanelSection title="正在阅读">
          <div className="book-switcher">
            {books.map((book) => {
              const bookProgress = getBookProgress(book, progressByBook[book.id])
              return (
                <button
                  type="button"
                  className={book.id === selectedBook.id ? 'is-active' : ''}
                  key={book.id}
                  onClick={() => setSelectedBookId(book.id)}
                >
                  <strong>{book.title}</strong>
                  <span>
                    {genrePresets[book.detection.type].label} · {bookProgress}% · {book.format === 'demo' ? '示例' : '本地'}
                  </span>
                </button>
              )
            })}
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
                className={`genre-card scene-${genrePresets[genre].scene} ${genre === selectedGenre ? 'is-selected' : ''}`}
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

        <PanelSection title={`强度 ${intensityLabel}`}>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.intensity}
            aria-label="设置面板动态背景强度"
            onChange={(event) => handleIntensityChange(Number(event.target.value))}
          />
          <div className="range-labels">
            <span>0%</span>
            <span>100%</span>
          </div>
          {pendingIntensity !== null && (
            <div className="confirm-box" role="alert">
              <p>高强度只用于短时预览，正文遮罩会自动增强。确认使用 {pendingIntensity}%？</p>
              <button type="button" onClick={confirmHighIntensity}>
                确认预览
              </button>
              <button type="button" onClick={() => setPendingIntensity(null)}>
                取消
              </button>
            </div>
          )}
          {settings.intensity > HIGH_INTENSITY_THRESHOLD && <p className="hint strong">高强度已启用增强正文遮罩，长时间阅读建议降至 30% 以下。</p>}
        </PanelSection>

        <PanelSection title="亮 / 暗">
          <div className="segmented" role="group" aria-label="主题">
            <button type="button" className={settings.theme === 'light' ? 'is-active' : ''} onClick={() => updateSetting('theme', 'light')}>
              <Sun size={18} aria-hidden="true" />
              <span>亮</span>
            </button>
            <button type="button" className={settings.theme === 'dark' ? 'is-active' : ''} onClick={() => updateSetting('theme', 'dark')}>
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
            {lineHeights.map((value) => (
              <button type="button" className={settings.lineHeight === value ? 'is-active' : ''} key={value} onClick={() => updateSetting('lineHeight', value)}>
                <span>{value === 'compact' ? '紧' : value === 'standard' ? '中' : '舒'}</span>
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="阅读模式">
          <div className="mode-grid" role="group" aria-label="阅读模式">
            {readerModes.map((mode) => (
              <button type="button" className={settings.mode === mode ? 'is-active' : ''} key={mode} onClick={() => updateSetting('mode', mode)}>
                {mode === 'regular' ? '常规' : mode === 'immersive' ? '沉浸' : '专注'}
              </button>
            ))}
          </div>
          <Toggle checked={settings.reducedMotion} label="减少动态" onChange={(checked) => updateSetting('reducedMotion', checked)} />
          <p className="hint">沉浸和专注模式保留可见退出入口；Escape 也可返回常规。</p>
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
      <div className="ambient-motif" />
      <div className="ambient-map" />
      <div className="ambient-orbits" />
      <div className="ambient-fibers" />
      <div className="ambient-scrim" style={{ opacity: 0.48 + Math.min(intensity, 70) / 160 }} />
      <span className="sr-only">{preset.description}</span>
    </div>
  )
}

function LightPreview({ book, progress }: { book: Book; progress: number }) {
  return (
    <aside className="light-preview" aria-hidden="true">
      <div className="preview-top" />
      <h2>{book.title}</h2>
      <p>{book.excerpt}</p>
      <p>{book.chapters[0]}</p>
      <div className="preview-progress">
        <span style={{ width: `${progress}%` }} />
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
    <button type="button" className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export default App
