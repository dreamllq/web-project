export interface PermissionConfig {
  useAbacOnly: boolean;
}

export const permissionConfig = (): PermissionConfig => ({
  useAbacOnly: process.env.USE_ABAC_ONLY === 'true',
});

export default permissionConfig;
