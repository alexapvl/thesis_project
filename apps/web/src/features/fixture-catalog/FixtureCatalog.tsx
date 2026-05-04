import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';

export function FixtureCatalog() {
  const pendingTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const setPlacement = useStore((s) => s.editorSetPlacement);

  return (
    <div className="catalog">
      <div className="catalog-header">Fixture catalog</div>
      <ul className="catalog-list">
        {BUILTIN_FIXTURES.map((def) => {
          const active = def.typeId === pendingTypeId;
          return (
            <li key={def.typeId}>
              <button
                type="button"
                className={active ? 'catalog-item active' : 'catalog-item'}
                onClick={() => setPlacement(active ? null : def.typeId)}
                title={`Click to enter placement mode for ${def.label}`}
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
          Click on the stage to place. Press <kbd>Esc</kbd> to cancel.
        </div>
      )}
    </div>
  );
}