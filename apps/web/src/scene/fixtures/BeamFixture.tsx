import type { FixtureInstance } from '@stl/fixtures';
import { AimingFixture, BEAM_VISUAL } from './AimingFixture';
import type { FixtureInteractionProps } from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function BeamFixture(props: Props) {
  return <AimingFixture {...props} visual={BEAM_VISUAL} />;
}
