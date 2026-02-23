import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { SUBJECT_TYPE_KEY, SubjectTypeConfig } from '../decorators/register-subject-type.decorator';

/**
 * Represents a single value for a subject type.
 * Used to return lists of available subjects (e.g., roles, users, departments).
 */
export interface SubjectValue {
  /**
   * Unique identifier for the subject value
   */
  id: string;

  /**
   * Human-readable display label
   */
  label: string;
}

/**
 * Internal registry entry for a subject type provider.
 */
interface SubjectTypeProvider {
  config: SubjectTypeConfig;
  instance: { getValues(): Promise<SubjectValue[]> };
}

/**
 * SubjectTypeRegistryService
 *
 * Scans and registers services decorated with @RegisterSubjectType decorator.
 * Provides centralized access to all registered subject types and their available values.
 *
 * This service is used by the policy system to dynamically discover and list
 * available subjects for permission assignment (e.g., roles, users, departments).
 *
 * Built-in types:
 * - 'all': A wildcard type that represents all entities (always returns `{ id: '*', label: '所有' }`)
 *
 * @example
 * // Get all registered subject types
 * const types = subjectTypeRegistry.getTypes();
 * // Returns: [{ type: 'role', label: '角色' }, { type: 'user', label: '用户' }, ...]
 *
 * @example
 * // Get available values for a specific type
 * const roles = await subjectTypeRegistry.getValues('role');
 * // Returns: [{ id: '1', label: 'Admin' }, { id: '2', label: 'User' }, ...]
 */
@Injectable()
export class SubjectTypeRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SubjectTypeRegistryService.name);

  /**
   * Map of registered subject type providers.
   * Key is the type identifier (e.g., 'role', 'user').
   */
  private readonly providers = new Map<string, SubjectTypeProvider>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector
  ) {}

  /**
   * Triggered when the module is initialized.
   * Scans all providers for @RegisterSubjectType decorators and registers them.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Scanning for subject type providers...');

    // Register built-in 'all' type
    this.registerBuiltInTypes();

    // Scan all providers for @RegisterSubjectType decorator
    const providers = this.discoveryService.getProviders();
    let registeredCount = 0;

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const metadata = this.reflector.get<SubjectTypeConfig>(
        SUBJECT_TYPE_KEY,
        instance.constructor
      );

      if (metadata) {
        this.registerProvider(metadata, instance);
        registeredCount++;
        this.logger.log(`Registered subject type: ${metadata.type} (${metadata.label})`);
      }
    }

    this.logger.log(`Subject type scan complete. Registered ${registeredCount} provider(s).`);
  }

  /**
   * Register built-in subject types.
   * Currently only registers the 'all' wildcard type.
   */
  private registerBuiltInTypes(): void {
    // Register 'all' type as a built-in provider
    const allConfig: SubjectTypeConfig = { type: 'all', label: '所有' };
    const allProvider: SubjectTypeProvider = {
      config: allConfig,
      instance: {
        getValues: async (): Promise<SubjectValue[]> => [{ id: '*', label: '所有' }],
      },
    };
    this.providers.set('all', allProvider);
    this.logger.log('Registered built-in subject type: all (所有)');
  }

  /**
   * Register a subject type provider.
   *
   * @param config - The subject type configuration
   * @param instance - The service instance that provides values for this type
   */
  private registerProvider(config: SubjectTypeConfig, instance: unknown): void {
    if (this.providers.has(config.type)) {
      this.logger.warn(
        `Subject type '${config.type}' is already registered. Overwriting with new provider.`
      );
    }

    this.providers.set(config.type, {
      config,
      instance: instance as { getValues(): Promise<SubjectValue[]> },
    });
  }

  /**
   * Get all registered subject types.
   *
   * Returns a list of all registered subject types with their labels,
   * suitable for populating UI dropdowns or type selection components.
   *
   * @returns Array of type configurations with type and label
   *
   * @example
   * const types = registry.getTypes();
   * // Returns: [
   * //   { type: 'all', label: '所有' },
   * //   { type: 'role', label: '角色' },
   * //   { type: 'user', label: '用户' }
   * // ]
   */
  getTypes(): { type: string; label: string }[] {
    const types: { type: string; label: string }[] = [];

    for (const provider of this.providers.values()) {
      types.push({
        type: provider.config.type,
        label: provider.config.label,
      });
    }

    return types;
  }

  /**
   * Get available values for a specific subject type.
   *
   * Calls the registered provider's getValues() method to retrieve
   * the list of available subjects for the given type.
   *
   * @param type - The subject type identifier (e.g., 'role', 'user', 'all')
   * @returns Promise resolving to array of subject values
   * @throws Error if the requested type is not registered
   *
   * @example
   * // Get all roles
   * const roles = await registry.getValues('role');
   * // Returns: [{ id: '1', label: 'Admin' }, { id: '2', label: 'User' }]
   *
   * @example
   * // Get 'all' wildcard
   * const all = await registry.getValues('all');
   * // Returns: [{ id: '*', label: '所有' }]
   */
  async getValues(type: string): Promise<SubjectValue[]> {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new Error(`Subject type '${type}' is not registered`);
    }

    try {
      return await provider.instance.getValues();
    } catch (error) {
      this.logger.error(`Failed to get values for type '${type}': ${error}`);
      throw error;
    }
  }
}
