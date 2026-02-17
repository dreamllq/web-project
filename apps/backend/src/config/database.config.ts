import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => {
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/app',
    entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
    // migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
    // Enable synchronize in development or when DB_SYNC is true
    synchronize: isDev || process.env.DB_SYNC === 'true',
    logging: true,
    // Neon requires SSL
    ssl: isNeon || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

export default databaseConfig;
