import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

/* ── Inline formatting ───────────────────────────────────────── */

const INLINE_RE =
  /(`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|<https?:\/\/[^>\s]+>|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|_[^_\n]+?_)/g

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }

    const link = /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)$/.exec(part)
    if (link) {
      const external = link[2].startsWith('http')
      return (
        <a
          key={i}
          href={link[2]}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
        >
          {renderInline(link[1])}
        </a>
      )
    }

    if (part.startsWith('<http') && part.endsWith('>')) {
      const href = part.slice(1, -1)
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer">
          {href.replace(/^https?:\/\//, '')}
        </a>
      )
    }

    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    ) {
      return <strong key={i}>{renderInline(part.slice(2, -2))}</strong>
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={i}>{renderInline(part.slice(2, -2))}</del>
    }
    if (
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_'))) &&
      part.length > 2
    ) {
      return <em key={i}>{renderInline(part.slice(1, -1))}</em>
    }
    return <span key={i}>{part}</span>
  })
}

/* ── Block parsing ───────────────────────────────────────────── */

interface MarkdownListItem {
  text: string
  checked: boolean | null
  children: MarkdownList[]
}

interface MarkdownList {
  ordered: boolean
  start: number
  items: MarkdownListItem[]
}

interface ListLine {
  indent: number
  ordered: boolean
  number: number
  text: string
}

type Alignment = 'left' | 'center' | 'right'

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; list: MarkdownList }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'table'; headers: string[]; align: Alignment[]; rows: string[][] }
  | { type: 'code'; lang: string; code: string; closed: boolean }

const LIST_RE = /^(\s*)(?:(\d+)[.)]|[-*+])\s+(.*)$/

function readList(
  lines: ListLine[],
  startIndex: number,
  indent: number,
  ordered: boolean,
): [MarkdownList, number] {
  const list: MarkdownList = {
    ordered,
    start: lines[startIndex].number,
    items: [],
  }
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) break

    if (line.indent > indent) {
      const parent = list.items.at(-1)
      if (!parent) break
      const [child, nextIndex] = readList(lines, index, line.indent, line.ordered)
      parent.children.push(child)
      index = nextIndex
      continue
    }

    if (line.ordered !== ordered) break
    const task = /^\[([ xX])\]\s+(.*)$/.exec(line.text)
    list.items.push({
      text: task ? task[2] : line.text,
      checked: task ? task[1].toLowerCase() === 'x' : null,
      children: [],
    })
    index += 1
  }

  return [list, index]
}

function buildLists(lines: ListLine[]): MarkdownList[] {
  const lists: MarkdownList[] = []
  let index = 0
  while (index < lines.length) {
    const current = lines[index]
    const [list, nextIndex] = readList(lines, index, current.indent, current.ordered)
    lists.push(list)
    index = nextIndex
  }
  return lists
}

function splitTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function tableAlignment(row: string): Alignment[] | null {
  const cells = splitTableRow(row)
  if (cells.length < 2 || !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return null
  return cells.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
    if (cell.endsWith(':')) return 'right'
    return 'left'
  })
}

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let listLines: ListLine[] = []
  let code: { lang: string; lines: string[] } | null = null

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', text: para.join(' ') })
      para = []
    }
  }
  const flushLists = () => {
    if (listLines.length) {
      buildLists(listLines).forEach((list) => blocks.push({ type: 'list', list }))
      listLines = []
    }
  }
  const flushText = () => {
    flushPara()
    flushLists()
  }

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    const line = raw.trimEnd()

    if (code) {
      if (line.trimStart().startsWith('```')) {
        blocks.push({ type: 'code', lang: code.lang, code: code.lines.join('\n'), closed: true })
        code = null
      } else {
        code.lines.push(raw)
      }
      continue
    }

    if (line.trimStart().startsWith('```')) {
      flushText()
      code = { lang: line.trimStart().slice(3).trim(), lines: [] }
      continue
    }

    if (line.trim() === '') {
      flushText()
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line.trimStart())
    if (heading) {
      flushText()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushText()
      blocks.push({ type: 'divider' })
      continue
    }

    if (/^\s*>/.test(line)) {
      flushText()
      const quote: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      index -= 1
      blocks.push({ type: 'quote', text: quote.join(' ') })
      continue
    }

    const alignment = index + 1 < lines.length ? tableAlignment(lines[index + 1]) : null
    if (line.includes('|') && alignment) {
      flushText()
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = splitTableRow(lines[index]).slice(0, headers.length)
        while (row.length < headers.length) row.push('')
        rows.push(row)
        index += 1
      }
      index -= 1
      blocks.push({
        type: 'table',
        headers,
        align: headers.map((_, cellIndex) => alignment[cellIndex] ?? 'left'),
        rows,
      })
      continue
    }

    const list = LIST_RE.exec(line)
    if (list) {
      flushPara()
      const leadingSpace = list[1].replace(/\t/g, '  ').length
      listLines.push({
        indent: leadingSpace,
        ordered: Boolean(list[2]),
        number: list[2] ? Number(list[2]) : 1,
        text: list[3],
      })
      continue
    }

    flushLists()
    para.push(line.trim())
  }

  flushText()
  if (code) blocks.push({ type: 'code', lang: code.lang, code: code.lines.join('\n'), closed: false })
  return blocks
}

