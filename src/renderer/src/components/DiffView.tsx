import { useMemo } from 'react'
import hljs from 'highlight.js/lib/common'
import { diffLineClass, languageForPath } from '../util'

interface Props {
  title?: string
  filePath?: string
  diff: string | null
  loading?: boolean
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlight(code: string, lang: string | undefined): string {
  if (code === '') return ''
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      /* fall through */
    }
  }
  return escapeHtml(code)
}

export function DiffView({ title, filePath, diff, loading }: Props): JSX.Element {
  const lang = useMemo(() => languageForPath(filePath), [filePath])

  if (loading) {
    return (
      <div className="placeholder">
        <span className="spinner" /> &nbsp;Loading diff…
      </div>
    )
  }
  if (diff === null) {
    return <div className="placeholder">Select a file to view its changes.</div>
  }
  if (diff.trim() === '') {
    return <div className="placeholder">No textual changes to display.</div>
  }

  const lines = diff.split('\n')
  return (
    <div className="diff-view">
      {title && <div className="diff-header">{title}</div>}
      {lines.map((line, i) => {
        const cls = diffLineClass(line)
        // Syntax-highlight only code lines (added / removed / context).
        if (cls === 'diff-line add' || cls === 'diff-line del' || cls === 'diff-line') {
          const sign = line.charAt(0)
          const hasSign = sign === '+' || sign === '-' || sign === ' '
          const code = hasSign ? line.slice(1) : line
          return (
            <div key={i} className={cls}>
              {hasSign && <span className="diff-sign">{sign}</span>}
              <span dangerouslySetInnerHTML={{ __html: highlight(code, lang) || ' ' }} />
            </div>
          )
        }
        return (
          <div key={i} className={cls}>
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}
