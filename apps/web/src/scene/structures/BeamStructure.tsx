import type { StructureInstance } from '@stl/fixtures';
import { TrussBasePlate, TrussSegment } from './trussGeometry';
import type { StructureInteractionProps } from './structure-interaction';
import { structurePointerHandlers } from './structure-interaction';
import { SelectionBoxes } from '@/scene/fixtures/aiming-parts';

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
    <group position={instance.position} rotation={instance.rotation} {...handlers}>
      <TrussBasePlate width={0.6} ghost={ghost} wireframe={wireframe} />
      <group position={[0, 0.19, 0]}>
        <TrussSegment length={length} axis="z" ghost={ghost} wireframe={wireframe} />
      </group>
      {!preview && (
        <SelectionBoxes
          selected={selected}
          hovered={hovered}
          size={[0.5, 0.6, length + 0.3]}
          offset={[0, 0.19, length / 2]}
        />
      )}
    </group>
  );
}
