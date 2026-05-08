import { strFromU8, unzipSync } from 'fflate'

export type EpubTocSource = 'nav' | 'ncx' | 'spine' | 'fallback'

export interface EpubTocItem {
  id: string
  label: string
  href: string
  spineIndex: number
  anchor?: string
  level: number
  order: number
}

export interface EpubChapter {
  id: string
  title: string
  href: string
  text: string
  html: string
}

export interface ParsedEpub {
  title: string
  author: string
  language?: string
  publisher?: string
  subjects: string[]
  description?: string
  fileFingerprint: string
  chapters: EpubChapter[]
  toc: EpubTocItem[]
  tocSource: EpubTocSource
}

type ZipEntries = Record<string, Uint8Array>

const REMOTE_RESOURCE_PATTERN = /\b(?:src|href)\s*=\s*["']https?:\/\/[^"']+["']/gi

function getText(entry: Uint8Array | undefined) {
  return entry ? strFromU8(entry) : ''
}

function parseXml(input: string, type: DOMParserSupportedType = 'application/xml') {
  const doc = new DOMParser().parseFromString(input, type)
  if (doc.querySelector('parsererror')) {
    throw new Error('EPUB XML 结构损坏')
  }
  return doc
}

function elements(parent: ParentNode, localName: string) {
  return Array.from(parent.querySelectorAll('*')).filter((node) => node.localName === localName)
}

function firstText(parent: ParentNode, localName: string) {
  return elements(parent, localName)[0]?.textContent?.trim() ?? ''
}

function dirname(path: string) {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(0, index + 1) : ''
}

function normalizePath(path: string) {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join('/')
}

function resolvePath(base: string, href: string) {
  const [pathPart] = href.split('#')
  return normalizePath(`${dirname(base)}${pathPart}`)
}

function fingerprint(file: File, entries: ZipEntries) {
  const basis = `${file.name}|${file.size}|${file.lastModified}|${Object.keys(entries).sort().slice(0, 48).join('|')}`
  let hash = 2166136261
  for (let index = 0; index < basis.length; index += 1) {
    hash ^= basis.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `epub-${(hash >>> 0).toString(16)}-${file.size}`
}

function findPackagePath(entries: ZipEntries) {
  const container = getText(entries['META-INF/container.xml'])
  if (!container) {
    throw new Error('未找到 EPUB 主配置文件')
  }
  const doc = parseXml(container)
  const rootfile = elements(doc, 'rootfile')[0]
  const fullPath = rootfile?.getAttribute('full-path')
  if (!fullPath || !entries[fullPath]) {
    throw new Error('EPUB 主配置文件不可读取')
  }
  return fullPath
}

function sanitizeContentDocument(raw: string) {
  const doc = parseXml(raw, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, form, input, button, link, style, meta').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || name === 'style' || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name)
      }
      if ((name === 'src' || name === 'href') && /^https?:\/\//i.test(value)) {
        node.removeAttribute(attribute.name)
      }
      if (name === 'src' || name === 'srcset') {
        node.removeAttribute(attribute.name)
        if (node.localName === 'img' && !node.getAttribute('alt')) {
          node.setAttribute('alt', 'EPUB 内嵌图片占位')
        }
      }
    })
  })
  const body = doc.body ?? doc.documentElement
  const html = body.innerHTML.replace(REMOTE_RESOURCE_PATTERN, '')
  const text = (body.textContent ?? '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { html, text }
}

