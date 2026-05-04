import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { FIXTURE_DRAG_MIME } from '@/scene/editor/DragPlacementController';

export function FixtureCatalog() {
  const pendingTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const setPlacement = useStore((s) => s.editorSetPlacement);

  function onDragStart(ev: React.DragEvent<HTMLLIElement>, typeId: string) {
    ev.dataTransfer.setData(FIXTURE_DRAG_MIME, typeId);
    ev.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="catalog">
      <div className="catalog-header">Fixture catalog</div>
      <ul className="catalog-list">
        {BUILTIN_FIXTURES.map((def) => {
          const active = def.typeId === pendingTypeId;
          return (
            <li
              key={def.typeId}
              draggable
              onDragStart={(e) => onDragStart(e, def.typeId)}
              className="catalog-row"
            >
              <button
                type="button"
                className={active ? 'catalog-item active' : 'catalog-item'}
                onClick={() => setPlacement(active ? null : def.typeId)}
                title={`Click to enter placement mode, or drag onto the stage`}
              >
                <span className="catalog-kind">{def.kind}</span>
                <span className="catalog-label">{def.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {pendingTypeId && (
        <div className="catalog-hint">
          Click on the stage to place. Press <kbd>Esc</kbd> or right-click to cancel.
        </div>
      )}
      <div className="catalog-tip">
        Tip: drag a fixture row directly onto the stage.
      </div>
    </div>
  );
}