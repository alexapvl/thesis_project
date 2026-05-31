import { useState, type ComponentType } from 'react';
import type { StructureInstance, StructureKind } from '@stl/fixtures';
import { useStore } from '@/store';
import { TowerStructure } from './TowerStructure';
import { BeamStructure } from './BeamStructure';
import { GoalpostStructure } from './GoalpostStructure';
import { BasePlateStructure } from './BasePlateStructure';
import type { StructureInteractionProps } from './structure-interaction';

type StructureComponent = ComponentType<
  StructureInteractionProps & { instance: StructureInstance }
>;

const STRUCTURE_BY_KIND: Record<StructureKind, StructureComponent> = {
  tower: TowerStructure,
  beam: BeamStructure,
  goalpost: GoalpostStructure,
  baseplate: BasePlateStructure,
};

export function StructureRenderer() {
  const structures = useStore((s) => s.scene.doc.structures);
  const selectedId = useStore((s) => s.scene.doc.selectedStructureId);
  const dispatch = useStore((s) => s.sceneDispatch);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {structures.map((inst) => {
        const Component = STRUCTURE_BY_KIND[inst.kind];
        const selected = inst.id === selectedId;
        const hovered = inst.id === hoveredId;
        const onSelect = (id: string) => dispatch({ type: 'structure.select', id });
        const onHover = (id: string | null) => setHoveredId(id);
        return (
          <Component
            key={inst.id}
            instance={inst}
            selected={selected}
            hovered={hovered}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}
