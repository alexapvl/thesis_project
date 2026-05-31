import type { StructureInstance } from '@stl/fixtures';
import { TrussBasePlate } from './trussGeometry';
import type { StructureInteractionProps } from './structure-interaction';
import { structurePointerHandlers } from './structure-interaction';
import { SelectionBoxes } from '@/scene/fixtures/aiming-parts';

type Props = StructureInteractionProps & {
  instance: StructureInstance;
  ghost?: boolean;
  wireframe?: boolean;
};

export function BasePlateStructure({
  instance,
  selected,
  hovered,
  onSelect,
  onHover,
  ghost,
  wireframe,
}: Props) {
  const width = instance.dims.width ?? 0.8;
  const handlers = ghost || wireframe ? {} : structurePointerHandlers(instance.id, onSelect, onHover);
  const preview = ghost || wireframe;

  return (
    <group position={instance.position} rotation={instance.rotation} {...handlers}>
      <TrussBasePlate width={width} ghost={ghost} wireframe={wireframe} />
      {!preview && (
        <SelectionBoxes selected={selected} hovered={hovered} size={[width + 0.1, 0.15, width + 0.1]} />
      )}
    </group>
  );
}
