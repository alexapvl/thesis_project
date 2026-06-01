import type { StructureInstance } from '@stl/fixtures';
import { TrussSegment } from './trussGeometry';
import type { StructureInteractionProps } from './structure-interaction';
import { structurePointerHandlers } from './structure-interaction';
import { SelectionBoxes } from '@/scene/fixtures/aiming-parts';
import { StructureRoot } from './StructureRoot';

type Props = StructureInteractionProps & {
  instance: StructureInstance;
  ghost?: boolean;
  wireframe?: boolean;
};

export function BeamStructure({
  instance,
  selected,
  hovered,
  onSelect,
  onHover,
  ghost,
  wireframe,
}: Props) {
  const length = instance.dims.length ?? 4;
  const handlers = ghost || wireframe ? {} : structurePointerHandlers(instance.id, onSelect, onHover);
  const preview = ghost || wireframe;

  return (
    <StructureRoot instance={instance} ghost={ghost} wireframe={wireframe} handlers={handlers}>
      <TrussSegment length={length} axis="z" ghost={ghost} wireframe={wireframe} />
      {!preview && (
        <SelectionBoxes
          selected={selected}
          hovered={hovered}
          size={[0.5, 0.6, length + 0.3]}
          offset={[0, 0.15, length / 2]}
        />
      )}
    </StructureRoot>
  );
}
