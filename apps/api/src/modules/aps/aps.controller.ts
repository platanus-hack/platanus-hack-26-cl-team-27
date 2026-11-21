import {
  Controller,
  Get,
  Header,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  ApsAuth,
  apsErrorStatus,
  VIEWER_SCOPES,
  type ApsToken,
} from './aps-auth.ts';
import { APS_AUTH, MODELS_CATALOG } from './aps.tokens.ts';
import type { ModelsCatalog, ViewerModel } from './models-catalog.ts';

@Controller('aps')
export class ApsController {
  private readonly logger = new Logger(ApsController.name);
  private readonly auth: ApsAuth | null;
  private readonly catalog: Pick<ModelsCatalog, 'list'> | null;

  constructor(
    @Inject(APS_AUTH) auth: ApsAuth | null,
    @Inject(MODELS_CATALOG) catalog: Pick<ModelsCatalog, 'list'> | null,
  ) {
    this.auth = auth;
    this.catalog = catalog;
  }

  @Get('viewer-token')
  @Header('Cache-Control', 'no-store')
  async viewerToken(): Promise<ApsToken> {
    if (!this.auth) {
      throw new ServiceUnavailableException({
        code: 'aps_not_configured',
        message: 'Faltan APS_CLIENT_ID y APS_CLIENT_SECRET',
      });
    }
    try {
      return await this.auth.getToken(VIEWER_SCOPES);
    } catch (error) {
      this.logger.error(
        `APS no entregó el token del visor (HTTP ${apsErrorStatus(error) ?? '?'})`,
      );
      throw new ServiceUnavailableException({
        code: 'aps_unavailable',
        message: 'APS no entregó el token del visor',
      });
    }
  }

  @Get('models')
  async models(): Promise<{ models: readonly ViewerModel[] }> {
    if (!this.catalog) {
      throw new ServiceUnavailableException({
        code: 'aps_not_configured',
        message: 'Faltan APS_CLIENT_ID, APS_CLIENT_SECRET o APS_BUCKET_KEY',
      });
    }
    try {
      return { models: await this.catalog.list() };
    } catch (error) {
      this.logger.error(
        `APS no entregó la lista de modelos (HTTP ${apsErrorStatus(error) ?? '?'})`,
      );
      throw new ServiceUnavailableException({
        code: 'aps_unavailable',
        message: 'APS no entregó la lista de modelos',
      });
    }
  }
}
