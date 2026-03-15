import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, defineComponent, h } from 'vue';
import MessageList from '../MessageList.vue';
import type { MessageResponse } from '@/types/chat';

// ============================================
// Mocks
// ============================================

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Mock Pinia stores
const mockCurrentMessages = ref<MessageResponse[]>([]);
const mockIsLoadingMessages = ref(false);
const mockCurrentUser = ref<{ id: string } | null>(null);

vi.mock('@/stores/chat', () => ({
  useChatStore: () => ({
    currentMessages: mockCurrentMessages.value,
    isLoadingMessages: mockIsLoadingMessages.value,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockCurrentUser.value,
  }),
}));

// Mock @element-plus/icons-vue
vi.mock('@element-plus/icons-vue', () => ({
  Document: {},
  Picture: {},
  ChatDotRound: {},
  WarningFilled: {},
}));

// ============================================
// Test Data
// ============================================

const createMessage = (overrides: Partial<MessageResponse> = {}): MessageResponse => ({
  id: 'msg-1',
  roomId: 'room-1',
  senderId: 'user-1',
  senderName: 'TestUser',
  type: 'text',
  content: 'Hello World',
  metadata: null,
  replyToId: null,
  editedAt: null,
  deletedAt: null,
  createdAt: '2024-01-15T10:30:00Z',
  ...overrides,
});

// ============================================
// Stub Components
// ============================================

const DynamicScrollerItemStub = defineComponent({
  props: ['item', 'active', 'sizeDependencies'],
  setup(_, { slots }) {
    return () => h('div', { class: 'dynamic-scroller-item-stub' }, slots.default?.());
  },
});

const DynamicScrollerStub = defineComponent({
  props: ['items', 'minItemSize', 'keyField'],
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'dynamic-scroller-stub' },
        props.items?.map((item: MessageResponse) => slots.default?.({ item, active: true }))
      );
  },
});

const ElEmptyStub = defineComponent({
  props: ['description', 'imageSize'],
  setup(props) {
    return () => h('div', { class: 'el-empty-stub' }, props.description);
  },
});

const ElIconStub = defineComponent({
  setup(_, { slots }) {
    return () => h('i', { class: 'el-icon-stub' }, slots.default?.());
  },
});

// ============================================
// Helper Functions
// ============================================

function createWrapper() {
  return mount(MessageList, {
    global: {
      stubs: {
        DynamicScroller: DynamicScrollerStub,
        DynamicScrollerItem: DynamicScrollerItemStub,
        'el-empty': ElEmptyStub,
        'el-icon': ElIconStub,
      },
      directives: {
        loading: () => {}, // Mock v-loading directive
      },
    },
  });
}

// ============================================
// Tests
// ============================================

describe('MessageList.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentMessages.value = [];
    mockIsLoadingMessages.value = false;
    mockCurrentUser.value = null;
  });

  describe('Message Layout', () => {
    it('should apply my-message class for own messages', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [createMessage({ id: 'msg-1', senderId: 'user-me' })];

      const wrapper = createWrapper();
      await flushPromises();

      const messageItem = wrapper.find('.message-item');
      expect(messageItem.exists()).toBe(true);
      expect(messageItem.classes()).toContain('my-message');
    });

    it('should NOT apply my-message class for other users messages', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [createMessage({ id: 'msg-1', senderId: 'user-other' })];

      const wrapper = createWrapper();
      await flushPromises();

      const messageItem = wrapper.find('.message-item');
      expect(messageItem.exists()).toBe(true);
      expect(messageItem.classes()).not.toContain('my-message');
    });

    it('should apply system-message class for system messages', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', type: 'system', senderId: 'system' }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const messageItem = wrapper.find('.message-item');
      expect(messageItem.exists()).toBe(true);
      expect(messageItem.classes()).toContain('system-message');
    });

    it('should NOT apply my-message class when user is not logged in', async () => {
      mockCurrentUser.value = null;
      mockCurrentMessages.value = [createMessage({ id: 'msg-1', senderId: 'user-1' })];

      const wrapper = createWrapper();
      await flushPromises();

      const messageItem = wrapper.find('.message-item');
      expect(messageItem.exists()).toBe(true);
      expect(messageItem.classes()).not.toContain('my-message');
    });
  });

  describe('Sender Name Display', () => {
    it('should display "我" for own messages', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', senderId: 'user-me', senderName: 'MyName' }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const senderId = wrapper.find('.sender-id');
      expect(senderId.exists()).toBe(true);
      expect(senderId.text()).toBe('我');
    });

    it('should display senderName when present for other users', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', senderId: 'user-other', senderName: 'Alice' }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const senderId = wrapper.find('.sender-id');
      expect(senderId.exists()).toBe(true);
      expect(senderId.text()).toBe('Alice');
    });

    it('should fallback to senderId.slice(0, 8) when senderName is undefined', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', senderId: 'very-long-user-id-12345', senderName: undefined }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const senderId = wrapper.find('.sender-id');
      expect(senderId.exists()).toBe(true);
      expect(senderId.text()).toBe('very-lon');
    });

    it('should fallback to senderId.slice(0, 8) when senderName is null', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      // Create message without senderName to simulate null
      const msg: MessageResponse = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'abcdefgh123456',
        senderName: undefined,
        type: 'text',
        content: 'Test',
        metadata: null,
        replyToId: null,
        editedAt: null,
        deletedAt: null,
        createdAt: '2024-01-15T10:30:00Z',
      };
      mockCurrentMessages.value = [msg];

      const wrapper = createWrapper();
      await flushPromises();

      const senderId = wrapper.find('.sender-id');
      expect(senderId.exists()).toBe(true);
      expect(senderId.text()).toBe('abcdefgh');
    });

    it('should handle short senderId correctly', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', senderId: 'abc', senderName: undefined }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const senderId = wrapper.find('.sender-id');
      expect(senderId.exists()).toBe(true);
      expect(senderId.text()).toBe('abc');
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no messages', async () => {
      mockCurrentMessages.value = [];

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.find('.el-empty-stub').exists()).toBe(true);
    });

    it('should NOT show empty state when messages exist', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [createMessage()];

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.find('.el-empty-stub').exists()).toBe(false);
    });
  });

  describe('Deleted Message', () => {
    it('should apply deleted-message class for deleted messages', async () => {
      mockCurrentUser.value = { id: 'user-me' };
      mockCurrentMessages.value = [
        createMessage({ id: 'msg-1', deletedAt: '2024-01-15T11:00:00Z' }),
      ];

      const wrapper = createWrapper();
      await flushPromises();

      const messageItem = wrapper.find('.message-item');
      expect(messageItem.exists()).toBe(true);
      expect(messageItem.classes()).toContain('deleted-message');
    });
  });
});
