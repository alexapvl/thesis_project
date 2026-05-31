import type { FixtureInstance } from '@stl/fixtures';
import { AimingFixture, WASH_VISUAL } from './AimingFixture';
import type { FixtureInteractionProps } from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function WashFixture(props: Props) {
  return <AimingFixture {...props} visual={WASH_VISUAL} />;
}
