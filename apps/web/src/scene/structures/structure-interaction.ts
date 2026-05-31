import type { ThreeEvent } from '@react-three/fiber';

export const STRUCTURE_HOVER_TINT = '#22d3ee';
export const STRUCTURE_SELECTED_TINT = '#fbbf24';

export type StructureInteractionProps = {
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function structurePointerHandlers(
  structureId: string,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(structureId);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(structureId);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = 'default';
    },
  };
}
