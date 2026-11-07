import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMessageGrouping,
  formatUrduAcknowledgement,
  checkCustomerServiceWindow,
  applySpecChangeWithDiff,
  maskCustomerForRole,
} from './orderRules';
import { Order, OrderItem, WhatsAppMessage } from '../types';

const defaultSettings = {
  quiet_period_minutes: 3,
  followup_text_sets_change_requested: true,
  followup_image_creates_draft: true,
  auto_urdu_ack_enabled: true,
};

test('grouping rule: messages within 3-minute quiet period append to existing draft without duplicate Urdu ack', () => {
  const draftOrder: Order = {
    id: 'ord-1',
    number: 123,
    account_id: 'wa-1',
    customer_id: 'cust-1',
    source: 'whatsapp',
    is_draft: true,
    ack_sent: true,
    created_by: 'system',
    created_at: '2026-11-08T10:00:00.000Z',
  };

  const existingMsg: WhatsAppMessage = {
    id: 'msg-1',
    account_id: 'wa-1',
    customer_id: 'cust-1',
    wa_message_id: 'wamid.1',
    direction: 'inbound',
    type: 'image',
    text: 'Ring design',
    timestamp: '2026-11-08T10:01:00.000Z',
    order_id: 'ord-1',
    item_id: 'item-1',
  };

  const decision = evaluateMessageGrouping({
    customerOrders: [draftOrder],
    orderItems: [],
    customerMessages: [existingMsg],
    incomingType: 'audio',
    incomingTimestampIso: '2026-11-08T10:03:30.000Z', // 2.5 mins after last message (within 3m quiet period)
    replyToWaId: 'wamid.1',
    settings: defaultSettings,
  });

  assert.equal(decision.action, 'append_to_existing_draft');
  assert.equal(decision.targetOrderId, 'ord-1');
  assert.equal(decision.shouldSendUrduAck, false);
  assert.equal(decision.replyTargetItemId, 'item-1');
});

test('follow-up rule: text or voice message on an open order sets Change requested instead of new order', () => {
  const openOrder: Order = {
    id: 'ord-open',
    number: 124,
    account_id: 'wa-1',
    customer_id: 'cust-1',
    source: 'whatsapp',
    is_draft: false,
    ack_sent: true,
    created_by: 'user-owner',
    created_at: '2026-11-08T08:00:00.000Z',
  };

  const openItem: OrderItem = {
    id: 'item-open',
    order_id: 'ord-open',
    order_number: 124,
    item_index: 1,
    category_id: 'cat-ring',
    designer_id: 'des-1',
    status: 'In progress',
    specs: { weight: { value: '1.5', unit: 'tola' } },
    previous_specs: {},
    ai_suggested_specs: {},
    note: '',
    change_flag: false,
    reference_media_ids: [],
    output_media_ids: [],
    created_at: '2026-11-08T08:00:00.000Z',
    updated_at: '2026-11-08T08:30:00.000Z',
  };

  const decision = evaluateMessageGrouping({
    customerOrders: [openOrder],
    orderItems: [openItem],
    customerMessages: [],
    incomingType: 'text',
    incomingTimestampIso: '2026-11-08T11:00:00.000Z',
    settings: defaultSettings,
  });

  assert.equal(decision.action, 'flag_change_requested_on_open_order');
  assert.equal(decision.targetOrderId, 'ord-open');
  assert.equal(decision.shouldSendUrduAck, false);
});

test('follow-up rule: new image from customer with open order creates draft with one-tap merge offer', () => {
  const openOrder: Order = {
    id: 'ord-open',
    number: 125,
    account_id: 'wa-1',
    customer_id: 'cust-1',
    source: 'whatsapp',
    is_draft: false,
    ack_sent: true,
    created_by: 'user-owner',
    created_at: '2026-11-08T08:00:00.000Z',
  };

  const openItem: OrderItem = {
    id: 'item-open',
    order_id: 'ord-open',
    order_number: 125,
    item_index: 1,
    category_id: 'cat-bangle',
    designer_id: 'des-2',
    status: 'Allotted',
    specs: {},
    previous_specs: {},
    ai_suggested_specs: {},
    note: '',
    change_flag: false,
    reference_media_ids: [],
    output_media_ids: [],
    created_at: '2026-11-08T08:00:00.000Z',
    updated_at: '2026-11-08T08:00:00.000Z',
  };

  const decision = evaluateMessageGrouping({
    customerOrders: [openOrder],
    orderItems: [openItem],
    customerMessages: [],
    incomingType: 'image',
    incomingTimestampIso: '2026-11-08T11:00:00.000Z',
    settings: defaultSettings,
  });

  assert.equal(decision.action, 'create_draft_with_merge_offer');
  assert.equal(decision.mergeableIntoOrderId, 'ord-open');
  assert.equal(decision.shouldSendUrduAck, true);
});

test('Urdu acknowledgement formatting inserts order number accurately', () => {
  const text = formatUrduAcknowledgement(123);
  assert.equal(text, 'آپ کا آرڈر موصول ہو گیا ہے۔ آرڈر نمبر 123۔ شکریہ۔');
});

test('24-hour customer service window distinguishes open free-form vs closed template fallback', () => {
  const openCheck = checkCustomerServiceWindow(
    '2026-11-08T02:00:00.000Z',
    '2026-11-08T14:00:00.000Z'
  );
  assert.equal(openCheck.isOpen, true);
  assert.equal(openCheck.deliveryMode, 'freeform');
  assert.equal(openCheck.hoursRemaining, 12);

  const closedCheck = checkCustomerServiceWindow(
    '2026-11-06T10:00:00.000Z',
    '2026-11-08T14:00:00.000Z'
  );
  assert.equal(closedCheck.isOpen, false);
  assert.equal(closedCheck.deliveryMode, 'template_required');
  assert.equal(closedCheck.hoursRemaining, 0);
});

test('spec change preserves exact units without silent conversion and tracks crossed-out old value', () => {
  const current = {
    weight: { value: '2.5', unit: 'tola' },
    ring_size: { value: '18', unit: 'steel' },
  };
  const updated = {
    weight: { value: '2.75', unit: 'tola' },
    ring_size: { value: '18', unit: 'steel' },
    thawa_size: { value: '14', unit: 'mm' },
  };

  const res = applySpecChangeWithDiff(current, {}, updated, true);
  assert.deepEqual(res.specs.weight, { value: '2.75', unit: 'tola' });
  assert.deepEqual(res.previousSpecs.weight, { value: '2.5', unit: 'tola' });
  assert.deepEqual(res.specs.thawa_size, { value: '14', unit: 'mm' });
  assert.deepEqual(res.changedKeys, ['weight']);
});

test('role privacy masking hides customer phone from designer role', () => {
  const customer = {
    id: 'c1',
    phone: '+92 300 8412901',
    profile_name: 'Al-Madina Jewellers',
    display_name: 'Haji Tariq (Al-Madina)',
    notes: 'Regular wholesale buyer',
  };

  const forDesigner = maskCustomerForRole(customer, 'designer');
  assert.equal(forDesigner.phone, 'HIDDEN');
  assert.equal(forDesigner.display_name, 'Customer (Protected)');

  const forOwner = maskCustomerForRole(customer, 'owner');
  assert.equal(forOwner.phone, '+92 300 8412901');
});
