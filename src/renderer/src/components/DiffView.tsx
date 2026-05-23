import { diffLineClass } from '../util'

interface Props {
  title?: string
  diff: string | null
  loading?: boolean
}

export function DiffView({ title, diff, loading }: Props): JSX.Element {
  if (loading) {
    return <div className="placeholder"><span className="spinner" /> &nbsp;Loading diff…</div>
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
      {lines.map((line, i) => (
        <div key={i} className={diffLineClass(line)}>
          {line || ' '}
        </div>
      ))}
    </div>
  )
}
