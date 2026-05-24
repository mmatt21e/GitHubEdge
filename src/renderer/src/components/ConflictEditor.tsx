import { useEffect, useMemo, useState } from 'react'

interface Conflict {
  raw: string
  ours: string
  theirs: string
}

function parseConflicts(content: string): Conflict[] {
  const lines = content.split('\n')
  const conflicts: Conflict[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const start = i
      const ours: string[] = []
      const theirs: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('=======') && !lines[i].startsWith('|||||||')) {
        ours.push(lines[i])
        i++
      }
      // Skip the optional diff3 base section.
      if (i < lines.length && lines[i].startsWith('|||||||')) {
        i++
        while (i < lines.length && !lines[i].startsWith('=======')) i++
      }
      if (i < lines.length && lines[i].startsWith('=======')) i++
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i])
        i++
      }
      const end = i // the >>>>>>> line
      conflicts.push({
        raw: lines.slice(start, end + 1).join('\n'),
        ours: ours.join('\n'),
        theirs: theirs.join('\n')
      })
      i++
    } else {
      i++
    }
  }
  return conflicts
}

interface Props {
  repoPath: string
  filePath: string
  onClose: () => void
  onResolved: () => void
  notify: (message: string, error?: boolean) => void
}

export function ConflictEditor({ repoPath, filePath, onClose, onResolved, notify }: Props): JSX.Element {
  const [text, setText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.git.fileContent(repoPath, filePath).then((res) => {
      setText(res.ok ? res.data ?? '' : `Error: ${res.error}`)
    })
  }, [repoPath, filePath])

  const conflicts = useMemo(() => (text === null ? [] : parseConflicts(text)), [text])

  function applyChoice(raw: string, replacement: string): void {
    setText((t) => (t === null ? t : t.replace(raw, replacement)))
  }

  async function save(): Promise<void> {
    if (text === null) return
    setSaving(true)
    const res = await window.api.git.writeConflict(repoPath, filePath, text)
    setSaving(false)
    if (!res.ok) return notify(res.error!, true)
    if (res.data!.staged) {
      notify(`Resolved ${filePath}.`)
      onResolved()
    } else {
      notify('Saved, but conflict markers remain. Resolve them all to finish.', true)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 900 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Resolve conflicts · {filePath}</h2>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {text === null ? (
            <div className="placeholder">
              <span className="spinner" /> &nbsp;Loading…
            </div>
          ) : (
            <>
              <p className="muted">
                {conflicts.length > 0
                  ? `${conflicts.length} conflict region${conflicts.length === 1 ? '' : 's'}. Use the buttons to pick a side, or edit the file directly below.`
                  : 'No conflict markers detected — review and save to mark resolved.'}
              </p>
              {conflicts.map((c, i) => (
                <div key={i} className="conflict-hunk">
                  <div className="conflict-side">
                    <div className="conflict-side-head ours">Current (ours)</div>
                    <pre>{c.ours || '(empty)'}</pre>
                    <button className="btn" onClick={() => applyChoice(c.raw, c.ours)}>
                      Use ours
                    </button>
                  </div>
                  <div className="conflict-side">
                    <div className="conflict-side-head theirs">Incoming (theirs)</div>
                    <pre>{c.theirs || '(empty)'}</pre>
                    <button className="btn" onClick={() => applyChoice(c.raw, c.theirs)}>
                      Use theirs
                    </button>
                  </div>
                  <div className="conflict-both">
                    <button
                      className="btn-ghost"
                      onClick={() => applyChoice(c.raw, `${c.ours}\n${c.theirs}`)}
                    >
                      Use both (ours then theirs)
                    </button>
                  </div>
                </div>
              ))}
              <div className="field" style={{ marginTop: 12 }}>
                <label>File contents</label>
                <textarea
                  className="conflict-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-accent"
            disabled={saving || text === null}
            onClick={save}
          >
            {saving ? <span className="spinner" /> : 'Save & stage'}
          </button>
        </div>
      </div>
    </div>
  )
}
