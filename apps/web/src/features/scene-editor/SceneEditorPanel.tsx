import { useStore } from '@/store';

export function SceneEditorPanel() {
  const fixtures = useStore((s) => s.scene.doc.fixtures);
  const selected = useStore((s) => s.scene.doc.selectedFixtureId);
  const lastAutosave = useStore((s) => s.persistence.lastAutosaveAt);

  return (
    <div className="editor-panel">
      <div className="editor-header">Scene editor</div>
      <div className="editor-stat">
        fixtures: <strong>{fixtures.length}</strong>
        {selected && <span> · selected: {selected.slice(0, 8)}</span>}
      </div>
      <div className="editor-stat">
        autosave: {lastAutosave ? new Date(lastAutosave).toLocaleTimeString() : 'never'}
      </div>
      <p className="editor-todo">Move/rotate/duplicate/undo land in step 4.</p>
    </div>
  );
}