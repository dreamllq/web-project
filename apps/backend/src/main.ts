import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { join } from 'path';
// import { existsSync, readFileSync } from 'fs';
import { AppModule } from './app.module';
// import { InitService } from './init/init.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Check if the application has been initialized
 * by looking for APP_INITIALIZED=true in .env.local
 */
// function isInitialized(envPath: string): boolean {
//   if (!existsSync(envPath)) {
//     return false;
//   }
//   const content = readFileSync(envPath, 'utf-8');
//   return content.includes('APP_INITIALIZED=true');
// }

async function bootstrap() {
  // Check if initialization is needed before starting the app
  // const envLocalPath = join(__dirname, '../../../.env.local');
  // const forceInit = process.argv.includes('--force');

  // if (forceInit || !isInitialized(envLocalPath)) {
  //   if (forceInit) {
  //     console.log('⚠️  强制重新初始化模式');
  //     console.log('⚠️  即将重新初始化，现有配置将被覆盖！\n');
  //   } else {
  //     console.log('🔧 首次启动检测，开始初始化向导...\n');
  //   }

  //   // Create application context for initialization
  //   // This allows us to use NestJS dependency injection for InitService
  //   const appContext = await NestFactory.createApplicationContext(AppModule, {
  //     logger: ['error', 'warn', 'log'],
  //   });

  //   try {
  //     const initService = appContext.get(InitService);
  //     await initService.runInitialization();
  //     // runInitialization calls process.exit(0), so this line won't execute
  //   } catch (error) {
  //     console.error('❌ 初始化失败:', error);
  //     await appContext.close();
  //     process.exit(1);
  //   }
  // }

  // console.log('✅ 应用已初始化，正在启动服务...\n');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from uploads directory
  const uploadDir = process.env.LOCAL_UPLOAD_DIR || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
  });

  // Register global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Enable CORS
  app.enableCors();

  // Enable URI-based versioning
  // Routes can be accessed as:
  // - /api/auth/login (VERSION_NEUTRAL - default/unversioned)
  // - /api/v1/auth/login (version 1)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();
