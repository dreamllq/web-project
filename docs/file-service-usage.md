# File 服务使用说明

本文档说明如何使用 File 服务进行文件上传、下载和管理。

---

## 概述

File 服务提供了文件存储功能，支持：

- 文件上传（通过 Storage 服务存储）
- 文件下载（302 重定向到签名 URL）
- 文件列表查询
- 文件删除

### 支持的文件类型

| MIME 类型         | 说明      |
| ----------------- | --------- |
| `image/jpeg`      | JPEG 图片 |
| `image/png`       | PNG 图片  |
| `image/gif`       | GIF 图片  |
| `image/webp`      | WebP 图片 |
| `application/pdf` | PDF 文档  |

### 文件大小限制

- 最大文件大小：**10MB**

---

## API 端点

所有端点都需要 JWT 认证（`Authorization: Bearer <token>`）。

| 方法     | 端点                      | 说明                   |
| -------- | ------------------------- | ---------------------- |
| `POST`   | `/api/files/upload`       | 上传文件               |
| `GET`    | `/api/files`              | 获取文件列表           |
| `GET`    | `/api/files/:id`          | 获取文件详情           |
| `GET`    | `/api/files/:id/download` | 下载文件（302 重定向） |
| `DELETE` | `/api/files/:id`          | 删除文件               |

---

## 使用示例

### 1. 上传文件

**请求：**

```http
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <your-jwt-token>

file: <binary-file-data>
```

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "filename": "example.png",
  "storedName": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "mimeType": "image/png",
  "size": 102400,
  "storageProvider": "local",
  "storagePath": "files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "url": "http://localhost:3000/uploads/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**错误响应：**

```json
// 文件类型不支持
{
  "statusCode": 400,
  "message": "File type application/zip is not allowed. Allowed types: image/jpeg, image/png, image/gif, image/webp, application/pdf",
  "error": "Bad Request"
}

// 文件过大
{
  "statusCode": 400,
  "message": "File size exceeds maximum allowed size of 10MB",
  "error": "Bad Request"
}
```

### 2. 获取文件列表

**请求：**

```http
GET /api/files?page=1&limit=20&mimeType=image/png
Authorization: Bearer <your-jwt-token>
```

**查询参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量 |
| `mimeType` | string | - | MIME 类型过滤（前缀匹配） |

**响应：**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "filename": "example.png",
      "storedName": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "mimeType": "image/png",
      "size": 102400,
      "storageProvider": "local",
      "storagePath": "files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "url": "http://localhost:3000/uploads/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 3. 获取文件详情

**请求：**

```http
GET /api/files/:id
Authorization: Bearer <your-jwt-token>
```

**响应：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "filename": "example.png",
  "storedName": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "mimeType": "image/png",
  "size": 102400,
  "storageProvider": "local",
  "storagePath": "files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "url": "http://localhost:3000/uploads/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### 4. 下载文件

**请求：**

```http
GET /api/files/:id/download
Authorization: Bearer <your-jwt-token>
```

**响应：**
服务器返回 **302 重定向**，`Location` 头包含签名 URL：

```http
HTTP/1.1 302 Found
Location: https://storage.example.com/files/abc123.png?signature=xxx&expires=3600
```

> **注意**：客户端需要自动跟随重定向来下载文件。签名 URL 默认有效期为 1 小时。

### 5. 删除文件

**请求：**

```http
DELETE /api/files/:id
Authorization: Bearer <your-jwt-token>
```

**响应：**

```json
{
  "success": true
}
```

---

## Admin 前端集成

### 1. 创建 API 模块

在 `apps/admin/src/api/` 目录下创建 `file.ts`：

```typescript
// apps/admin/src/api/file.ts
import api, { extractApiError, type ApiError } from './index';

// ============================================
// Types
// ============================================

export interface FileRecord {
  id: string;
  userId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  storageProvider: 'local' | 's3' | 'minio';
  storagePath: string;
  url: string;
  createdAt: string;
}

export interface FileListResponse {
  data: FileRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface FileQueryParams {
  page?: number;
  limit?: number;
  mimeType?: string;
}

// ============================================
// API Functions
// ============================================

/**
 * 上传文件
 * POST /api/files/upload
 */
export async function uploadFile(file: File): Promise<FileRecord> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post<{ data: FileRecord }>('/files/upload', formData);
    return response.data;
  } catch (error) {
    throw extractApiError(error);
  }
}

/**
 * 获取文件列表
 * GET /api/files
 */
export async function getFiles(params?: FileQueryParams): Promise<FileListResponse> {
  try {
    const response = await api.get<{ data: FileListResponse }>('/files', { params });
    return response.data;
  } catch (error) {
    throw extractApiError(error);
  }
}

/**
 * 获取文件详情
 * GET /api/files/:id
 */
export async function getFile(id: string): Promise<FileRecord> {
  try {
    const response = await api.get<{ data: FileRecord }>(`/files/${id}`);
    return response.data;
  } catch (error) {
    throw extractApiError(error);
  }
}

/**
 * 获取文件下载 URL
 * GET /api/files/:id/download
 * 注意：此接口返回 302 重定向
 */
export async function getFileDownloadUrl(id: string): Promise<string> {
  try {
    // 使用 { maxRedirects: 0 } 获取重定向 URL 而不是跟随
    const response = await api.get<string>(`/files/${id}/download`, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });

    // 从响应头获取 Location
    const location = response.headers['location'];
    if (!location) {
      throw new Error('No redirect location found');
    }
    return location;
  } catch (error: any) {
    // axios 在 302 时会抛出错误，需要从错误响应中获取 Location
    if (error.response?.status === 302) {
      const location = error.response.headers['location'];
      if (location) {
        return location;
      }
    }
    throw extractApiError(error);
  }
}

/**
 * 下载文件（直接触发浏览器下载）
 * GET /api/files/:id/download
 */
export function downloadFile(id: string, filename?: string): void {
  // 构建带认证的下载 URL
  const authStore = useAuthStore();
  const token = authStore.token;

  // 创建隐藏的 iframe 或直接打开新窗口
  // 由于需要认证，使用 fetch 获取后再创建 blob
  fetch(`/api/files/${id}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: 'follow',
  })
    .then((response) => {
      if (response.redirected) {
        // 如果被重定向，直接打开签名 URL
        window.open(response.url, '_blank');
      } else {
        return response.blob();
      }
    })
    .then((blob) => {
      if (blob) {
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    })
    .catch(console.error);
}

