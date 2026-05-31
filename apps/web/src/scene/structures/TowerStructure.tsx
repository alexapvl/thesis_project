import type { StructureInstance } from '@stl/fixtures';
import { TrussBasePlate, TrussCapPlate, TrussSegment } from './trussGeometry';
import type { StructureInteractionProps } from './structure-interaction';
import { structurePointerHandlers } from './structure-interaction';
import { SelectionBoxes } from '@/scene/fixtures/aiming-parts';

type Props = StructureInteractionProps & {
  instance: StructureInstance;
  ghost?: boolean;
  wireframe?: boolean;
};

export function TowerStructure({
  instance,
  selected,
  hovered,
  onSelect,
  onHover,
  ghost,
  wireframe,
}: Props) {
  const height = instance.dims.height ?? 4;
  const width = 0.8;
  const handlers = ghost || wireframe ? {} : structurePointerHandlers(instance.id, onSelect, onHover);
  const preview = ghost || wireframe;

  return (
    <group position={instance.position} rotation={instance.rotation} {...handlers}>
      <TrussBasePlate width={width} ghost={ghost} wireframe={wireframe} />
      <TrussSegment length={height} axis="y" ghost={ghost} wireframe={wireframe} />
      <TrussCapPlate width={width} height={height} ghost={ghost} wireframe={wireframe} />
      {!preview && (
        <SelectionBoxes
          selected={selected}
          hovered={hovered}
          size={[0.5, height + 0.2, 0.5]}
          offset={[0, height / 2, 0]}
        />
      )}
    </group>
  );
}
