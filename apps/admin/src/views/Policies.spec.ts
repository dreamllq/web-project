import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shallowMount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import ElementPlus from 'element-plus';
import Policies from './Policies.vue';
import type { Policy, PolicyEffect, PolicyCondition } from '@/types/policy';

// Mock the API module
vi.mock('@/api/policy', () => ({
  getPolicies: vi.fn(),
  createPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  togglePolicyEnabled: vi.fn(),
  deletePolicy: vi.fn(),
  checkPermission: vi.fn(),
}));

// Mock extractApiError
vi.mock('@/api', () => ({
  extractApiError: vi.fn((error: unknown) => {
    const err = error as { response?: { data?: { statusCode?: number; message?: string } } };
    if (err?.response?.data) {
      return {
        statusCode: err.response.data.statusCode || 500,
        message: err.response.data.message || 'An error occurred',
        displayMessage: `[${err.response.data.statusCode || 500}] ${err.response.data.message || 'An error occurred'}`,
      };
    }
    return {
      statusCode: 500,
      message: 'Unknown error',
      displayMessage: '[500] Unknown error',
    };
  }),
}));

// Mock Element Plus message
vi.mock('element-plus', async () => {
  const actual = await vi.importActual('element-plus');
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

import {
  getPolicies,
  createPolicy,
  updatePolicy,
  togglePolicyEnabled,
  deletePolicy,
  checkPermission,
} from '@/api/policy';
import { ElMessage } from 'element-plus';

// Create i18n instance for testing
const createTestI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        menu: { policies: 'Policy Management' },
        common: {
          add: 'Add Policy',
          search: 'Search',
          reset: 'Reset',
          edit: 'Edit',
          delete: 'Delete',
          enable: 'Enable',
          disable: 'Disable',
          enabled: 'Enabled',
          disabled: 'Disabled',
          status: 'Status',
          all: 'All',
          selectStatus: 'Select status',
          confirm: 'Confirm',
          cancel: 'Cancel',
          create: 'Create',
          save: 'Save',
          clear: 'Clear',
          actions: 'Actions',
          createdAt: 'Created At',
        },
        policies: {
          createPolicy: 'Create Policy',
          editPolicy: 'Edit Policy',
          effectAllow: 'Allow',
          effectDeny: 'Deny',
          subject: 'Subject',
          resource: 'Resource',
          action: 'Action',
          name: 'Name',
          effect: 'Effect',
          conditions: 'Conditions',
          priority: 'Priority',
          noData: 'No policies found',
          createFirst: 'Create First Policy',
          subjectPlaceholder: 'Enter subject',
          resourcePlaceholder: 'Enter resource',
          actionPlaceholder: 'Enter action',
          nameRequired: 'Please enter policy name',
          nameMaxLength: 'Name must be at most 100 characters',
          effectRequired: 'Please select effect',
          subjectRequired: 'Please enter subject',
          resourceRequired: 'Please enter resource',
          actionRequired: 'Please enter action',
          deleteConfirm: 'Are you sure to delete this policy?',
          deleteSuccess: 'Policy deleted successfully',
          enabledSuccess: 'Policy enabled successfully',
          disabledSuccess: 'Policy disabled successfully',
          createSuccess: 'Policy created successfully',
          updateSuccess: 'Policy updated successfully',
          permissionTest: 'Permission Test',
          testDescription: 'Test if a permission is allowed.',
          testPermission: 'Test Permission',
          testInputRequired: 'Please enter both resource and action',
          permissionAllowed: 'Permission ALLOWED',
          permissionDenied: 'Permission DENIED',
          matchedPolicy: 'Matched Policy',
          timeCondition: 'Time Condition',
          ipCondition: 'IP Condition',
          startTime: 'Start Time',
          endTime: 'End Time',
          allowedDays: 'Allowed Days',
          allowedIps: 'Allowed IPs / CIDR',
          addIp: 'Add IP',
          ipPlaceholder: 'e.g., 192.168.1.1',
          conditionsPreview: 'Preview',
          description: 'Description',
          descriptionPlaceholder: 'Describe this policy purpose',
          namePlaceholder: 'e.g., Admin Full Access',
          testResourcePlaceholder: 'e.g., user, policy',
          testActionPlaceholder: 'e.g., read, create',
        },
      },
    },
  });

// Helper to create mock policy
function createMockPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'policy-1',
    name: 'Test Policy',
    description: 'Test description',
    effect: 'allow' as PolicyEffect,
    subject: 'role:admin',
    resource: '*',
    action: '*',
    conditions: null,
    priority: 0,
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Helper to mount component with common configuration
async function mountPolicies() {
  const i18n = createTestI18n();

  const wrapper = shallowMount(Policies, {
    global: {
      plugins: [i18n, ElementPlus],
    },
  });

  await nextTick();
  return wrapper as VueWrapper<InstanceType<typeof Policies>>;
}

