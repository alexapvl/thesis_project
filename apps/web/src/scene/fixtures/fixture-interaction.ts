import type { ThreeEvent } from '@react-three/fiber';

export const HOVER_TINT = '#22d3ee';
export const SELECTED_TINT = '#fbbf24';

export type FixtureInteractionProps = {
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function fixturePointerHandlers(
  instanceId: string,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(instanceId);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(instanceId);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = 'default';
    },
  };
}
