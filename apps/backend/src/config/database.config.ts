import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => {
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

  return {
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/app',
    entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development' && process.env.DB_SYNC === 'true',
    logging: process.env.NODE_ENV === 'development',
    // Neon requires SSL
    ssl: isNeon || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

export default databaseConfig;
