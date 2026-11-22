import type { ApsConnectionService } from './aps-connection.service.ts';

export const APS_CONNECTIONS = Symbol('APS_CONNECTIONS');

export interface ApsConnections {
  readonly service: ApsConnectionService;
  readonly callbackUrl: string;
}
