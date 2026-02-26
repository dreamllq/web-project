# ABAC Data Filter Configuration Skill

配置接口的 ABAC 数据过滤功能，让查询结果根据用户策略自动过滤。

## 触发场景

- 用户请求为某个接口配置数据过滤
- 需要实现行级权限控制
- 需要根据用户角色/属性过滤查询结果

## 配置步骤

### 1. 修改 Controller

添加必要的导入和装饰器：

```typescript
// 添加导入
import { Req, UseInterceptors } from '@nestjs/common';
import { ApplyDataFilter } from '../policy/decorators/apply-data-filter.decorator';
import { DataFilterInterceptor, RequestWithDataFilter } from '../policy/interceptors/data-filter.interceptor';

// 在查询方法上添加装饰器
@Get()
@RequirePermission('resource', 'read')  // 保持现有权限检查
@ApplyDataFilter(Entity)                 // 声明要过滤的实体
@UseInterceptors(DataFilterInterceptor)  // 启用拦截器
@ApiOperation({ summary: 'Get all records' })
async findAll(@Req() req: RequestWithDataFilter): Promise<{ data: Entity[] }> {
  const data = await this.service.findAll(req);
  return { data };
}
```

### 2. 修改 Service

修改查询方法支持数据过滤：

```typescript
// 添加导入
import type { RequestWithDataFilter } from '../policy/interceptors/data-filter.interceptor';

// 修改查询方法
async findAll(request?: RequestWithDataFilter): Promise<Entity[]> {
  const queryBuilder = this.repository.createQueryBuilder('entity');

  // 应用 ABAC 数据过滤条件
  if (request?.dataFilterConditions && request.dataFilterConditions.length > 0) {
    for (const bracket of request.dataFilterConditions) {
      queryBuilder.andWhere(bracket);
    }
  }

  // 原有的排序和过滤逻辑
  queryBuilder.orderBy('entity.createdAt', 'DESC');

  return queryBuilder.getMany();
}
```

## 装饰器参数

```typescript
@ApplyDataFilter(
  Entity,           // 必需：TypeORM 实体类
  'resource',       // 可选：资源名称，默认为实体名小写
  'read'            // 可选：操作名称，默认为 'read'
)
```

## 策略配置示例

```json
{
  "name": "viewer-filter",
  "effect": "allow",
  "subject": { "type": "role", "value": "viewer" },
  "resource": "policy",
  "action": "read",
  "conditions": {
    "and": [{ "field": "action", "operator": "eq", "value": "read" }]
  }
}
```

## 支持的操作符

| 操作符   | 说明       | 示例                                                                      |
| -------- | ---------- | ------------------------------------------------------------------------- |
| `eq`     | 等于       | `{ "field": "status", "operator": "eq", "value": "active" }`              |
| `ne`     | 不等于     | `{ "field": "status", "operator": "ne", "value": "deleted" }`             |
| `gt`     | 大于       | `{ "field": "age", "operator": "gt", "value": 18 }`                       |
| `gte`    | 大于等于   | `{ "field": "age", "operator": "gte", "value": 18 }`                      |
| `lt`     | 小于       | `{ "field": "amount", "operator": "lt", "value": 1000 }`                  |
| `lte`    | 小于等于   | `{ "field": "amount", "operator": "lte", "value": 1000 }`                 |
| `in`     | 在列表中   | `{ "field": "status", "operator": "in", "value": ["active", "pending"] }` |
| `nin`    | 不在列表中 | `{ "field": "status", "operator": "nin", "value": ["deleted"] }`          |
| `like`   | 模糊匹配   | `{ "field": "name", "operator": "like", "value": "test" }`                |
| `isNull` | 为空       | `{ "field": "deletedAt", "operator": "isNull" }`                          |

## 值类型

| 类型       | 说明           | 示例                                                   |
| ---------- | -------------- | ------------------------------------------------------ |
| `literal`  | 字面值（默认） | `{ "value": "read", "valueType": "literal" }`          |
| `userAttr` | 用户属性       | `{ "value": "departmentId", "valueType": "userAttr" }` |
| `env`      | 环境变量       | `{ "value": "NODE_ENV", "valueType": "env" }`          |

## 已配置的接口

| 接口                      | 实体       | 资源       |
| ------------------------- | ---------- | ---------- |
| `GET /api/v1/policies`    | Policy     | policy     |
| `GET /api/v1/permissions` | Permission | permission |

## 验证

配置完成后运行：

```bash
cd apps/backend && pnpm build
```

## 注意事项

1. **不要删除现有的 @RequirePermission 装饰器** - 数据过滤是补充功能，不是替代
2. **无匹配策略时返回全部数据** - 宽松模式，不会阻止查询
3. **只处理 effect=allow 的策略** - deny 策略被忽略
4. **多策略使用 AND 逻辑** - 用户必须同时满足所有策略条件
5. **使用 QueryBuilder** - 必须使用 createQueryBuilder 才能应用 Brackets 条件

## 完整示例

参考已实现的文件：

- Controller: `apps/backend/src/policy/policy.controller.ts`
- Service: `apps/backend/src/policy/policy.service.ts`
- Controller: `apps/backend/src/rbac/permission.controller.ts`
- Service: `apps/backend/src/rbac/permission.service.ts`
