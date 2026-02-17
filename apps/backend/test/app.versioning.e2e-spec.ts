import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  VERSION_NEUTRAL,
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import request from 'supertest';

// Create a simple test controller for versioning tests
@Controller('test')
class TestController {
  @Get('hello')
  getHello() {
    return { message: 'hello from unversioned' };
  }

  @Post('echo')
  echo(@Body() body: { text: string }) {
    return { echoed: body.text };
  }
}

// Create a versioned controller
@Controller('test')
class VersionedTestController {
  @Get('hello')
  getHello() {
    return { message: 'hello from v1' };
  }
}

describe('App Versioning (e2e)', () => {
  let app: INestApplication;

  describe('VERSION_NEUTRAL configuration', () => {
    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [TestController],
      }).compile();

      app = moduleFixture.createNestApplication();

      // Enable versioning matching main.ts configuration
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: VERSION_NEUTRAL,
      });

      app.setGlobalPrefix('api');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should access /api/test/hello without version prefix', () => {
      return request(app.getHttpServer())
        .get('/api/test/hello')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ message: 'hello from unversioned' });
        });
    });

    it('should access /api/test/echo without version prefix', () => {
      return request(app.getHttpServer())
        .post('/api/test/echo')
        .send({ text: 'test message' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ echoed: 'test message' });
        });
    });

    it('should return 404 for /api/v1/test/hello (controller not versioned)', () => {
      // Since TestController doesn't have @Version('1') decorator,
      // /api/v1/test/hello will return 404
      return request(app.getHttpServer()).get('/api/v1/test/hello').expect(404);
    });

    it('should return 404 for /api/v2/test/hello (version not defined)', () => {
      return request(app.getHttpServer()).get('/api/v2/test/hello').expect(404);
    });
  });

  describe('Versioned routes (v1)', () => {
    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [VersionedTestController],
      }).compile();

      app = moduleFixture.createNestApplication();

      // Enable versioning with v1 as default
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });

      app.setGlobalPrefix('api');
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should access /api/v1/test/hello when defaultVersion is v1', () => {
      return request(app.getHttpServer())
        .get('/api/v1/test/hello')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ message: 'hello from v1' });
        });
    });

    it('should return 404 for /api/test/hello when defaultVersion is v1', () => {
      // VERSION_NEUTRAL routes won't match when defaultVersion is '1'
      return request(app.getHttpServer()).get('/api/test/hello').expect(404);
    });
  });
});