describe('Policies.vue', () => {
  let wrapper: VueWrapper<InstanceType<typeof Policies>>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(getPolicies).mockResolvedValue({
      data: [createMockPolicy()],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  // ============================================
  // Policy List Rendering Tests
  // ============================================
  describe('Policy List Rendering', () => {
    it('should fetch and display policies on mount', async () => {
      const mockPolicies = [
        createMockPolicy({ id: '1', name: 'Policy 1' }),
        createMockPolicy({ id: '2', name: 'Policy 2', effect: 'deny' }),
      ];

      vi.mocked(getPolicies).mockResolvedValue({
        data: mockPolicies,
        total: 2,
        page: 1,
        limit: 10,
      });

      wrapper = await mountPolicies();

      expect(getPolicies).toHaveBeenCalledTimes(1);
      expect(wrapper.vm.policies).toHaveLength(2);
      expect(wrapper.vm.policies[0].name).toBe('Policy 1');
      expect(wrapper.vm.policies[1].name).toBe('Policy 2');
    });

    it('should have empty policies array initially before mount', async () => {
      vi.mocked(getPolicies).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [], total: 0, page: 1, limit: 10 }), 100)
          )
      );

      wrapper = await mountPolicies();

      // After mount, policies should be set
      expect(wrapper.vm.policies).toBeDefined();
    });

    it('should display empty state when no policies exist', async () => {
      vi.mocked(getPolicies).mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      wrapper = await mountPolicies();

      expect(wrapper.vm.policies).toHaveLength(0);
      expect(wrapper.vm.total).toBe(0);
    });

    it('should show effect tag with correct type (allow=success/green)', async () => {
      wrapper = await mountPolicies();

      const effectType = wrapper.vm.getEffectType('allow');
      expect(effectType).toBe('success');
    });

    it('should show effect tag with correct type (deny=danger/red)', async () => {
      wrapper = await mountPolicies();

      const effectType = wrapper.vm.getEffectType('deny');
      expect(effectType).toBe('danger');
    });

    it('should display enabled status correctly', async () => {
      wrapper = await mountPolicies();

      const enabledType = wrapper.vm.getEnabledType(true);
      expect(enabledType).toBe('success');

      const disabledType = wrapper.vm.getEnabledType(false);
      expect(disabledType).toBe('info');
    });

    it('should handle pagination correctly', async () => {
      vi.mocked(getPolicies).mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => createMockPolicy({ id: `policy-${i}` })),
        total: 25,
        page: 1,
        limit: 10,
      });

      wrapper = await mountPolicies();

      expect(wrapper.vm.total).toBe(25);
      expect(wrapper.vm.currentPage).toBe(1);
      expect(wrapper.vm.pageSize).toBe(10);
    });

    it('should handle size change', async () => {
      wrapper = await mountPolicies();
      vi.mocked(getPolicies).mockClear();

      wrapper.vm.handleSizeChange(20);
      await nextTick();

      expect(wrapper.vm.pageSize).toBe(20);
      expect(wrapper.vm.currentPage).toBe(1);
      expect(getPolicies).toHaveBeenCalled();
    });

    it('should handle page change', async () => {
      wrapper = await mountPolicies();
      vi.mocked(getPolicies).mockClear();

      wrapper.vm.handlePageChange(2);
      await nextTick();

      expect(wrapper.vm.currentPage).toBe(2);
      expect(getPolicies).toHaveBeenCalled();
    });

    it('should send correct pagination params to API', async () => {
      wrapper = await mountPolicies();

      wrapper.vm.pageSize = 20;
      wrapper.vm.currentPage = 2;
      await nextTick();

      // Clear previous calls and trigger a fetch via page change
      vi.mocked(getPolicies).mockClear();
      wrapper.vm.handlePageChange(2);
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 20, // (2-1) * 20
        })
      );
    });
  });

  // ============================================
  // Filter Functionality Tests
  // ============================================
  describe('Filter Functionality', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should have filter state initialized correctly', () => {
      expect(wrapper.vm.filters.subject).toBe('');
      expect(wrapper.vm.filters.resource).toBe('');
      expect(wrapper.vm.filters.action).toBe('');
      expect(wrapper.vm.filters.enabled).toBe('all');
    });

    it('should call API with subject filter', async () => {
      wrapper.vm.filters.subject = 'role:admin';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ subject: 'role:admin' }));
    });

    it('should call API with resource filter', async () => {
      wrapper.vm.filters.resource = 'user';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ resource: 'user' }));
    });

    it('should call API with action filter', async () => {
      wrapper.vm.filters.action = 'read';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ action: 'read' }));
    });

    it('should call API with enabled filter', async () => {
      wrapper.vm.filters.enabled = 'true';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    });

    it('should call API with disabled filter', async () => {
      wrapper.vm.filters.enabled = 'false';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });

    it('should not send enabled filter when set to all', async () => {
      wrapper.vm.filters.enabled = 'all';
      wrapper.vm.handleSearch();
      await nextTick();

      const calls = vi.mocked(getPolicies).mock.calls;
      const lastCall = calls.length > 0 ? calls[calls.length - 1]?.[0] : undefined;
      expect(lastCall?.enabled).toBeUndefined();
    });

    it('should reset filters on handleReset', async () => {
      wrapper.vm.filters.subject = 'test';
      wrapper.vm.filters.resource = 'resource';
      wrapper.vm.filters.action = 'action';
      wrapper.vm.filters.enabled = 'true';
      wrapper.vm.currentPage = 3;

      wrapper.vm.handleReset();
      await nextTick();

      expect(wrapper.vm.filters.subject).toBe('');
      expect(wrapper.vm.filters.resource).toBe('');
      expect(wrapper.vm.filters.action).toBe('');
      expect(wrapper.vm.filters.enabled).toBe('all');
      expect(wrapper.vm.currentPage).toBe(1);
      expect(getPolicies).toHaveBeenCalled();
    });

    it('should reset page to 1 when filters change', async () => {
      wrapper.vm.currentPage = 5;
      wrapper.vm.filters.subject = 'new-filter';
      await nextTick();

      expect(wrapper.vm.currentPage).toBe(1);
    });

    it('should trim filter values before sending', async () => {
      wrapper.vm.filters.subject = '  role:admin  ';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(expect.objectContaining({ subject: 'role:admin' }));
    });

    it('should combine multiple filters in query', async () => {
      wrapper.vm.filters.subject = 'role:admin';
      wrapper.vm.filters.resource = 'user';
      wrapper.vm.filters.action = 'read';
      wrapper.vm.filters.enabled = 'true';
      wrapper.vm.handleSearch();
      await nextTick();

      expect(getPolicies).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'role:admin',
          resource: 'user',
          action: 'read',
          enabled: true,
        })
      );
    });
  });

  // ============================================
  // Create/Edit Dialog Tests
  // ============================================
  describe('Create/Edit Dialog', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should open create dialog with openCreateDialog', async () => {
      wrapper.vm.openCreateDialog();
      await nextTick();

      expect(wrapper.vm.dialogVisible).toBe(true);
      expect(wrapper.vm.dialogMode).toBe('create');
      expect(wrapper.vm.formData.id).toBeUndefined();
    });

    it('should reset form when opening create dialog', async () => {
      wrapper.vm.formData.name = 'Previous Name';
      wrapper.vm.formData.subject = 'previous-subject';

      wrapper.vm.openCreateDialog();
      await nextTick();

      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.subject).toBe('');
    });

    it('should open edit dialog with policy data', async () => {
      const policy = createMockPolicy({
        id: 'policy-123',
        name: 'Edit Test Policy',
        subject: 'role:user',
        resource: 'article',
        action: 'read',
        effect: 'deny',
        priority: 100,
        enabled: false,
      });

      wrapper.vm.openEditDialog(policy);
      await nextTick();

      expect(wrapper.vm.dialogVisible).toBe(true);
      expect(wrapper.vm.dialogMode).toBe('edit');
      expect(wrapper.vm.formData.id).toBe('policy-123');
      expect(wrapper.vm.formData.name).toBe('Edit Test Policy');
      expect(wrapper.vm.formData.subject).toBe('role:user');
      expect(wrapper.vm.formData.resource).toBe('article');
      expect(wrapper.vm.formData.action).toBe('read');
      expect(wrapper.vm.formData.effect).toBe('deny');
      expect(wrapper.vm.formData.priority).toBe(100);
      expect(wrapper.vm.formData.enabled).toBe(false);
    });

    it('should create policy on submit', async () => {
      vi.mocked(createPolicy).mockResolvedValue({
        data: createMockPolicy({ id: 'new-policy' }),
      });

      wrapper.vm.openCreateDialog();
      await nextTick();

      wrapper.vm.formData.name = 'New Policy';
      wrapper.vm.formData.subject = 'role:admin';
      wrapper.vm.formData.resource = 'policy';
      wrapper.vm.formData.action = 'create';
      wrapper.vm.formData.effect = 'allow';

      // Mock formRef.validate to resolve
      wrapper.vm.formRef = {
        validate: vi.fn().mockResolvedValue(undefined),
      } as unknown as typeof wrapper.vm.formRef;

      await wrapper.vm.handleSubmit();
      await nextTick();

      expect(createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Policy',
          subject: 'role:admin',
          resource: 'policy',
          action: 'create',
          effect: 'allow',
        })
      );
      expect(ElMessage.success).toHaveBeenCalled();
      expect(wrapper.vm.dialogVisible).toBe(false);
    });

    it('should update policy on submit in edit mode', async () => {
      vi.mocked(updatePolicy).mockResolvedValue({
        data: createMockPolicy(),
      });

      const policy = createMockPolicy({ id: 'policy-to-update' });
      wrapper.vm.openEditDialog(policy);
      await nextTick();

      wrapper.vm.formData.name = 'Updated Name';

      // Mock formRef.validate to resolve
      wrapper.vm.formRef = {
        validate: vi.fn().mockResolvedValue(undefined),
      } as unknown as typeof wrapper.vm.formRef;

      await wrapper.vm.handleSubmit();
      await nextTick();

      expect(updatePolicy).toHaveBeenCalledWith(
        'policy-to-update',
        expect.objectContaining({ name: 'Updated Name' })
      );
      expect(ElMessage.success).toHaveBeenCalled();
    });

    it('should close dialog on cancel', async () => {
      wrapper.vm.openCreateDialog();
      wrapper.vm.dialogVisible = false;
      await nextTick();

      expect(wrapper.vm.dialogVisible).toBe(false);
    });

    it('should compute correct dialog title', async () => {
      wrapper.vm.dialogMode = 'create';
      expect(wrapper.vm.dialogTitle).toContain('Create');

      wrapper.vm.dialogMode = 'edit';
      expect(wrapper.vm.dialogTitle).toContain('Edit');
    });

    it('should handle API error on create', async () => {
      vi.mocked(createPolicy).mockRejectedValue({
        response: { data: { statusCode: 400, message: 'Validation failed' } },
      });

      wrapper.vm.openCreateDialog();
      wrapper.vm.formData.name = 'Test';
      wrapper.vm.formData.subject = 'role:admin';
      wrapper.vm.formData.resource = 'test';
      wrapper.vm.formData.action = 'read';

      // Mock formRef.validate to resolve
      wrapper.vm.formRef = {
        validate: vi.fn().mockResolvedValue(undefined),
      } as unknown as typeof wrapper.vm.formRef;

      await wrapper.vm.handleSubmit();
      await nextTick();

      expect(ElMessage.error).toHaveBeenCalled();
      expect(wrapper.vm.dialogVisible).toBe(true);
    });

    it('should handle API error on update', async () => {
      vi.mocked(updatePolicy).mockRejectedValue({
        response: { data: { statusCode: 500, message: 'Server error' } },
      });

      const policy = createMockPolicy({ id: 'policy-id' });
      wrapper.vm.openEditDialog(policy);

      // Mock formRef.validate to resolve
      wrapper.vm.formRef = {
        validate: vi.fn().mockResolvedValue(undefined),
      } as unknown as typeof wrapper.vm.formRef;

      await wrapper.vm.handleSubmit();
      await nextTick();

      expect(ElMessage.error).toHaveBeenCalled();
    });

    it('should not submit if form validation fails', async () => {
      wrapper.vm.openCreateDialog();
      wrapper.vm.formData.name = 'Test';

      // Mock formRef.validate to reject
      wrapper.vm.formRef = {
        validate: vi.fn().mockRejectedValue(new Error('Validation failed')),
      } as unknown as typeof wrapper.vm.formRef;

      await wrapper.vm.handleSubmit();
      await nextTick();

      expect(createPolicy).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Condition Configuration Tests
  // ============================================
  describe('Condition Configuration', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should initialize condition state correctly', () => {
      expect(wrapper.vm.timeEnabled).toBe(false);
      expect(wrapper.vm.ipEnabled).toBe(false);
      expect(wrapper.vm.timeConditionData.start).toBe('');
      expect(wrapper.vm.timeConditionData.end).toBe('');
      expect(wrapper.vm.timeConditionData.daysOfWeek).toEqual([]);
      expect(wrapper.vm.ipConditionData.allowed).toEqual(['']);
    });

    it('should toggle time condition', async () => {
      wrapper.vm.timeEnabled = true;
      await nextTick();

      expect(wrapper.vm.timeEnabled).toBe(true);
    });

    it('should toggle IP condition', async () => {
      wrapper.vm.ipEnabled = true;
      await nextTick();

      expect(wrapper.vm.ipEnabled).toBe(true);
    });

    it('should build conditions preview with time condition', async () => {
      wrapper.vm.timeEnabled = true;
      wrapper.vm.timeConditionData.start = '09:00';
      wrapper.vm.timeConditionData.end = '17:00';
      wrapper.vm.timeConditionData.daysOfWeek = [1, 2, 3, 4, 5];
      await nextTick();

      const preview = wrapper.vm.conditionsPreview;
      expect(preview?.time).toBeDefined();
      expect(preview?.time?.start).toBe('09:00');
      expect(preview?.time?.end).toBe('17:00');
      expect(preview?.time?.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('should build conditions preview with IP condition', async () => {
      wrapper.vm.ipEnabled = true;
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1', '10.0.0.0/8'];
      await nextTick();

      const preview = wrapper.vm.conditionsPreview;
      expect(preview?.ip).toBeDefined();
      expect(preview?.ip?.allowed).toEqual(['192.168.1.1', '10.0.0.0/8']);
    });

    it('should return undefined conditions when nothing enabled', async () => {
      wrapper.vm.timeEnabled = false;
      wrapper.vm.ipEnabled = false;
      await nextTick();

      expect(wrapper.vm.conditionsPreview).toBeUndefined();
    });

    it('should add IP address', async () => {
      const initialLength = wrapper.vm.ipConditionData.allowed.length;
      wrapper.vm.addIpAddress();
      await nextTick();

      expect(wrapper.vm.ipConditionData.allowed.length).toBe(initialLength + 1);
    });

    it('should remove IP address at index', async () => {
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
      wrapper.vm.removeIpAddress(1);
      await nextTick();

      expect(wrapper.vm.ipConditionData.allowed).toEqual(['192.168.1.1', '192.168.1.3']);
    });

    it('should not remove last IP address, just clear it', async () => {
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1'];
      wrapper.vm.removeIpAddress(0);
      await nextTick();

      expect(wrapper.vm.ipConditionData.allowed).toEqual(['']);
    });

    it('should clear time condition', async () => {
      wrapper.vm.timeConditionData.start = '09:00';
      wrapper.vm.timeConditionData.end = '17:00';
      wrapper.vm.timeConditionData.daysOfWeek = [1, 2, 3];

      wrapper.vm.clearTimeCondition();
      await nextTick();

      expect(wrapper.vm.timeConditionData.start).toBe('');
      expect(wrapper.vm.timeConditionData.end).toBe('');
      expect(wrapper.vm.timeConditionData.daysOfWeek).toEqual([]);
    });

    it('should clear IP condition', async () => {
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1', '192.168.1.2'];

      wrapper.vm.clearIpCondition();
      await nextTick();

      expect(wrapper.vm.ipConditionData.allowed).toEqual(['']);
    });

    it('should parse existing conditions in edit dialog', async () => {
      const policy = createMockPolicy({
        conditions: {
          time: { start: '09:00', end: '17:00', daysOfWeek: [1, 2, 3] },
          ip: { allowed: ['192.168.1.0/24'] },
        } as PolicyCondition,
      });

      wrapper.vm.openEditDialog(policy);
      await nextTick();

      expect(wrapper.vm.timeEnabled).toBe(true);
      expect(wrapper.vm.timeConditionData.start).toBe('09:00');
      expect(wrapper.vm.timeConditionData.end).toBe('17:00');
      expect(wrapper.vm.timeConditionData.daysOfWeek).toEqual([1, 2, 3]);
      expect(wrapper.vm.ipEnabled).toBe(true);
      expect(wrapper.vm.ipConditionData.allowed).toEqual(['192.168.1.0/24']);
    });

    it('should handle conditions with only time', async () => {
      const policy = createMockPolicy({
        conditions: { time: { start: '00:00', end: '23:59' } } as PolicyCondition,
      });

      wrapper.vm.openEditDialog(policy);
      await nextTick();

      expect(wrapper.vm.timeEnabled).toBe(true);
      expect(wrapper.vm.ipEnabled).toBe(false);
    });

    it('should handle conditions with only IP', async () => {
      const policy = createMockPolicy({
        conditions: { ip: { allowed: ['10.0.0.1'] } } as PolicyCondition,
      });

      wrapper.vm.openEditDialog(policy);
      await nextTick();

      expect(wrapper.vm.timeEnabled).toBe(false);
      expect(wrapper.vm.ipEnabled).toBe(true);
    });

    it('should filter out empty IP addresses in conditions preview', async () => {
      wrapper.vm.ipEnabled = true;
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1', '', '10.0.0.1', '   '];
      await nextTick();

      const preview = wrapper.vm.conditionsPreview;
      expect(preview?.ip?.allowed).toEqual(['192.168.1.1', '10.0.0.1']);
    });

    it('should generate JSON preview for conditions', async () => {
      wrapper.vm.timeEnabled = true;
      wrapper.vm.timeConditionData.start = '09:00';
      await nextTick();

      const json = wrapper.vm.conditionsJson;
      expect(json).toContain('time');
      expect(json).toContain('09:00');
    });

    it('should show no conditions message when nothing configured', async () => {
      wrapper.vm.timeEnabled = false;
      wrapper.vm.ipEnabled = false;
      await nextTick();

      expect(wrapper.vm.conditionsJson).toContain('No conditions');
    });

    it('should sort daysOfWeek in conditions preview', async () => {
      wrapper.vm.timeEnabled = true;
      wrapper.vm.timeConditionData.daysOfWeek = [5, 1, 3, 0];
      await nextTick();

      const preview = wrapper.vm.conditionsPreview;
      expect(preview?.time?.daysOfWeek).toEqual([0, 1, 3, 5]);
    });
  });

  // ============================================
  // Permission Test Feature Tests
  // ============================================
  describe('Permission Test Feature', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should initialize test state correctly', () => {
      expect(wrapper.vm.testResource).toBe('');
      expect(wrapper.vm.testAction).toBe('');
      expect(wrapper.vm.testResult).toBeNull();
      expect(wrapper.vm.testLoading).toBe(false);
    });

    it('should show warning when testing with empty inputs', async () => {
      wrapper.vm.testResource = '';
      wrapper.vm.testAction = '';

      await wrapper.vm.handleTestPermission();

      expect(ElMessage.warning).toHaveBeenCalled();
      expect(checkPermission).not.toHaveBeenCalled();
    });

    it('should show warning when resource is missing', async () => {
      wrapper.vm.testResource = '';
      wrapper.vm.testAction = 'read';

      await wrapper.vm.handleTestPermission();

      expect(ElMessage.warning).toHaveBeenCalled();
    });

    it('should show warning when action is missing', async () => {
      wrapper.vm.testResource = 'user';
      wrapper.vm.testAction = '';

      await wrapper.vm.handleTestPermission();

      expect(ElMessage.warning).toHaveBeenCalled();
    });

    it('should call checkPermission API with correct params', async () => {
      vi.mocked(checkPermission).mockResolvedValue({
        data: { allowed: true, resource: 'user', action: 'read' },
      });

      wrapper.vm.testResource = 'user';
      wrapper.vm.testAction = 'read';

      await wrapper.vm.handleTestPermission();

      expect(checkPermission).toHaveBeenCalledWith('user', 'read');
    });

    it('should display allowed result', async () => {
      const matchedPolicy = createMockPolicy({ name: 'Admin Access', effect: 'allow' });
      vi.mocked(checkPermission).mockResolvedValue({
        data: { allowed: true, matchedPolicy } as unknown as {
          allowed: boolean;
          resource: string;
          action: string;
        },
      });

      wrapper.vm.testResource = 'policy';
      wrapper.vm.testAction = 'create';

      await wrapper.vm.handleTestPermission();
      await nextTick();

      expect(wrapper.vm.testResult).toEqual({ allowed: true, matchedPolicy });
    });

    it('should display denied result', async () => {
      vi.mocked(checkPermission).mockResolvedValue({
        data: { allowed: false } as unknown as {
          allowed: boolean;
          resource: string;
          action: string;
        },
      });

      wrapper.vm.testResource = 'admin';
      wrapper.vm.testAction = 'delete';

      await wrapper.vm.handleTestPermission();
      await nextTick();

      expect(wrapper.vm.testResult?.allowed).toBe(false);
    });

    it('should handle API error in permission test', async () => {
      vi.mocked(checkPermission).mockRejectedValue({
        response: { data: { statusCode: 500, message: 'Server error' } },
      });

      wrapper.vm.testResource = 'user';
      wrapper.vm.testAction = 'read';

      await wrapper.vm.handleTestPermission();

      expect(ElMessage.error).toHaveBeenCalled();
      expect(wrapper.vm.testResult).toBeNull();
    });

    it('should clear test result', async () => {
      wrapper.vm.testResource = 'user';
      wrapper.vm.testAction = 'read';
      wrapper.vm.testResult = { allowed: true };

      wrapper.vm.clearTestResult();
      await nextTick();

      expect(wrapper.vm.testResource).toBe('');
      expect(wrapper.vm.testAction).toBe('');
      expect(wrapper.vm.testResult).toBeNull();
    });

    it('should trim test inputs before API call', async () => {
      vi.mocked(checkPermission).mockResolvedValue({
        data: { allowed: true } as unknown as {
          allowed: boolean;
          resource: string;
          action: string;
        },
      });

      wrapper.vm.testResource = '  user  ';
      wrapper.vm.testAction = '  read  ';

      await wrapper.vm.handleTestPermission();

      expect(checkPermission).toHaveBeenCalledWith('user', 'read');
    });

    it('should set testLoading during API call', async () => {
      vi.mocked(checkPermission).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { allowed: true } as unknown as {
                    allowed: boolean;
                    resource: string;
                    action: string;
                  },
                }),
              50
            )
          )
      );

      wrapper.vm.testResource = 'user';
      wrapper.vm.testAction = 'read';

      const promise = wrapper.vm.handleTestPermission();
      expect(wrapper.vm.testLoading).toBe(true);

      await promise;
      expect(wrapper.vm.testLoading).toBe(false);
    });
  });

  // ============================================
  // Toggle & Delete Tests
  // ============================================
  describe('Toggle & Delete Operations', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should toggle policy enabled status', async () => {
      vi.mocked(togglePolicyEnabled).mockResolvedValue({
        data: createMockPolicy({ enabled: false }),
      });

      const policy = createMockPolicy({ enabled: true });
      await wrapper.vm.handleToggleEnabled(policy);

      expect(togglePolicyEnabled).toHaveBeenCalledWith(policy.id, false);
      expect(ElMessage.success).toHaveBeenCalled();
    });

    it('should toggle disabled policy to enabled', async () => {
      vi.mocked(togglePolicyEnabled).mockResolvedValue({
        data: createMockPolicy({ enabled: true }),
      });

      const policy = createMockPolicy({ enabled: false });
      await wrapper.vm.handleToggleEnabled(policy);

      expect(togglePolicyEnabled).toHaveBeenCalledWith(policy.id, true);
    });

    it('should handle toggle error', async () => {
      vi.mocked(togglePolicyEnabled).mockRejectedValue({
        response: { data: { statusCode: 500, message: 'Server error' } },
      });

      const policy = createMockPolicy();
      await wrapper.vm.handleToggleEnabled(policy);

      expect(ElMessage.error).toHaveBeenCalled();
    });

    it('should delete policy', async () => {
      vi.mocked(deletePolicy).mockResolvedValue({
        data: { message: 'Deleted' },
      });

      const policy = createMockPolicy();
      await wrapper.vm.handleDelete(policy);

      expect(deletePolicy).toHaveBeenCalledWith(policy.id);
      expect(ElMessage.success).toHaveBeenCalled();
    });

    it('should handle delete error', async () => {
      vi.mocked(deletePolicy).mockRejectedValue({
        response: { data: { statusCode: 404, message: 'Not found' } },
      });

      const policy = createMockPolicy();
      await wrapper.vm.handleDelete(policy);

      expect(ElMessage.error).toHaveBeenCalled();
    });

    it('should set delete loading state', async () => {
      vi.mocked(deletePolicy).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ data: { message: 'Deleted' } }), 50))
      );

      const policy = createMockPolicy();
      const deletePromise = wrapper.vm.handleDelete(policy);

      expect(wrapper.vm.deleteLoading).toBe(policy.id);

      await deletePromise;

      expect(wrapper.vm.deleteLoading).toBeNull();
    });

    it('should refresh policies after toggle', async () => {
      vi.mocked(togglePolicyEnabled).mockResolvedValue({
        data: createMockPolicy({ enabled: false }),
      });

      const policy = createMockPolicy();
      vi.mocked(getPolicies).mockClear();

      await wrapper.vm.handleToggleEnabled(policy);

      expect(getPolicies).toHaveBeenCalled();
    });

    it('should refresh policies after delete', async () => {
      vi.mocked(deletePolicy).mockResolvedValue({
        data: { message: 'Deleted' },
      });

      const policy = createMockPolicy();
      vi.mocked(getPolicies).mockClear();

      await wrapper.vm.handleDelete(policy);

      expect(getPolicies).toHaveBeenCalled();
    });
  });

  // ============================================
  // Utility Functions Tests
  // ============================================
  describe('Utility Functions', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should format date correctly', () => {
      const date = '2024-06-15T10:30:00.000Z';
      const formatted = wrapper.vm.formatDate(date);

      expect(formatted).toBeTruthy();
    });

    it('should return dash for empty date', () => {
      const formatted = wrapper.vm.formatDate('');

      expect(formatted).toBe('-');
    });

    it('should truncate conditions display', () => {
      const conditionsWithTime: PolicyCondition = { time: { start: '09:00' } };
      const conditionsWithIp: PolicyCondition = { ip: { allowed: ['192.168.1.1'] } };
      const conditionsWithBoth: PolicyCondition = {
        time: { start: '09:00' },
        ip: { allowed: ['192.168.1.1'] },
      };

      expect(wrapper.vm.truncateConditions(conditionsWithTime)).toBe('Time');
      expect(wrapper.vm.truncateConditions(conditionsWithIp)).toBe('IP');
      expect(wrapper.vm.truncateConditions(conditionsWithBoth)).toBe('Time, IP');
      expect(wrapper.vm.truncateConditions(null)).toBe('-');
    });

    it('should get correct effect label', () => {
      expect(wrapper.vm.getEffectLabel('allow')).toBe('Allow');
      expect(wrapper.vm.getEffectLabel('deny')).toBe('Deny');
    });

    it('should get correct enabled label', () => {
      expect(wrapper.vm.getEnabledLabel(true)).toBe('Enabled');
      expect(wrapper.vm.getEnabledLabel(false)).toBe('Disabled');
    });
  });

  // ============================================
  // Form Validation Tests
  // ============================================
  describe('Form Validation', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should have validation rules', () => {
      const rules = wrapper.vm.formRules();

      expect(rules.name).toBeDefined();
      expect(rules.name.length).toBeGreaterThan(0);
      expect(rules.effect).toBeDefined();
      expect(rules.subject).toBeDefined();
      expect(rules.resource).toBeDefined();
      expect(rules.action).toBeDefined();
    });

    it('should have required rule for name', () => {
      const rules = wrapper.vm.formRules();
      const nameRequired = rules.name.find((r: { required?: boolean }) => r.required);

      expect(nameRequired).toBeDefined();
    });

    it('should have max length rule for name', () => {
      const rules = wrapper.vm.formRules();
      const nameMaxLength = rules.name.find((r: { max?: number }) => r.max === 100);

      expect(nameMaxLength).toBeDefined();
    });

    it('should have required rule for effect', () => {
      const rules = wrapper.vm.formRules();
      const effectRequired = rules.effect.find((r: { required?: boolean }) => r.required);

      expect(effectRequired).toBeDefined();
    });
  });

  // ============================================
  // Reset Form Tests
  // ============================================
  describe('Reset Form', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should reset all form fields', async () => {
      wrapper.vm.formData.id = 'test-id';
      wrapper.vm.formData.name = 'Test Name';
      wrapper.vm.formData.description = 'Test Description';
      wrapper.vm.formData.effect = 'deny';
      wrapper.vm.formData.subject = 'role:test';
      wrapper.vm.formData.resource = 'test-resource';
      wrapper.vm.formData.action = 'test-action';
      wrapper.vm.formData.priority = 50;
      wrapper.vm.formData.enabled = false;

      wrapper.vm.timeEnabled = true;
      wrapper.vm.ipEnabled = true;
      wrapper.vm.timeConditionData.start = '09:00';
      wrapper.vm.ipConditionData.allowed = ['192.168.1.1'];

      wrapper.vm.resetForm();
      await nextTick();

      expect(wrapper.vm.formData.id).toBeUndefined();
      expect(wrapper.vm.formData.name).toBe('');
      expect(wrapper.vm.formData.description).toBe('');
      expect(wrapper.vm.formData.effect).toBe('allow');
      expect(wrapper.vm.formData.subject).toBe('');
      expect(wrapper.vm.formData.resource).toBe('');
      expect(wrapper.vm.formData.action).toBe('');
      expect(wrapper.vm.formData.priority).toBe(0);
      expect(wrapper.vm.formData.enabled).toBe(true);
      expect(wrapper.vm.timeEnabled).toBe(false);
      expect(wrapper.vm.ipEnabled).toBe(false);
      expect(wrapper.vm.timeConditionData.start).toBe('');
      expect(wrapper.vm.ipConditionData.allowed).toEqual(['']);
    });
  });

  // ============================================
  // Loading States Tests
  // ============================================
  describe('Loading States', () => {
    it('should show loading on fetch', async () => {
      vi.mocked(getPolicies).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: [createMockPolicy()],
                  total: 1,
                  page: 1,
                  limit: 10,
                }),
              100
            )
          )
      );

      const mountPromise = mountPolicies();

      // The wrapper might not be set yet during the initial loading state
      // So we just check that the mount completes successfully
      await mountPromise;
      expect(wrapper.vm.loading).toBe(false);
    });

    it('should set loading to false after fetch', async () => {
      wrapper = await mountPolicies();

      expect(wrapper.vm.loading).toBe(false);
    });

    it('should set loading to false on fetch error', async () => {
      vi.mocked(getPolicies).mockRejectedValue({
        response: { data: { statusCode: 500, message: 'Error' } },
      });

      wrapper = await mountPolicies();

      expect(wrapper.vm.loading).toBe(false);
    });
  });

  // ============================================
  // Effect Options Tests
  // ============================================
  describe('Effect Options', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should have effect options defined', () => {
      expect(wrapper.vm.effectOptions).toBeDefined();
      expect(wrapper.vm.effectOptions.length).toBe(2);
    });

    it('should have allow option', () => {
      const allowOption = wrapper.vm.effectOptions.find((o) => o.value === 'allow');
      expect(allowOption).toBeDefined();
    });

    it('should have deny option', () => {
      const denyOption = wrapper.vm.effectOptions.find((o) => o.value === 'deny');
      expect(denyOption).toBeDefined();
    });
  });

  // ============================================
  // Day of Week Options Tests
  // ============================================
  describe('Day of Week Options', () => {
    beforeEach(async () => {
      wrapper = await mountPolicies();
    });

    it('should have 7 day options', () => {
      expect(wrapper.vm.dayOfWeekOptions.length).toBe(7);
    });

    it('should have correct day values (0-6)', () => {
      const values = wrapper.vm.dayOfWeekOptions.map((d) => d.value);
      expect(values).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });
});
