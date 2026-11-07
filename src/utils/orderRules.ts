import {
  ItemSpecs,
  Order,
  OrderItem,
  SystemSettings,
  UserRole,
  WhatsAppMessage,
} from '../types';

export interface GroupingDecision {
  action:
    | 'append_to_existing_draft'
    | 'create_new_draft'
    | 'create_draft_with_merge_offer'
    | 'flag_change_requested_on_open_order';
  targetOrderId?: string;
  mergeableIntoOrderId?: string;
  shouldSendUrduAck: boolean;
  replyTargetItemId?: string;
}

/**
 * Evaluates how an incoming WhatsApp message from a customer should be grouped or routed
 * according to Section 3 of the Project Plan (Grouping rule & Follow-up rule).
 */
export function evaluateMessageGrouping(params: {
  customerOrders: Order[];
  orderItems: OrderItem[];
  customerMessages: WhatsAppMessage[];
  incomingType: 'text' | 'audio' | 'image' | 'video';
  incomingTimestampIso: string;
  replyToWaId?: string;
  settings: Pick<
    SystemSettings,
    | 'quiet_period_minutes'
    | 'followup_text_sets_change_requested'
    | 'followup_image_creates_draft'
    | 'auto_urdu_ack_enabled'
  >;
}): GroupingDecision {
  const {
    customerOrders,
    orderItems,
    customerMessages,
    incomingType,
    incomingTimestampIso,
    replyToWaId,
    settings,
  } = params;

  const incomingTimeMs = new Date(incomingTimestampIso).getTime();
  const quietWindowMs = Math.max(1, settings.quiet_period_minutes) * 60 * 1000;

  // Check if message replies to a specific WhatsApp message linked to an item
  let replyTargetItemId: string | undefined;
  if (replyToWaId) {
    const repliedMsg = customerMessages.find((m) => m.wa_message_id === replyToWaId);
    if (repliedMsg?.item_id) {
      replyTargetItemId = repliedMsg.item_id;
    }
  }

  // 1. Check active draft orders from the same customer within the quiet period
  const activeDrafts = customerOrders
    .filter((o) => o.is_draft && !o.deleted_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (activeDrafts.length > 0) {
    const latestDraft = activeDrafts[0];
    const draftMessages = customerMessages.filter((m) => m.order_id === latestDraft.id);
    const lastDraftMsgTimeMs =
      draftMessages.length > 0
        ? Math.max(...draftMessages.map((m) => new Date(m.timestamp).getTime()))
        : new Date(latestDraft.created_at).getTime();

    if (incomingTimeMs - lastDraftMsgTimeMs <= quietWindowMs) {
      return {
        action: 'append_to_existing_draft',
        targetOrderId: latestDraft.id,
        shouldSendUrduAck: false, // Sent once per group of messages, not once per message
        replyTargetItemId,
      };
    }
  }

  // 2. Check if customer has an open (confirmed, non-Delivered) order
  const openOrders = customerOrders
    .filter((o) => !o.is_draft && !o.deleted_at && !o.delivered_at)
    .filter((o) => {
      const items = orderItems.filter((it) => it.order_id === o.id);
      return items.some((it) => it.status !== 'Delivered');
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (openOrders.length > 0) {
    const latestOpenOrder = openOrders[0];
    if (
      (incomingType === 'text' || incomingType === 'audio') &&
      settings.followup_text_sets_change_requested
    ) {
      return {
        action: 'flag_change_requested_on_open_order',
        targetOrderId: latestOpenOrder.id,
        shouldSendUrduAck: false,
        replyTargetItemId,
      };
    }

    if (
      (incomingType === 'image' || incomingType === 'video') &&
      settings.followup_image_creates_draft
    ) {
      return {
        action: 'create_draft_with_merge_offer',
        mergeableIntoOrderId: latestOpenOrder.id,
        shouldSendUrduAck: settings.auto_urdu_ack_enabled,
        replyTargetItemId,
      };
    }
  }

  // 3. Otherwise create a fresh draft order and send the Urdu acknowledgement once
  return {
    action: 'create_new_draft',
    shouldSendUrduAck: settings.auto_urdu_ack_enabled,
    replyTargetItemId,
  };
}

/**
 * Formats the automatic Urdu acknowledgement message when a draft order is created.
 */
export function formatUrduAcknowledgement(orderNumber: number, template?: string): string {
  const base =
    template && template.trim().length > 0
      ? template
      : 'آپ کا آرڈر موصول ہو گیا ہے۔ آرڈر نمبر {{number}}۔ شکریہ۔';
  return base.replace('{{number}}', String(orderNumber));
}

export interface WindowCheckResult {
  isOpen: boolean;
  hoursRemaining: number;
  deliveryMode: 'freeform' | 'template_required';
}

/**
 * Checks whether Meta's 24-hour customer service window is open for free-form media replies.
 */
export function checkCustomerServiceWindow(
  lastCustomerMessageIso: string | undefined,
  nowIso: string = new Date().toISOString()
): WindowCheckResult {
  if (!lastCustomerMessageIso) {
    return {
      isOpen: false,
      hoursRemaining: 0,
      deliveryMode: 'template_required',
    };
  }
  const lastMs = new Date(lastCustomerMessageIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  const elapsedHours = (nowMs - lastMs) / (1000 * 60 * 60);
  const remaining = Math.max(0, Number((24 - elapsedHours).toFixed(1)));
  const isOpen = elapsedHours >= 0 && elapsedHours < 24;

  return {
    isOpen,
    hoursRemaining: isOpen ? remaining : 0,
    deliveryMode: isOpen ? 'freeform' : 'template_required',
  };
}

/**
 * Applies specification updates WITHOUT converting units (Section 4: "never converts automatically in version 1")
 * and records crossed-out previous values when a field changes after confirmation.
 */
export function applySpecChangeWithDiff(
  currentSpecs: ItemSpecs,
  previousSpecs: ItemSpecs,
  incomingSpecs: ItemSpecs,
  trackChanges: boolean
): {
  specs: ItemSpecs;
  previousSpecs: ItemSpecs;
  changedKeys: string[];
} {
  const nextSpecs: ItemSpecs = { ...currentSpecs };
  const nextPrev: ItemSpecs = { ...previousSpecs };
  const changedKeys: string[] = [];

  for (const [key, newVal] of Object.entries(incomingSpecs)) {
    const cleanedValue = (newVal?.value ?? '').trim();
    const cleanedUnit = newVal?.unit;

    const existing = currentSpecs[key];
    const existingValue = (existing?.value ?? '').trim();
    const existingUnit = existing?.unit;

    const isDifferent =
      cleanedValue !== existingValue || (cleanedUnit || '') !== (existingUnit || '');

    if (isDifferent) {
      if (trackChanges && existingValue !== '') {
        // Preserve old value so designer sees old value crossed out beside the new one
        nextPrev[key] = {
          value: existingValue,
          unit: existingUnit,
        };
        changedKeys.push(key);
      }
      if (cleanedValue === '') {
        delete nextSpecs[key];
      } else {
        // Store exact value and unit without any unit conversion
        nextSpecs[key] = {
          value: cleanedValue,
          ...(cleanedUnit ? { unit: cleanedUnit } : {}),
        };
      }
    }
  }

  return {
    specs: nextSpecs,
    previousSpecs: nextPrev,
    changedKeys,
  };
}

/**
 * Redacts customer phone numbers and private customer details when viewed by a Designer
 * (Section 2 & 10: "Designers never see the customer's phone number").
 */
export function maskCustomerForRole<
  T extends { phone?: string; profile_name?: string; display_name?: string; notes?: string }
>(customer: T, role: UserRole): T {
  if (role === 'designer') {
    return {
      ...customer,
      phone: 'HIDDEN',
      profile_name: 'Customer (Protected)',
      display_name: 'Customer (Protected)',
      notes: '',
    };
  }
  return customer;
}
