import { useStore } from '@/store';

export function SceneEditorPanel() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const selectedId = useStore((s) => s.scene.doc.selectedFixtureId);
  const lastAutosave = useStore((s) => s.persistence.lastAutosaveAt);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const pastLen = useStore((s) => s.history.past.length);
  const futureLen = useStore((s) => s.history.future.length);
  const dispatch = useStore((s) => s.sceneDispatch);
  const undo = useStore((s) => s.sceneUndo);
  const redo = useStore((s) => s.sceneRedo);
  const setGridSnap = useStore((s) => s.editorSetGridSnap);
  const setGridSize = useStore((s) => s.editorSetGridSize);
  const newFixtureId = useStore((s) => s.newFixtureId);

  const selected = fixtures.find((f) => f.id === selectedId);

  return (
    <div className="editor-panel">
      <div className="editor-header">Scene editor</div>

      <div className="editor-row">
        <button type="button" disabled={pastLen === 0} onClick={undo}>
          ↶ Undo
        </button>
        <button type="button" disabled={futureLen === 0} onClick={redo}>
          ↷ Redo
        </button>
      </div>

      <div className="editor-row">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && dispatch({
            type: 'fixture.duplicate',
            id: selected.id,
            newId: newFixtureId(),
          })}
        >
          Duplicate
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && dispatch({ type: 'fixture.remove', id: selected.id })}
        >
          Delete
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            selected &&
            dispatch({
              type: 'fixture.update',
              id: selected.id,
              patch: { enabled: !selected.enabled },
            })
          }
        >
          {selected?.enabled === false ? 'Enable' : 'Disable'}
        </button>
      </div>

      <div className="editor-row">
        <label>
          <input
            type="checkbox"
            checked={gridSnap}
            onChange={(e) => setGridSnap(e.target.checked)}
          />
          {' '}grid snap
        </label>
        <label>
          step{' '}
          <input
            type="number"
            min={0.05}
            max={5}
            step={0.05}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) || 0.5)}
            style={{ width: 56 }}
          />
        </label>
      </div>

      <div className="editor-stat">
        fixtures: <strong>{fixtures.length}</strong>
        {selected && (
          <>
            {' · selected: '}
            <span title={selected.id}>{selected.name}</span>
          </>
        )}
      </div>

      {selected && (
        <div className="editor-detail">
          <div>id: <code>{selected.id.slice(0, 8)}</code></div>
          <div>pos: {selected.position.map((n) => n.toFixed(2)).join(', ')}</div>
          <div>rot: {selected.rotation.map((n) => n.toFixed(2)).join(', ')}</div>
          <div>target: {selected.target.map((n) => n.toFixed(2)).join(', ')}</div>
        </div>
      )}

      <div className="editor-stat">
        autosave: {lastAutosave ? new Date(lastAutosave).toLocaleTimeString() : 'never'}
      </div>

      <details className="editor-shortcuts">
        <summary>shortcuts</summary>
        <ul>
          <li><kbd>g</kbd> translate · <kbd>r</kbd> rotate</li>
          <li><kbd>Esc</kbd> cancel placement / selection</li>
          <li><kbd>Del</kbd> delete · <kbd>⌘ D</kbd> duplicate</li>
          <li><kbd>⌘ Z</kbd> undo · <kbd>⇧⌘ Z</kbd> redo</li>
        </ul>
      </details>
    </div>
  );
}