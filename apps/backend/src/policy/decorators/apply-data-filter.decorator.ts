import { SetMetadata } from '@nestjs/common';
import { ObjectType } from 'typeorm';

export const APPLY_DATA_FILTER_KEY = 'apply_data_filter';

/**
 * Metadata stored by @ApplyDataFilter decorator
 */
export interface ApplyDataFilterMetadata {
  /** Entity class to filter (e.g., Policy, File) */
  entity: ObjectType<unknown>;
  /** Resource name (optional, defaults to entity name lowercase) */
  resource?: string;
  /** Action name (optional, defaults to 'read') */
  action?: string;
}

/**
 * ApplyDataFilter Decorator
 *
 * Marks a controller method to apply data-level filtering based on ABAC policies.
 * The DataFilterInterceptor will read this metadata and apply query conditions
 * to filter data based on user's permissions.
 *
 * @param entity - The TypeORM entity class to filter (e.g., Policy, File)
 * @param resource - Optional resource name (defaults to entity name in lowercase)
 * @param action - Optional action name (defaults to 'read')
 *
 * @example
 * // Basic usage with just entity
 * @Get()
 * @ApplyDataFilter(Policy)
 * findAll() { ... }
 *
 * @example
 * // With explicit resource and action
 * @Get('policies')
 * @ApplyDataFilter(Policy, 'policy', 'read')
 * getPolicies() { ... }
 *
 * @example
 * // With entity and action only
 * @Get('files')
 * @ApplyDataFilter(File, undefined, 'list')
 * getFiles() { ... }
 */
export const ApplyDataFilter = (
  entity: ObjectType<unknown>,
  resource?: string,
  action?: string
): MethodDecorator & ClassDecorator => {
  const metadata: ApplyDataFilterMetadata = {
    entity,
    resource,
    action,
  };
  return SetMetadata(APPLY_DATA_FILTER_KEY, metadata);
};
