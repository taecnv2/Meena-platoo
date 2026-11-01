import { SetMetadata, type Type } from '@nestjs/common';

export type ZoneScopeSource = 'param' | 'body' | 'query' | 'entity';

/**
 * Implemented by any feature service that ZoneScopeGuard needs to resolve an
 * existing record's zone from (e.g. approving a requisition scopes off the
 * requisition's own toZoneId, not something present on the request).
 */
export interface ZoneLookupService {
  findZoneIdById(id: string, field: string): Promise<string>;
}

export interface ZoneScopeOptions {
  source: ZoneScopeSource;
  /** param/body/query: the field name to read. entity: the field passed through to the lookup service. */
  field: string;
  /** entity source only: route param holding the entity id. Defaults to 'id'. */
  idParam?: string;
  /** entity source only: the service class ZoneScopeGuard resolves via ModuleRef to perform the lookup. */
  lookupService?: Type<ZoneLookupService>;
  /**
   * When true, a request that carries no zone id passes (the service then falls back to a
   * server-chosen zone, e.g. the PO's WAREHOUSE delivery zone). A zone id that IS supplied is
   * still checked against the user's zones.
   */
  optional?: boolean;
}

export const ZONE_SCOPE_KEY = 'zoneScope';
export const ZoneScope = (options: ZoneScopeOptions) =>
  SetMetadata(ZONE_SCOPE_KEY, options);