/**
 * 删除文件
 * DELETE /api/files/:id
 */
export async function deleteFile(id: string): Promise<void> {
  try {
    await api.delete(`/files/${id}`);
  } catch (error) {
    throw extractApiError(error);
  }
}
```

### 2. 在组件中使用

```vue
<template>
  <div class="file-manager">
    <!-- 上传区域 -->
    <el-upload
      ref="uploadRef"
      class="upload-area"
      :action="uploadAction"
      :headers="uploadHeaders"
      :before-upload="beforeUpload"
      :on-success="handleUploadSuccess"
      :on-error="handleUploadError"
      :show-file-list="false"
    >
      <el-button type="primary">
        <el-icon><Upload /></el-icon>
        上传文件
      </el-button>
    </el-upload>

    <!-- 文件列表 -->
    <el-table :data="files" v-loading="loading">
      <el-table-column prop="filename" label="文件名" />
      <el-table-column prop="mimeType" label="类型" width="150" />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">
          {{ formatFileSize(row.size) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="上传时间" width="180" />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleDownload(row)"> 下载 </el-button>
          <el-button link type="danger" @click="handleDelete(row)"> 删除 </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="limit"
      :total="total"
      @change="fetchFiles"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { getFiles, uploadFile, deleteFile, downloadFile, type FileRecord } from '@/api/file';

const authStore = useAuthStore();
const loading = ref(false);
const files = ref<FileRecord[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

// 上传配置
const uploadAction = computed(() => '/api/files/upload');
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${authStore.token}`,
}));

// 上传前验证
const beforeUpload = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('不支持的文件类型');
    return false;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 10MB');
    return false;
  }

  return true;
};

// 上传成功
const handleUploadSuccess = (response: FileRecord) => {
  ElMessage.success('上传成功');
  fetchFiles();
};

// 上传失败
const handleUploadError = (error: any) => {
  const message = error.response?.data?.message || '上传失败';
  ElMessage.error(message);
};

// 获取文件列表
const fetchFiles = async () => {
  loading.value = true;
  try {
    const result = await getFiles({
      page: page.value,
      limit: limit.value,
    });
    files.value = result.data;
    total.value = result.total;
  } catch (error: any) {
    ElMessage.error(error.displayMessage || '获取文件列表失败');
  } finally {
    loading.value = false;
  }
};

// 下载文件
const handleDownload = (file: FileRecord) => {
  // 方式1：直接打开新窗口下载（推荐）
  downloadFile(file.id, file.filename);

  // 方式2：获取签名 URL 后在新窗口打开
  // getFileDownloadUrl(file.id).then(url => {
  //   window.open(url, '_blank');
  // });
};

// 删除文件
const handleDelete = async (file: FileRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除文件 "${file.filename}" 吗？`, '删除确认', {
      type: 'warning',
    });

    await deleteFile(file.id);
    ElMessage.success('删除成功');
    fetchFiles();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.displayMessage || '删除失败');
    }
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

onMounted(() => {
  fetchFiles();
});
</script>
```

### 3. 直接使用 FormData 上传

如果不想使用 `el-upload` 组件，可以手动处理上传：

```typescript
import { uploadFile } from '@/api/file';
import { ElMessage } from 'element-plus';

// 选择文件后上传
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('不支持的文件类型');
    return;
  }

  // 验证文件大小
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB');
    return;
  }

  try {
    const result = await uploadFile(file);
    console.log('上传成功:', result);
    ElMessage.success('上传成功');
  } catch (error: any) {
    ElMessage.error(error.displayMessage || '上传失败');
  }
}
```

---

## 注意事项

### 1. 认证要求

- 所有文件 API 都需要 JWT 认证
- 下载时需要携带 `Authorization` 头

### 2. 文件大小限制

- 默认最大 10MB
- 由 `file.config.ts` 中的 `maxFileSize` 配置

### 3. 下载机制

- 下载接口返回 302 重定向
- 签名 URL 有效期默认 1 小时（3600 秒）
- 客户端需要自动跟随重定向

### 4. 错误处理

- 400：文件类型不支持 / 文件过大
- 401：未认证
- 404：文件不存在
- 500：服务器错误

---

## 存储提供者

File 服务通过 Storage 服务支持多种存储后端：

| Provider | 说明              |
| -------- | ----------------- |
| `local`  | 本地文件系统存储  |
| `s3`     | AWS S3 或兼容服务 |
| `minio`  | MinIO 对象存储    |

存储提供者由 `storage.config.ts` 配置，File 服务自动使用配置的存储后端。