/* ── Tiny syntax highlighter (warm, muted) ───────────────────── */

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'interface',
  'type', 'class', 'extends', 'implements', 'import', 'export', 'from', 'new', 'async',
  'await', 'try', 'catch', 'throw', 'switch', 'case', 'default', 'public', 'private',
  'readonly', 'static', 'void', 'null', 'undefined', 'true', 'false', 'in', 'of', 'as',
  'SELECT', 'FROM', 'WHERE', 'OVER', 'PARTITION', 'BY', 'ORDER', 'AS', 'DESC', 'ASC',
])
const TYPE_WORDS = new Set(['string', 'number', 'boolean', 'Promise', 'Schema', 'Record'])

const TOKEN_RE =
  /(\/\/[^\n]*|--[^\n]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[^\sA-Za-z0-9_$]+|\s+)/g

function highlight(codeText: string): ReactNode[] {
  const tokens = codeText.match(TOKEN_RE) ?? [codeText]
  return tokens.map((tok, i) => {
    if (tok.startsWith('//') || tok.startsWith('--')) {
      return <span key={i} className="tok-comment">{tok}</span>
    }
    if (/^['"`]/.test(tok)) return <span key={i} className="tok-string">{tok}</span>
    if (/^\d/.test(tok)) return <span key={i} className="tok-number">{tok}</span>
    if (KEYWORDS.has(tok)) return <span key={i} className="tok-keyword">{tok}</span>
    if (TYPE_WORDS.has(tok) || /^[A-Z][a-zA-Z]*$/.test(tok)) {
      return <span key={i} className="tok-type">{tok}</span>
    }
    if (/^[^\sA-Za-z0-9_$]+$/.test(tok)) return <span key={i} className="tok-punct">{tok}</span>
    return <span key={i}>{tok}</span>
  })
}

/* ── Code block with copy affordance ─────────────────────────── */

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  return (
    <figure className="md-code">
      <figcaption className="md-code__bar">
        <span className="md-code__lang">{lang || 'code'}</span>
        <button type="button" className="md-code__copy" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={1.8} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre>
        <code>{highlight(code)}</code>
      </pre>
    </figure>
  )
}

/* ── Structured renderers ────────────────────────────────────── */

function ListBlock({ list }: { list: MarkdownList }) {
  const items = list.items.map((item, index) => (
    <li key={index} className={`md-list__item${item.checked !== null ? ' md-list__item--task' : ''}`}>
      {item.checked === null ? (
        <span className="md-list__marker" aria-hidden="true">
          {list.ordered ? `${list.start + index}.` : '•'}
        </span>
      ) : (
        <span
          className={`md-list__check${item.checked ? ' md-list__check--done' : ''}`}
          aria-hidden="true"
        >
          {item.checked && <Check size={12} strokeWidth={2.4} />}
        </span>
      )}
      <div className="md-list__content">
        <span>{renderInline(item.text)}</span>
        {item.children.map((child, childIndex) => (
          <ListBlock key={childIndex} list={child} />
        ))}
      </div>
    </li>
  ))

  return list.ordered ? (
    <ol className="md-list md-list--ordered" start={list.start}>{items}</ol>
  ) : (
    <ul className="md-list md-list--unordered">{items}</ul>
  )
}

function MarkdownTable({ block }: { block: Extract<Block, { type: 'table' }> }) {
  return (
    <div className="md-table-wrap" role="region" aria-label="Scrollable table" tabIndex={0}>
      <table className="md-table">
        <thead>
          <tr>
            {block.headers.map((header, index) => (
              <th key={index} style={{ textAlign: block.align[index] }}>{renderInline(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ textAlign: block.align[cellIndex] }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Renderer ────────────────────────────────────────────────── */

export function Markdown({ md, animateIn = false }: { md: string; animateIn?: boolean }) {
  const blocks = parseBlocks(md)
  return (
    <div className={`md${animateIn ? ' md--streaming' : ''}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const Tag = block.level <= 2 ? 'h2' : 'h3'
            return <Tag key={i}>{renderInline(block.text)}</Tag>
          }
          case 'paragraph':
            return <p key={i}>{renderInline(block.text)}</p>
          case 'list':
            return <ListBlock key={i} list={block.list} />
          case 'quote':
            return (
              <blockquote key={i} className="md-quote">
                <p>{renderInline(block.text)}</p>
              </blockquote>
            )
          case 'divider':
            return <hr key={i} />
          case 'table':
            return <MarkdownTable key={i} block={block} />
          case 'code':
            return <CodeBlock key={i} lang={block.lang} code={block.code} />
        }
      })}
    </div>
  )
}