function labelForHref(href: string) {
  const file = href.split('/').pop()?.split('#')[0] ?? ''
  return decodeURIComponent(file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')).trim()
}

function buildNavToc(entries: ZipEntries, opfPath: string, manifestItems: Map<string, { href: string; properties: string }>, spineHrefs: string[]) {
  const navItem = Array.from(manifestItems.values()).find((item) => item.properties.split(/\s+/).includes('nav'))
  if (!navItem) {
    return []
  }
  const navPath = resolvePath(opfPath, navItem.href)
  const navDoc = parseXml(getText(entries[navPath]), 'text/html')
  const nav = Array.from(navDoc.querySelectorAll('nav')).find((node) => (node.getAttribute('epub:type') ?? node.getAttribute('type') ?? '').includes('toc')) ?? navDoc.querySelector('nav')
  if (!nav) {
    return []
  }
  return Array.from(nav.querySelectorAll('a'))
    .map((anchor, order) => {
      const href = anchor.getAttribute('href') ?? ''
      const chapterPath = resolvePath(navPath, href)
      const spineIndex = spineHrefs.indexOf(chapterPath)
      return {
        id: `toc-nav-${order}`,
        label: anchor.textContent?.trim() || labelForHref(href) || `章节 ${order + 1}`,
        href,
        spineIndex: spineIndex >= 0 ? spineIndex : 0,
        anchor: href.split('#')[1],
        level: Math.max(1, anchor.closest('ol') ? Array.from(nav.querySelectorAll('ol')).filter((list) => list.contains(anchor)).length : 1),
        order,
      }
    })
    .filter((item) => item.label)
}

function buildNcxToc(entries: ZipEntries, opfPath: string, manifestItems: Map<string, { href: string; mediaType: string }>, spineHrefs: string[]) {
  const ncxItem = Array.from(manifestItems.values()).find((item) => item.mediaType === 'application/x-dtbncx+xml')
  if (!ncxItem) {
    return []
  }
  const ncxPath = resolvePath(opfPath, ncxItem.href)
  const ncxDoc = parseXml(getText(entries[ncxPath]))
  return elements(ncxDoc, 'navPoint')
    .map((point, order) => {
      const src = elements(point, 'content')[0]?.getAttribute('src') ?? ''
      const chapterPath = resolvePath(ncxPath, src)
      const spineIndex = spineHrefs.indexOf(chapterPath)
      return {
        id: point.getAttribute('id') || `toc-ncx-${order}`,
        label: firstText(point, 'text') || labelForHref(src) || `章节 ${order + 1}`,
        href: src,
        spineIndex: spineIndex >= 0 ? spineIndex : 0,
        anchor: src.split('#')[1],
        level: Math.max(1, point.parentElement?.closest('navPoint') ? 2 : 1),
        order,
      }
    })
    .filter((item) => item.label)
}

export async function parseEpubFile(file: File): Promise<ParsedEpub> {
  let entries: ZipEntries
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('文件结构损坏，无法打开')
  }
  if (!entries.mimetype || getText(entries.mimetype).trim() !== 'application/epub+zip') {
    throw new Error('当前文件不是可读取的 EPUB')
  }
  const opfPath = findPackagePath(entries)
  const opfDoc = parseXml(getText(entries[opfPath]))
  const title = firstText(opfDoc, 'title') || file.name.replace(/\.epub$/i, '')
  const author = firstText(opfDoc, 'creator') || '本地 EPUB'
  const subjects = elements(opfDoc, 'subject').map((node) => node.textContent?.trim() ?? '').filter(Boolean)
  const manifestItems = new Map<string, { href: string; mediaType: string; properties: string }>()
  elements(opfDoc, 'item').forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) {
      manifestItems.set(id, {
        href,
        mediaType: item.getAttribute('media-type') ?? '',
        properties: item.getAttribute('properties') ?? '',
      })
    }
  })
  const spineIds = elements(opfDoc, 'itemref')
    .filter((item) => item.getAttribute('linear') !== 'no')
    .map((item) => item.getAttribute('idref') ?? '')
    .filter(Boolean)
  const spineHrefs = spineIds.map((id) => manifestItems.get(id)).filter((item): item is { href: string; mediaType: string; properties: string } => Boolean(item)).map((item) => resolvePath(opfPath, item.href))
  if (spineHrefs.length === 0) {
    throw new Error('未检测到可阅读章节')
  }
  const chapters = spineHrefs
    .map((href, index) => {
      const content = sanitizeContentDocument(getText(entries[href]))
      return {
        id: `spine-${index}`,
        title: labelForHref(href) || `章节 ${index + 1}`,
        href,
        text: content.text || '该章节暂时无法显示',
        html: content.html || '<p>该章节暂时无法显示</p>',
      }
    })
  const navToc = buildNavToc(entries, opfPath, manifestItems, spineHrefs)
  const ncxToc = navToc.length > 0 ? [] : buildNcxToc(entries, opfPath, manifestItems, spineHrefs)
  const tocSource: EpubTocSource = navToc.length > 0 ? 'nav' : ncxToc.length > 0 ? 'ncx' : spineHrefs.length > 0 ? 'spine' : 'fallback'
  const toc = (navToc.length > 0 ? navToc : ncxToc.length > 0 ? ncxToc : chapters.map((chapter, order) => ({
    id: `toc-spine-${order}`,
    label: chapter.title || `章节 ${order + 1}`,
    href: chapter.href,
    spineIndex: order,
    level: 1,
    order,
  }))).map((item, order) => ({ ...item, order }))
  return {
    title,
    author,
    language: firstText(opfDoc, 'language') || undefined,
    publisher: firstText(opfDoc, 'publisher') || undefined,
    subjects,
    description: firstText(opfDoc, 'description') || undefined,
    fileFingerprint: fingerprint(file, entries),
    chapters,
    toc,
    tocSource,
  }
}
