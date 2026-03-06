# Policy Module - ABAC 权限系统
**复杂度:** `policy-evaluator.service.ts` (879 行) - CRITICAL COMPLEXITY

---

## OVERVIEW
ABAC 系统: 基于用户属性、资源、操作、环境条件进行动态权限判断和数据级过滤。

---

## STRUCTURE
```
policy/
├── decorators/       # @RequirePermission, @ApplyDataFilter, @RequireRole
├── dto/              # CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto
├── guards/           # PermissionGuard (RBAC+ABAC), RoleGuard
├── interceptors/     # DataFilterInterceptor (注入数据过滤条件)
├── migration/        # ABAC 覆盖率测试、权限一致性测试
├── services/         # PermissionCacheService, PermissionSyncService
├── types/            # PolicySubject, Condition, ConditionOperator
├── policy-evaluator.service.ts  # ⚠️ 核心 ABAC 引擎 (879 行)
├── policy.service.ts            # 策略 CRUD
└── policy.controller.ts         # 策略管理 API
```

---

## WHERE TO LOOK
- `policy-evaluator.service.ts` - ABAC 评估逻辑 (evaluate, getDataFilterConditions)
- `types/policy.types.ts` - PolicySubject, Condition, ConditionExpression 定义
- `guards/permission.guard.ts` - RBAC+ABAC 组合检查流程 (AND 逻辑)
- `interceptors/data-filter.interceptor.ts` - 数据过滤拦截器 (注入 Brackets[])

---

## CONVENTIONS
### 1. RBAC + ABAC 检查流程 (AND 逻辑)
超级用户跳过检查 → RBAC 检查 (失败则 403) → 写操作进行 ABAC 数据级检查

### 2. 装饰器使用
```typescript
@Get()
@RequirePermission('policy', 'read')  // RBAC 检查
@ApplyDataFilter(Policy)               // ABAC 数据过滤
findAll(@Req() req: RequestWithDataFilter) { ... }
```

### 3. PolicySubject 主体
`type: 'all' | 'user' | 'role' | 'department'`, `value: string | string[]`

### 4. Condition 条件 (最多 3 个 AND)
```typescript
{
  field: string,
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'isNull',
  value: string | number | boolean | null | string[],
  valueType?: 'literal' | 'userAttr' | 'env'
}
```

### 5. Resource/Action 模式
Resource: `"user"`, `"user:*"`, `"*"` | Action: `"read"`, `"read,write"`, `"*"`

---

## ANTI-PATTERNS
- ❌ 直接调用 PolicyEvaluatorService → ✅ 使用 `@RequirePermission()`
- ❌ 手动过滤数据 → ✅ 使用 `@ApplyDataFilter(Entity)`
- ❌ 混淆 RBAC/ABAC (RBAC:静态权限, ABAC:动态数据权限)
- ❌ 绕过 Guard → ✅ 始终 `@UseGuards(JwtAuthGuard, PermissionGuard)`
- ❌ 忽略缓存失效 → ✅ 更新后调用 `invalidateCache()`

---

## RBAC vs ABAC
| 特性 | RBAC         | ABAC             |
| ---- | ------------ | ---------------- |
| 检查 | 静态角色权限 | 动态属性条件     |
| 粒度 | 功能级       | 数据级           |
| 组合 | Guard先检查  | RBAC通过后才执行 |
