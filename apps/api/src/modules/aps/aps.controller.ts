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
import { APS_AUTH, MODELS_CATALOG_READER } from './aps.tokens.ts';
import type { CatalogModel, ModelsCatalog } from './models-catalog.ts';

export interface ViewerModel {
  readonly file: string;
  readonly discipline: CatalogModel['discipline'];
  readonly urn: string;
}

@Controller('aps')
export class ApsController {
  private readonly logger = new Logger(ApsController.name);
  private readonly auth: ApsAuth | null;
  private readonly readCatalog: () => Promise<ModelsCatalog | null>;

  constructor(
    @Inject(APS_AUTH) auth: ApsAuth | null,
    @Inject(MODELS_CATALOG_READER)
    readCatalog: () => Promise<ModelsCatalog | null>,
  ) {
    this.auth = auth;
    this.readCatalog = readCatalog;
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
  async models(): Promise<{ models: ViewerModel[] }> {
    const catalog = await this.readCatalog();
    return {
      models: (catalog?.models ?? [])
        .filter((model) => model.status === 'success')
        .map(({ file, discipline, urn }) => ({ file, discipline, urn })),
    };
  }
}
