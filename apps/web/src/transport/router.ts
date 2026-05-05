import type { DownstreamMessage } from '@stl/protocol';

type HandlerMap = {
  [K in DownstreamMessage['type']]?: (msg: Extract<DownstreamMessage, { type: K }>) => void;
};

export function routeDownstream(msg: DownstreamMessage, handlers: HandlerMap): void {
  const fn = handlers[msg.type] as ((m: DownstreamMessage) => void) | undefined;
  fn?.(msg);
}
