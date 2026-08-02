import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

/* ── Inline formatting: `code`, **bold**, *italic* ───────────── */

const INLINE_RE = /(`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*)/g

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{renderInline(part.slice(2, -2))}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}

/* ── Block parsing ───────────────────────────────────────────── */

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang: string; code: string; closed: boolean }

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] | null = null
  let code: { lang: string; lines: string[] } | null = null

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', text: para.join(' ') })
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', items: list })
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (code) {
      if (line.startsWith('```')) {
        blocks.push({ type: 'code', lang: code.lang, code: code.lines.join('\n'), closed: true })
        code = null
      } else {
        code.lines.push(raw)
      }
      continue
    }
    if (line.startsWith('```')) {
      flushPara()
      flushList()
      code = { lang: line.slice(3).trim(), lines: [] }
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      flushList()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara()
      list = list ?? []
      list.push(line.replace(/^[-*]\s+/, ''))
      continue
    }
    if (line === '') {
      flushPara()
      flushList()
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
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
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'code':
            return <CodeBlock key={i} lang={block.lang} code={block.code} />
        }
      })}
    </div>
  )
}
