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

export function GoalpostStructure({
  instance,
  selected,
  hovered,
  onSelect,
  onHover,
  ghost,
  wireframe,
}: Props) {
  const span = instance.dims.span ?? 4;
  const height = instance.dims.height ?? 4;
  const half = span / 2;
  const handlers = ghost || wireframe ? {} : structurePointerHandlers(instance.id, onSelect, onHover);
  const preview = ghost || wireframe;

  return (
    <group position={instance.position} rotation={instance.rotation} {...handlers}>
      <group position={[-half, 0, 0]}>
        <TrussBasePlate width={0.6} ghost={ghost} wireframe={wireframe} />
        <TrussSegment length={height} axis="y" ghost={ghost} wireframe={wireframe} />
        <TrussCapPlate width={0.6} height={height} ghost={ghost} wireframe={wireframe} />
      </group>
      <group position={[half, 0, 0]}>
        <TrussBasePlate width={0.6} ghost={ghost} wireframe={wireframe} />
        <TrussSegment length={height} axis="y" ghost={ghost} wireframe={wireframe} />
        <TrussCapPlate width={0.6} height={height} ghost={ghost} wireframe={wireframe} />
      </group>
      <group position={[-half, height, 0]}>
        <TrussSegment length={span} axis="x" ghost={ghost} wireframe={wireframe} />
      </group>
      {!preview && (
        <SelectionBoxes
          selected={selected}
          hovered={hovered}
          size={[span + 0.5, height + 0.3, 0.6]}
          offset={[0, height / 2, 0]}
        />
      )}
    </group>
  );
}
