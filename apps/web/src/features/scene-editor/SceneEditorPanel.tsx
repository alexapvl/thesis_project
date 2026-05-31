import { useStore } from '@/store';

export function SceneEditorPanel() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const structures = useStore((s) => s.scene.doc.structures);
  const selectedFixtureId = useStore((s) => s.scene.doc.selectedFixtureId);
  const selectedStructureId = useStore((s) => s.scene.doc.selectedStructureId);
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

  const selectedFixture = fixtures.find((f) => f.id === selectedFixtureId);
  const selectedStructure = structures.find((s) => s.id === selectedStructureId);

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
          disabled={!selectedFixture && !selectedStructure}
          onClick={() => {
            if (selectedStructure) {
              dispatch({
                type: 'structure.duplicate',
                id: selectedStructure.id,
                newId: newFixtureId(),
              });
            } else if (selectedFixture) {
              dispatch({
                type: 'fixture.duplicate',
                id: selectedFixture.id,
                newId: newFixtureId(),
              });
            }
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          disabled={!selectedFixture && !selectedStructure}
          onClick={() => {
            if (selectedStructure) {
              dispatch({ type: 'structure.remove', id: selectedStructure.id });
            } else if (selectedFixture) {
              dispatch({ type: 'fixture.remove', id: selectedFixture.id });
            }
          }}
        >
          Delete
        </button>
        {selectedFixture && (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'fixture.update',
                id: selectedFixture.id,
                patch: { enabled: !selectedFixture.enabled },
              })
            }
          >
            {selectedFixture.enabled === false ? 'Enable' : 'Disable'}
          </button>
        )}
      </div>

      {selectedFixture?.mount && (
        <div className="editor-row">
          <button
            type="button"
            onClick={() => dispatch({ type: 'fixture.unmount', id: selectedFixture.id })}
          >
            Unmount
          </button>
        </div>
      )}

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
        structures: <strong>{structures.length}</strong>
        {' · '}fixtures: <strong>{fixtures.length}</strong>
      </div>

      {selectedStructure && (
        <div className="editor-detail">
          <div>
            structure: <span title={selectedStructure.id}>{selectedStructure.name}</span>
          </div>
          <div>pos: {selectedStructure.position.map((n) => n.toFixed(2)).join(', ')}</div>
          <div>rot: {selectedStructure.rotation.map((n) => n.toFixed(2)).join(', ')}</div>
        </div>
      )}

      {selectedFixture && (
        <div className="editor-detail">
          <div>
            fixture: <span title={selectedFixture.id}>{selectedFixture.name}</span>
            {selectedFixture.mount && (
              <>
                {' '}
                <code>
                  mounted:{selectedFixture.mount.socketId.slice(0, 12)}
                </code>
              </>
            )}
          </div>
          <div>pos: {selectedFixture.position.map((n) => n.toFixed(2)).join(', ')}</div>
          <div>rot: {selectedFixture.rotation.map((n) => n.toFixed(2)).join(', ')}</div>
          <div>target: {selectedFixture.target.map((n) => n.toFixed(2)).join(', ')}</div>
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
          <li><kbd>u</kbd> unmount selected fixture</li>
          <li><kbd>⌘ Z</kbd> undo · <kbd>⇧⌘ Z</kbd> redo</li>
        </ul>
      </details>
    </div>
  );
}
