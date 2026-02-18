# Storage Providers Configuration

This guide covers how to configure file storage for the application. The system supports multiple storage backends through a unified interface.

## Quick Start

1. Set the `STORAGE_PROVIDER` environment variable to choose your backend
2. Configure the provider-specific environment variables
3. Restart the application

```bash
# Example: Use MinIO for local development
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=avatars
```

## Supported Providers

| Provider | Type        | S3 Compatible | Env Var Prefix | Best For                  |
| -------- | ----------- | ------------- | -------------- | ------------------------- |
| S3       | Cloud       | Yes           | `S3_*`         | Production, AWS ecosystem |
| MinIO    | Self-hosted | Yes           | `MINIO_*`      | Development, on-premise   |
| Local    | Filesystem  | No            | `LOCAL_*`      | Development, testing      |

---

## Provider Configuration

### S3 Provider

The S3 provider supports any S3-compatible service. Configure it for AWS S3, Cloudflare R2, Aliyun OSS, or Tencent COS.

#### Environment Variables

| Variable               | Required | Default     | Description          |
| ---------------------- | -------- | ----------- | -------------------- |
| `S3_ENDPOINT`          | No       | -           | Service endpoint URL |
| `S3_REGION`            | No       | `us-east-1` | AWS region           |
| `S3_BUCKET`            | Yes      | -           | Bucket name          |
| `S3_ACCESS_KEY_ID`     | Yes      | -           | Access key ID        |
| `S3_SECRET_ACCESS_KEY` | Yes      | -           | Secret access key    |
| `S3_FORCE_PATH_STYLE`  | No       | `false`     | Use path-style URLs  |

#### AWS S3 Example

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=my-app-storage
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_FORCE_PATH_STYLE=false
```

#### Cloudflare R2 Example

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=<r2-access-key-id>
S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
S3_FORCE_PATH_STYLE=true
```

#### Aliyun OSS Example

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
S3_REGION=oss-cn-hangzhou
S3_BUCKET=my-oss-bucket
S3_ACCESS_KEY_ID=<oss-access-key-id>
S3_SECRET_ACCESS_KEY=<oss-secret-access-key>
S3_FORCE_PATH_STYLE=true
```

#### Tencent COS Example

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
S3_REGION=ap-guangzhou
S3_BUCKET=my-cos-bucket-1250000000
S3_ACCESS_KEY_ID=<cos-secret-id>
S3_SECRET_ACCESS_KEY=<cos-secret-key>
S3_FORCE_PATH_STYLE=true
```

---

### MinIO Provider

MinIO is an S3-compatible object storage server. Great for local development and self-hosted deployments.

#### Environment Variables

| Variable           | Required | Default       | Description      |
| ------------------ | -------- | ------------- | ---------------- |
| `MINIO_ENDPOINT`   | Yes      | -             | MinIO server URL |
| `MINIO_ACCESS_KEY` | Yes      | -             | Access key       |
| `MINIO_SECRET_KEY` | Yes      | -             | Secret key       |
| `MINIO_BUCKET`     | Yes      | -             | Bucket name      |
| `MINIO_USE_SSL`    | No       | Auto-detected | Enable SSL       |

#### Configuration Example

```bash
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=avatars
MINIO_USE_SSL=false
```

#### Docker Compose Setup

Add this to your `docker-compose.yml` for local development:

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    ports:
      - '9000:9000'
      - '9001:9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio_data:
```

Start MinIO:

```bash
docker-compose up -d minio
```

Create a bucket:

```bash
# Using MinIO Client (mc)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/avatars

# Or use the web console at http://localhost:9001
```

---

### Local Provider

The local provider stores files on the filesystem. Suitable for development and testing only.

#### Environment Variables

| Variable           | Required | Default | Description                |
| ------------------ | -------- | ------- | -------------------------- |
| `LOCAL_UPLOAD_DIR` | Yes      | -       | Directory to store files   |
| `LOCAL_BASE_URL`   | Yes      | -       | Base URL for serving files |

#### Configuration Example

```bash
STORAGE_PROVIDER=local
LOCAL_UPLOAD_DIR=./uploads
LOCAL_BASE_URL=http://localhost:3000/uploads
```

#### Serving Local Files

You need to configure static file serving. In NestJS:

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
})
export class AppModule {}
```

---

## Backward Compatibility

Legacy `STORAGE_*` environment variables are still supported and map to `S3_*` variables:

| Legacy Variable             | Maps To                |
| --------------------------- | ---------------------- |
| `STORAGE_ACCESS_KEY_ID`     | `S3_ACCESS_KEY_ID`     |
| `STORAGE_SECRET_ACCESS_KEY` | `S3_SECRET_ACCESS_KEY` |
| `STORAGE_REGION`            | `S3_REGION`            |
| `STORAGE_BUCKET`            | `S3_BUCKET`            |
| `STORAGE_ENDPOINT`          | `S3_ENDPOINT`          |
| `STORAGE_FORCE_PATH_STYLE`  | `S3_FORCE_PATH_STYLE`  |

---

## Troubleshooting

### Common Errors

#### "Missing required S3 configuration"

**Cause:** Required S3 environment variables are not set.

**Solution:** Ensure these variables are configured:

- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`

#### "Missing required MinIO configuration"

**Cause:** Required MinIO environment variables are not set.

**Solution:** Ensure all `MINIO_*` variables are configured.

#### "Invalid STORAGE_PROVIDER"

**Cause:** The provider value is not recognized.

**Solution:** Use one of: `s3`, `minio`, or `local`.

### Connection Issues

#### S3/R2 Connection Timeout

1. Check the endpoint URL is correct
2. Verify network access and firewall rules
3. Ensure credentials have proper permissions

#### MinIO Connection Refused

1. Verify MinIO is running: `docker ps | grep minio`
2. Check the endpoint URL matches your MinIO configuration
3. Ensure port 9000 is not blocked

### File Upload Issues

#### Permission Denied (S3)

Ensure the IAM user or role has these permissions:

- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`

#### Bucket Not Found

1. Verify the bucket name is correct
2. Create the bucket if it doesn't exist
3. For MinIO, use the console or mc CLI to create buckets

### Debug Mode

Enable debug logging to see detailed storage operations:

```bash
DEBUG=storage:* npm run start:dev
```

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive values
3. **Rotate access keys** regularly
4. **Use IAM roles** in AWS instead of access keys when possible
5. **Enable bucket policies** to restrict access
6. **Use HTTPS** for all production endpoints
