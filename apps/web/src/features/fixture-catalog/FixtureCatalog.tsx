import { BUILTIN_FIXTURES, BUILTIN_STRUCTURES, type FixtureKind } from '@stl/fixtures';
import { useStore } from '@/store';
import { FIXTURE_DRAG_MIME } from '@/scene/editor/DragPlacementController';

const FIXTURE_GROUPS: { label: string; kinds: FixtureKind[] }[] = [
  { label: 'Moving heads', kinds: ['spot', 'wash', 'beam'] },
  { label: 'Effects', kinds: ['laser', 'strobe', 'blinder'] },
  { label: 'Static & arrays', kinds: ['par', 'bar', 'matrix'] },
  { label: 'Debug', kinds: ['point'] },
];

function CatalogList({
  items,
  pendingId,
  onActivate,
  onDragStart,
}: {
  items: { typeId: string; kind: string; label: string }[];
  pendingId: string | null;
  onActivate: (typeId: string, active: boolean) => void;
  onDragStart: (ev: React.DragEvent<HTMLLIElement>, typeId: string) => void;
}) {
  return (
    <ul className="catalog-list">
      {items.map((def) => {
        const active = def.typeId === pendingId;
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
              onClick={() => onActivate(def.typeId, active)}
              title="Click to enter placement mode, or drag onto the stage"
            >
              <span className="catalog-kind">{def.kind}</span>
              <span className="catalog-label">{def.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FixtureCatalog() {
  const pendingFixtureTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const pendingStructureTypeId = useStore((s) => s.editor.pendingStructureTypeId);
  const setPlacement = useStore((s) => s.editorSetPlacement);
  const setStructurePlacement = useStore((s) => s.editorSetStructurePlacement);

  function onDragStart(ev: React.DragEvent<HTMLLIElement>, typeId: string) {
    ev.dataTransfer.setData(FIXTURE_DRAG_MIME, typeId);
    ev.dataTransfer.effectAllowed = 'copy';
  }

  const placementActive = pendingFixtureTypeId ?? pendingStructureTypeId;

  return (
    <div className="catalog">
      <div className="catalog-header">Stage catalog</div>

      <div className="catalog-group">
        <div className="catalog-group-label">Structures</div>
        <CatalogList
          items={BUILTIN_STRUCTURES.map((d) => ({ typeId: d.typeId, kind: d.kind, label: d.label }))}
          pendingId={pendingStructureTypeId}
          onActivate={(typeId, active) => setStructurePlacement(active ? null : typeId)}
          onDragStart={onDragStart}
        />
      </div>

      {FIXTURE_GROUPS.map((group) => {
        const items = BUILTIN_FIXTURES.filter((d) => group.kinds.includes(d.kind));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="catalog-group">
            <div className="catalog-group-label">{group.label}</div>
            <CatalogList
              items={items.map((d) => ({ typeId: d.typeId, kind: d.kind, label: d.label }))}
              pendingId={pendingFixtureTypeId}
              onActivate={(typeId, active) => setPlacement(active ? null : typeId)}
              onDragStart={onDragStart}
            />
          </div>
        );
      })}

      {placementActive && (
        <div className="catalog-hint">
          Click on the stage to place. Press <kbd>Esc</kbd> or right-click to cancel.
        </div>
      )}
      <div className="catalog-tip">Tip: drag a row onto the stage. Select a fixture, then click a cyan socket to mount.</div>
    </div>
  );
}
