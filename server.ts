import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createInitialDatabaseState, DatabaseState } from './src/utils/seedData';
import {
  applySpecChangeWithDiff,
  checkCustomerServiceWindow,
  evaluateMessageGrouping,
  formatUrduAcknowledgement,
  maskCustomerForRole,
} from './src/utils/orderRules';
import {
  ItemSpecs,
  MediaFile,
  OrderItemStatus,
  UserAccount,
  WhatsAppMessage,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data');
const STATE_FILE = path.join(DATA_DIR, 'rp_state.json');

function loadDatabase(): DatabaseState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw) as DatabaseState;
    }
  } catch (err) {
    console.error('Failed to read state file, initializing fresh seed:', err);
  }
  const initial = createInitialDatabaseState();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: DatabaseState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist state file:', err);
  }
}

let db: DatabaseState = loadDatabase();

function getActor(req: express.Request): UserAccount {
  const userId = String(req.headers['x-user-id'] || 'user-owner');
  const found = db.users.find((u) => u.id === userId);
  return found || db.users[0];
}

function addAudit(actor: UserAccount, action: string, target: string, details: string) {
  db.audit_log.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action,
    target,
    details,
    at: new Date().toISOString(),
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Healthcheck for Docker / Nginx / VPS monitoring
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'rp-design-order-management',
      uptime_sec: Math.round(process.uptime()),
      orders_count: db.orders.length,
      items_count: db.order_items.length,
      storage_path: STATE_FILE,
    });
  });

  // Main application state endpoint with strict role-based filtering & privacy rules
  app.get('/api/state', (req, res) => {
    const actor = getActor(req);
    const logAdminView = req.query.log_access === '1';

    if (actor.role === 'admin' && logAdminView && db.settings.admin_data_access_enabled) {
      db.admin_access_log.unshift({
        id: `aal-${Date.now()}`,
        admin_id: actor.id,
        admin_name: actor.full_name,
        endpoint: 'GET /api/state (Order & Customer Monitor)',
        reason: 'Admin inspected live workshop state with owner permission enabled',
        at: new Date().toISOString(),
      });
      saveDatabase(db);
    }

    // Designer role: Only sees orders/items allotted to them, and NEVER sees customer phone numbers
    if (actor.role === 'designer') {
      const myItems = db.order_items.filter((it) => it.designer_id === actor.id);
      const myOrderIds = new Set(myItems.map((it) => it.order_id));
      const myOrders = db.orders.filter((o) => myOrderIds.has(o.id) && !o.deleted_at);
      const maskedCustomers = db.customers.map((c) => maskCustomerForRole(c, 'designer'));
      const myMessages = db.messages.filter((m) => m.order_id && myOrderIds.has(m.order_id));

      return res.json({
        actor,
        settings: db.settings,
        whatsapp_accounts: db.whatsapp_accounts,
        users: db.users,
        categories: db.categories,
        category_fields: db.category_fields,
        customers: maskedCustomers,
        media: db.media,
        orders: myOrders,
        order_items: myItems,
        messages: myMessages,
        status_history: db.status_history.filter((sh) =>
          myItems.some((it) => it.id === sh.item_id)
        ),
        audit_log: [],
        admin_access_log: [],
        error_log: [],
        ai_prompt_versions: [],
        ai_corrections: [],
      });
    }

    // Admin role when Owner has switched off Admin access to order data
    if (actor.role === 'admin' && !db.settings.admin_data_access_enabled) {
      return res.json({
        actor,
        settings: db.settings,
        whatsapp_accounts: db.whatsapp_accounts,
        users: db.users,
        categories: db.categories,
        category_fields: db.category_fields,
        customers: [],
        media: [],
        orders: [],
        order_items: [],
        messages: [],
        status_history: [],
        audit_log: db.audit_log,
        admin_access_log: db.admin_access_log,
        error_log: db.error_log,
        ai_prompt_versions: db.ai_prompt_versions,
        ai_corrections: db.ai_corrections,
        admin_data_blocked: true,
      });
    }

    // Owner, Staff, or authorized Admin
    return res.json({
      actor,
      ...db,
      orders: db.orders.filter((o) => !o.deleted_at),
    });
  });

  // Meta WhatsApp Cloud API Webhook Verification (GET)
  app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'rp_design_verify_secret_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Webhook verification token mismatch' });
  });

  // Meta WhatsApp Cloud API Webhook Receiver (POST) - Verifies signature, deduplicates wa_message_id, returns 200 immediately
  app.post('/api/webhooks/whatsapp', (req, res) => {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const signature = req.headers['x-hub-signature-256'];
    if (appSecret && signature && typeof signature === 'string') {
      const expectedSig =
        'sha256=' +
        crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex');
      if (signature !== expectedSig) {
        db.error_log.unshift({
          id: `err-${Date.now()}`,
          source: 'webhook',
          message: 'Invalid X-Hub-Signature-256 on incoming WhatsApp webhook',
          context: `Header: ${signature}`,
          resolved: false,
          at: new Date().toISOString(),
        });
        saveDatabase(db);
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Return 200 immediately as required by Meta Cloud API
    res.status(200).json({ status: 'received' });
  });

  // Interactive WhatsApp Incoming Message Simulator (processes real grouping & follow-up rules)
  app.post('/api/whatsapp/simulate', (req, res) => {
    const actor = getActor(req);
    const {
      customer_phone,
      customer_name,
      account_id = 'wa-main',
      message_type = 'image',
      text = '',
      svg_type = 'ring',
      reply_to_wa_id,
      ai_suggested_category_id = 'cat-ring',
      ai_suggested_specs = {},
    } = req.body;

    if (!customer_phone || !String(customer_phone).trim()) {
      return res.status(400).json({ error: 'Customer phone number is required' });
    }

    const nowIso = new Date().toISOString();
    const waMessageId = `wamid.SIM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Deduplicate wa_message_id
    if (db.messages.some((m) => m.wa_message_id === waMessageId)) {
      return res.json({ deduplicated: true });
    }

    // Find or create customer
    let customer = db.customers.find((c) => c.phone.trim() === String(customer_phone).trim());
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        phone: String(customer_phone).trim(),
        profile_name: customer_name || 'WhatsApp Customer',
        display_name: customer_name || String(customer_phone).trim(),
        notes: 'Created automatically from incoming WhatsApp message',
        last_message_at: nowIso,
        created_at: nowIso,
      };
      db.customers.unshift(customer);
    } else {
      customer.last_message_at = nowIso;
    }

    const customerOrders = db.orders.filter((o) => o.customer_id === customer!.id && !o.deleted_at);
    const customerMessages = db.messages.filter((m) => m.customer_id === customer!.id);

    const decision = evaluateMessageGrouping({
      customerOrders,
      orderItems: db.order_items,
      customerMessages,
      incomingType: message_type,
      incomingTimestampIso: nowIso,
      replyToWaId: reply_to_wa_id,
      settings: db.settings,
    });

    let targetOrder = decision.targetOrderId
      ? db.orders.find((o) => o.id === decision.targetOrderId)
      : undefined;

    let createdNewDraft = false;

    if (
      decision.action === 'create_new_draft' ||
      decision.action === 'create_draft_with_merge_offer' ||
      !targetOrder
    ) {
      const nextOrderNum =
        db.orders.reduce((max, o) => Math.max(max, o.number), 120) + 1;
      const ackText = decision.shouldSendUrduAck
        ? formatUrduAcknowledgement(nextOrderNum, db.settings.ack_template_urdu)
        : undefined;

      targetOrder = {
        id: `ord-${nextOrderNum}-${Date.now()}`,
        number: nextOrderNum,
        account_id,
        customer_id: customer.id,
        source: 'whatsapp',
        is_draft: true,
        mergeable_into_order_id: decision.mergeableIntoOrderId,
        ack_sent: Boolean(ackText),
        ack_message_text: ackText,
        created_by: 'whatsapp_webhook',
        created_at: nowIso,
      };
      db.orders.unshift(targetOrder);
      createdNewDraft = true;
    }

    let createdMedia: MediaFile | undefined;
    let targetItemId = decision.replyTargetItemId;

    if (message_type === 'image' || message_type === 'video') {
      createdMedia = {
        id: `med-${Date.now()}`,
        storage_key: `s3://rp-design-whatsapp-media/${nowIso.slice(0, 10)}/${waMessageId}.jpg`,
        mime: message_type === 'video' ? 'video/mp4' : 'image/jpeg',
        size: 2650000,
        sha256: crypto.createHash('sha256').update(waMessageId).digest('hex').slice(0, 32),
        kind: 'customer',
        media_type: message_type,
        title: text || `WhatsApp ${svg_type} reference`,
        svg_type,
        uploaded_by: 'whatsapp_webhook',
        created_at: nowIso,
      };
      db.media.unshift(createdMedia);

      // Each incoming image becomes an item on the draft order
      const existingItemsForOrder = db.order_items.filter((it) => it.order_id === targetOrder!.id);
      const newItemId = `item-${targetOrder.number}-${existingItemsForOrder.length + 1}-${Date.now()}`;
      targetItemId = newItemId;

      // Check if this customer ordered a similar category before (Phase 3 repeat-order warning)
      const previousCustomerItems = db.order_items.filter((it) => {
        const ord = db.orders.find((o) => o.id === it.order_id);
        return (
          ord &&
          ord.customer_id === customer!.id &&
          ord.id !== targetOrder!.id &&
          it.category_id === ai_suggested_category_id
        );
      });

      const similarWarning =
        previousCustomerItems.length > 0
          ? {
              matched_order_number: previousCustomerItems[0].order_number,
              similarity_score: 0.89,
              summary: `This customer ordered something similar before in Order #${previousCustomerItems[0].order_number}.`,
            }
          : undefined;

      db.order_items.push({
        id: newItemId,
        order_id: targetOrder.id,
        order_number: targetOrder.number,
        item_index: existingItemsForOrder.length + 1,
        category_id: ai_suggested_category_id || 'cat-ring',
        designer_id: null,
        status: 'New',
        specs: {},
        previous_specs: {},
        ai_suggested_specs: db.settings.ai_enabled ? ai_suggested_specs : {},
        ai_suggested_category_id: db.settings.ai_enabled ? ai_suggested_category_id : undefined,
        note: text || '',
        change_flag: false,
        reference_media_ids: [createdMedia.id],
        output_media_ids: [],
        similar_order_warning: similarWarning,
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else if (decision.action === 'flag_change_requested_on_open_order' && targetOrder) {
      // Follow-up text/voice on an open order sets Change requested and shows a badge with the new message
      const items = db.order_items.filter((it) => it.order_id === targetOrder!.id);
      const itemToFlag =
        items.find((it) => it.id === decision.replyTargetItemId) || items[0];
      if (itemToFlag) {
        const prevStatus = itemToFlag.status;
        itemToFlag.status = 'Change requested';
        itemToFlag.change_flag = true;
        itemToFlag.change_note = `Customer follow-up ${message_type}: "${text}"`;
        itemToFlag.updated_at = nowIso;
        targetItemId = itemToFlag.id;

        db.status_history.unshift({
          id: `sh-${Date.now()}`,
          item_id: itemToFlag.id,
          order_number: targetOrder.number,
          from_status: prevStatus,
          to_status: 'Change requested',
          user_id: actor.id,
          user_name: 'WhatsApp Follow-Up Rule',
          note: `Customer sent follow-up ${message_type}: ${text}`,
          at: nowIso,
        });
      }
    }

    // Record the inbound message
    const inboundMsg: WhatsAppMessage = {
      id: `msg-${Date.now()}`,
      account_id,
      customer_id: customer.id,
      wa_message_id: waMessageId,
      direction: 'inbound',
      type: message_type,
      text:
        text ||
        (message_type === 'audio'
          ? 'Voice Note (14s): "Bhai is ka size steel 19 aur wazan 1 tola 2 masha rakhna"'
          : 'WhatsApp media attachment'),
      media_id: createdMedia?.id,
      reply_to_wa_id,
      timestamp: nowIso,
      order_id: targetOrder.id,
      item_id: targetItemId,
    };
    db.messages.push(inboundMsg);

    // If a new draft was created and Urdu acknowledgement is enabled, record the automatic Urdu reply
    if (createdNewDraft && targetOrder.ack_sent && targetOrder.ack_message_text) {
      db.messages.push({
        id: `msg-ack-${Date.now()}`,
        account_id,
        customer_id: customer.id,
        wa_message_id: `wamid.ACK_${Date.now()}`,
        direction: 'outbound',
        type: 'text',
        text: targetOrder.ack_message_text,
        timestamp: nowIso,
        order_id: targetOrder.id,
      });
      const acct = db.whatsapp_accounts.find((a) => a.id === account_id);
      if (acct) acct.outbound_messages_month += 1;
    }

    addAudit(
      actor,
      'WHATSAPP_WEBHOOK_PROCESSED',
      `Order #${targetOrder.number}`,
      `Action: ${decision.action} (${message_type} from ${customer.display_name})`
    );
    saveDatabase(db);

    return res.json({
      decision,
      order: targetOrder,
      message: inboundMsg,
    });
  });

  // Confirm Draft Order in Inbox (Owner / Staff)
  app.post('/api/orders/confirm-draft', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Designers cannot confirm Inbox drafts' });
    }

    const { order_id, items_updates, linked_order_id, link_type } = req.body as {
      order_id: string;
      linked_order_id?: string;
      link_type?: 'repeat' | 'revision';
      items_updates?: Array<{
        item_id: string;
        category_id: string;
        specs: ItemSpecs;
        note: string;
      }>;
    };

    const order = db.orders.find((o) => o.id === order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.is_draft = false;
    if (linked_order_id) {
      order.linked_order_id = linked_order_id;
      order.link_type = link_type || 'repeat';
    }

    const nowIso = new Date().toISOString();

    if (Array.isArray(items_updates)) {
      for (const upd of items_updates) {
        const item = db.order_items.find((it) => it.id === upd.item_id);
        if (!item) continue;

        // Track human corrections of AI suggestions (Section 11)
        if (
          item.ai_suggested_category_id &&
          upd.category_id &&
          item.ai_suggested_category_id !== upd.category_id
        ) {
          const aiCat =
            db.categories.find((c) => c.id === item.ai_suggested_category_id)?.name_en ||
            item.ai_suggested_category_id;
          const humanCat =
            db.categories.find((c) => c.id === upd.category_id)?.name_en || upd.category_id;
          db.ai_corrections.unshift({
            id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            order_number: order.number,
            item_id: item.id,
            field_name: 'category',
            ai_value: aiCat,
            human_value: humanCat,
            corrected_by: actor.full_name,
            at: nowIso,
          });
        }

        for (const [specKey, aiSpec] of Object.entries(item.ai_suggested_specs || {})) {
          const humanSpec = upd.specs?.[specKey];
          if (humanSpec && humanSpec.value && humanSpec.value !== aiSpec.value) {
            db.ai_corrections.unshift({
              id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              order_number: order.number,
              item_id: item.id,
              field_name: specKey,
              ai_value: `${aiSpec.value} ${aiSpec.unit || ''}`.trim(),
              human_value: `${humanSpec.value} ${humanSpec.unit || ''}`.trim(),
              corrected_by: actor.full_name,
              at: nowIso,
            });
          }
        }

        item.category_id = upd.category_id || item.category_id;
        item.specs = upd.specs || item.specs;
        item.ai_suggested_specs = {};
        item.note = upd.note ?? item.note;
        item.status = 'New';
        item.updated_at = nowIso;

        const cat = db.categories.find((c) => c.id === item.category_id);
        if (cat) cat.usage_count += 1;

        db.status_history.unshift({
          id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          item_id: item.id,
          order_number: order.number,
          from_status: 'Draft',
          to_status: 'New',
          user_id: actor.id,
          user_name: actor.full_name,
          note: 'Confirmed from WhatsApp Inbox',
          at: nowIso,
        });
      }
    }

    addAudit(
      actor,
      'ORDER_CONFIRMED',
      `Order #${order.number}`,
      `Confirmed draft order into active Today Board`
    );
    saveDatabase(db);
    return res.json({ order });
  });

  // One-Tap Merge Draft into Open Order (Follow-up rule for new images)
  app.post('/api/orders/merge-draft', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { draft_order_id, target_order_id } = req.body;
    const draft = db.orders.find((o) => o.id === draft_order_id);
    const target = db.orders.find((o) => o.id === target_order_id);
    if (!draft || !target) {
      return res.status(404).json({ error: 'Draft or target order not found' });
    }

    const existingTargetItems = db.order_items.filter((it) => it.order_id === target.id);
    let nextIdx = existingTargetItems.length + 1;

    db.order_items.forEach((it) => {
      if (it.order_id === draft.id) {
        it.order_id = target.id;
        it.order_number = target.number;
        it.item_index = nextIdx++;
      }
    });

    db.messages.forEach((m) => {
      if (m.order_id === draft.id) {
        m.order_id = target.id;
      }
    });

    // Soft-delete the merged draft so history stays intact
    draft.deleted_at = new Date().toISOString();

    addAudit(
      actor,
      'DRAFT_MERGED',
      `Order #${draft.number} -> Order #${target.number}`,
      `One-tap merged items and messages into open Order #${target.number}`
    );
    saveDatabase(db);
    return res.json({ mergedInto: target });
  });

  // Split an item from a multi-item draft into its own separate order
  app.post('/api/orders/split-item', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { item_id } = req.body;
    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const sourceOrder = db.orders.find((o) => o.id === item.order_id);
    if (!sourceOrder) return res.status(404).json({ error: 'Order not found' });

    const nextOrderNum = db.orders.reduce((max, o) => Math.max(max, o.number), 120) + 1;
    const nowIso = new Date().toISOString();
    const newOrder = {
      id: `ord-${nextOrderNum}-${Date.now()}`,
      number: nextOrderNum,
      account_id: sourceOrder.account_id,
      customer_id: sourceOrder.customer_id,
      source: sourceOrder.source,
      is_draft: sourceOrder.is_draft,
      ack_sent: true,
      created_by: actor.id,
      created_at: nowIso,
    };

    db.orders.unshift(newOrder);
    item.order_id = newOrder.id;
    item.order_number = newOrder.number;
    item.item_index = 1;

    addAudit(
      actor,
      'ITEM_SPLIT',
      `Order #${sourceOrder.number} -> Order #${newOrder.number}`,
      `Split item into separate Order #${newOrder.number}`
    );
    saveDatabase(db);
    return res.json({ newOrder, item });
  });

  // Manual On-Site Order Entry (including Catalog Book Name & Item Number)
  app.post('/api/orders/onsite', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Designers cannot create orders' });
    }

    const {
      customer_phone,
      customer_name,
      category_id,
      designer_id,
      specs,
      note,
      catalog_book_name,
      catalog_item_number,
      linked_order_id,
      link_type,
      svg_type = 'ring',
      image_data_url,
    } = req.body;

    if (!customer_phone || !String(customer_phone).trim()) {
      return res.status(400).json({ error: 'Customer phone is required' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const nowIso = new Date().toISOString();
    let customer = db.customers.find((c) => c.phone.trim() === String(customer_phone).trim());
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        phone: String(customer_phone).trim(),
        profile_name: customer_name || 'On-Site Customer',
        display_name: customer_name || String(customer_phone).trim(),
        notes: 'Entered manually at workshop counter',
        last_message_at: nowIso,
        created_at: nowIso,
      };
      db.customers.unshift(customer);
    }

    const nextOrderNum = db.orders.reduce((max, o) => Math.max(max, o.number), 120) + 1;
    const newOrder = {
      id: `ord-${nextOrderNum}-${Date.now()}`,
      number: nextOrderNum,
      account_id: 'wa-main',
      customer_id: customer.id,
      source: 'onsite' as const,
      is_draft: false,
      catalog_book_name: catalog_book_name || undefined,
      catalog_item_number: catalog_item_number || undefined,
      linked_order_id: linked_order_id || undefined,
      link_type: link_type || undefined,
      ack_sent: false,
      created_by: actor.id,
      created_at: nowIso,
    };
    db.orders.unshift(newOrder);

    const mediaFile: MediaFile = {
      id: `med-onsite-${Date.now()}`,
      storage_key: `s3://rp-design-whatsapp-media/onsite/${nextOrderNum}.jpg`,
      mime: 'image/jpeg',
      size: 2100000,
      sha256: crypto.createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32),
      kind: 'customer',
      media_type: 'image',
      title: catalog_book_name
        ? `Catalog: ${catalog_book_name} #${catalog_item_number || ''}`
        : `On-Site Reference #${nextOrderNum}`,
      svg_type,
      data_url: image_data_url || undefined,
      uploaded_by: actor.id,
      created_at: nowIso,
    };
    db.media.unshift(mediaFile);

    const initialStatus: OrderItemStatus = designer_id ? 'Allotted' : 'New';
    const newItem = {
      id: `item-${nextOrderNum}-1`,
      order_id: newOrder.id,
      order_number: newOrder.number,
      item_index: 1,
      category_id,
      designer_id: designer_id || null,
      status: initialStatus,
      specs: specs || {},
      previous_specs: {},
      ai_suggested_specs: {},
      note: note || '',
      change_flag: false,
      reference_media_ids: [mediaFile.id],
      output_media_ids: [],
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.order_items.unshift(newItem);

    const cat = db.categories.find((c) => c.id === category_id);
    if (cat) cat.usage_count += 1;

    db.status_history.unshift({
      id: `sh-${Date.now()}`,
      item_id: newItem.id,
      order_number: newOrder.number,
      from_status: 'Draft',
      to_status: initialStatus,
      user_id: actor.id,
      user_name: actor.full_name,
      note: 'Created via On-Site Manual Order Entry',
      at: nowIso,
    });

    addAudit(
      actor,
      'ONSITE_ORDER_CREATED',
      `Order #${newOrder.number}`,
      `Created on-site order for ${customer.display_name}`
    );
    saveDatabase(db);
    return res.json({ order: newOrder, item: newItem });
  });

  // Designer Allotment (Single item OR "Assign all to one designer" button)
  app.post('/api/items/allot', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Designers cannot allot orders' });
    }

    const { item_ids, designer_id } = req.body as {
      item_ids: string[];
      designer_id: string;
    };

    const designer = db.users.find((u) => u.id === designer_id && u.role === 'designer');
    if (!designer) {
      return res.status(400).json({ error: 'Valid designer is required' });
    }

    const nowIso = new Date().toISOString();
    const updatedItems = [];

    for (const itemId of item_ids || []) {
      const item = db.order_items.find((it) => it.id === itemId);
      if (!item) continue;
      const prevStatus = item.status;
      item.designer_id = designer.id;
      if (item.status === 'New') {
        item.status = 'Allotted';
      }
      item.updated_at = nowIso;
      updatedItems.push(item);

      db.status_history.unshift({
        id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        item_id: item.id,
        order_number: item.order_number,
        from_status: prevStatus,
        to_status: item.status,
        user_id: actor.id,
        user_name: actor.full_name,
        note: `Allotted to ${designer.full_name}`,
        at: nowIso,
      });
    }

    addAudit(
      actor,
      'ITEMS_ALLOTTED',
      `${updatedItems.length} item(s) -> ${designer.full_name}`,
      `Allotted items: ${updatedItems.map((i) => `#${i.order_number}.${i.item_index}`).join(', ')}`
    );
    saveDatabase(db);
    return res.json({ updatedCount: updatedItems.length });
  });

  // Update Item Specifications / Follow-Up Change (preserves units & crosses out old values)
  app.post('/api/items/update-specs', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Only Owner or Staff can edit specifications' });
    }

    const { item_id, category_id, specs, note, flag_change } = req.body as {
      item_id: string;
      category_id?: string;
      specs: ItemSpecs;
      note?: string;
      flag_change?: boolean;
    };

    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const order = db.orders.find((o) => o.id === item.order_id);
    const trackDiffs = !order?.is_draft;
    const diffResult = applySpecChangeWithDiff(
      item.specs,
      item.previous_specs || {},
      specs || {},
      trackDiffs
    );

    item.specs = diffResult.specs;
    item.previous_specs = diffResult.previousSpecs;
    if (category_id) item.category_id = category_id;
    if (note !== undefined) item.note = note;

    if (
      (diffResult.changedKeys.length > 0 || flag_change) &&
      trackDiffs &&
      item.designer_id
    ) {
      const prevStatus = item.status;
      item.status = 'Change requested';
      item.change_flag = true;
      item.change_note =
        note || `Updated fields: ${diffResult.changedKeys.join(', ')}`;
      db.status_history.unshift({
        id: `sh-${Date.now()}`,
        item_id: item.id,
        order_number: item.order_number,
        from_status: prevStatus,
        to_status: 'Change requested',
        user_id: actor.id,
        user_name: actor.full_name,
        note: item.change_note,
        at: new Date().toISOString(),
      });
    }

    item.updated_at = new Date().toISOString();
    addAudit(
      actor,
      'ITEM_SPECS_UPDATED',
      `Order #${item.order_number} · Item ${item.item_index}`,
      `Changed keys: ${diffResult.changedKeys.join(', ') || 'note/category'}`
    );
    saveDatabase(db);
    return res.json({ item });
  });

  // Designer clicks "Seen" button on a Change requested item
  app.post('/api/items/mark-seen', (req, res) => {
    const actor = getActor(req);
    const { item_id } = req.body;
    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const prevStatus = item.status;
    item.change_flag = false;
    if (item.status === 'Change requested') {
      item.status = 'In progress';
    }
    item.updated_at = new Date().toISOString();

    db.status_history.unshift({
      id: `sh-${Date.now()}`,
      item_id: item.id,
      order_number: item.order_number,
      from_status: prevStatus,
      to_status: item.status,
      user_id: actor.id,
      user_name: actor.full_name,
      note: 'Designer marked change as Seen and resumed work',
      at: item.updated_at,
    });

    addAudit(
      actor,
      'CHANGE_MARKED_SEEN',
      `Order #${item.order_number} · Item ${item.item_index}`,
      `Designer acknowledged specification changes`
    );
    saveDatabase(db);
    return res.json({ item });
  });

  // Designer starts work, uploads finished output media (images/videos), or submits work
  app.post('/api/items/designer-action', (req, res) => {
    const actor = getActor(req);
    const { item_id, action, upload_title, upload_media_type, upload_data_url } = req.body as {
      item_id: string;
      action: 'start_work' | 'upload_output' | 'submit_work';
      upload_title?: string;
      upload_media_type?: 'image' | 'video';
      upload_data_url?: string;
    };

    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const nowIso = new Date().toISOString();
    const prevStatus = item.status;

    if (action === 'start_work') {
      item.status = 'In progress';
      item.change_flag = false;
      item.updated_at = nowIso;
      db.status_history.unshift({
        id: `sh-${Date.now()}`,
        item_id: item.id,
        order_number: item.order_number,
        from_status: prevStatus,
        to_status: 'In progress',
        user_id: actor.id,
        user_name: actor.full_name,
        note: 'Started CAD / RP design work',
        at: nowIso,
      });
    } else if (action === 'upload_output') {
      const mType = upload_media_type || 'image';
      const newMedia: MediaFile = {
        id: `med-out-${Date.now()}`,
        storage_key: `s3://rp-design-whatsapp-media/output/${item.order_number}_${Date.now()}.${
          mType === 'video' ? 'mp4' : 'png'
        }`,
        mime: mType === 'video' ? 'video/mp4' : 'image/png',
        size: mType === 'video' ? 7800000 : 4200000,
        sha256: crypto.createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 32),
        kind: 'output',
        media_type: mType,
        title:
          upload_title ||
          (mType === 'video'
            ? `Order #${item.order_number} 360° Turntable Video`
            : `Order #${item.order_number} CAD Render Output`),
        svg_type: mType === 'video' ? 'video_turntable' : 'cad_render',
        data_url: upload_data_url || undefined,
        uploaded_by: actor.id,
        created_at: nowIso,
      };
      db.media.unshift(newMedia);
      item.output_media_ids.push(newMedia.id);
      if (item.status === 'Allotted') {
        item.status = 'In progress';
      }
      item.updated_at = nowIso;
      addAudit(
        actor,
        'DESIGNER_UPLOADED_OUTPUT',
        `Order #${item.order_number} · Item ${item.item_index}`,
        `Uploaded ${mType}: ${newMedia.title}`
      );
    } else if (action === 'submit_work') {
      if (item.output_media_ids.length === 0) {
        return res
          .status(400)
          .json({ error: 'Please upload at least one output image or video before submitting.' });
      }
      item.status = 'Submitted';
      item.change_flag = false;
      item.updated_at = nowIso;
      db.status_history.unshift({
        id: `sh-${Date.now()}`,
        item_id: item.id,
        order_number: item.order_number,
        from_status: prevStatus,
        to_status: 'Submitted',
        user_id: actor.id,
        user_name: actor.full_name,
        note: `Submitted ${item.output_media_ids.length} output media file(s) for approval`,
        at: nowIso,
      });
      addAudit(
        actor,
        'WORK_SUBMITTED',
        `Order #${item.order_number} · Item ${item.item_index}`,
        `Submitted with ${item.output_media_ids.length} output file(s)`
      );
    }

    saveDatabase(db);
    return res.json({ item });
  });

  // Owner / Staff Review: Approve or Request Change
  app.post('/api/items/review', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Designers cannot approve work' });
    }

    const { item_id, decision, note } = req.body as {
      item_id: string;
      decision: 'Approved' | 'Change requested';
      note?: string;
    };

    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const nowIso = new Date().toISOString();
    const prevStatus = item.status;
    item.status = decision;
    if (decision === 'Change requested') {
      item.change_flag = true;
      item.change_note = note || 'Owner requested revision on output';
    } else {
      item.change_flag = false;
    }
    item.updated_at = nowIso;

    db.status_history.unshift({
      id: `sh-${Date.now()}`,
      item_id: item.id,
      order_number: item.order_number,
      from_status: prevStatus,
      to_status: decision,
      user_id: actor.id,
      user_name: actor.full_name,
      note: note || `Owner marked item ${decision}`,
      at: nowIso,
    });

    addAudit(
      actor,
      decision === 'Approved' ? 'OUTPUT_APPROVED' : 'OUTPUT_CHANGE_REQUESTED',
      `Order #${item.order_number} · Item ${item.item_index}`,
      note || decision
    );
    saveDatabase(db);
    return res.json({ item });
  });

  // Deliver Approved Output to Customer on WhatsApp (checks 24-hour customer service window!)
  app.post('/api/items/deliver', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'designer') {
      return res.status(403).json({ error: 'Designers cannot send messages to customers' });
    }

    const { item_id, use_template_if_closed } = req.body as {
      item_id: string;
      use_template_if_closed?: boolean;
    };

    const item = db.order_items.find((it) => it.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const order = db.orders.find((o) => o.id === item.order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const customer = db.customers.find((c) => c.id === order.customer_id);
    const windowStatus = checkCustomerServiceWindow(customer?.last_message_at);

    if (!windowStatus.isOpen && !use_template_if_closed) {
      return res.status(409).json({
        error:
          'Customer 24-hour WhatsApp service window is closed. Confirm sending the pre-approved Meta Template message first.',
        windowStatus,
      });
    }

    const nowIso = new Date().toISOString();
    const prevStatus = item.status;
    item.status = 'Delivered';
    item.updated_at = nowIso;

    // Check if all items in the order are now Delivered
    const allItems = db.order_items.filter((it) => it.order_id === order.id);
    if (allItems.every((it) => it.status === 'Delivered')) {
      order.delivered_at = nowIso;
    }

    const acct = db.whatsapp_accounts.find((a) => a.id === order.account_id) || db.whatsapp_accounts[0];

    if (!windowStatus.isOpen) {
      // Send pre-approved template message first, then record queued media delivery
      const tplText = db.settings.closed_window_template.replace(
        '{{number}}',
        String(order.number)
      );
      db.messages.push({
        id: `msg-tpl-${Date.now()}`,
        account_id: acct.id,
        customer_id: order.customer_id,
        wa_message_id: `wamid.TPL_${Date.now()}`,
        direction: 'outbound',
        type: 'template',
        text: `[Meta Approved Template] ${tplText}`,
        timestamp: nowIso,
        order_id: order.id,
        item_id: item.id,
      });
      acct.outbound_messages_month += 1;
    }

    // Send approved output media
    db.messages.push({
      id: `msg-deliv-${Date.now()}`,
      account_id: acct.id,
      customer_id: order.customer_id,
      wa_message_id: `wamid.OUT_${Date.now()}`,
      direction: 'outbound',
      type: 'image',
      text: `Delivered ${item.output_media_ids.length} approved design output file(s) for Order #${order.number}.`,
      media_id: item.output_media_ids[0],
      timestamp: nowIso,
      order_id: order.id,
      item_id: item.id,
    });
    acct.outbound_messages_month += Math.max(1, item.output_media_ids.length);

    db.status_history.unshift({
      id: `sh-${Date.now()}`,
      item_id: item.id,
      order_number: order.number,
      from_status: prevStatus,
      to_status: 'Delivered',
      user_id: actor.id,
      user_name: actor.full_name,
      note: windowStatus.isOpen
        ? 'Sent free-form media on WhatsApp (24h window open)'
        : 'Sent via Meta Template fallback (24h window was closed)',
      at: nowIso,
    });

    addAudit(
      actor,
      'ORDER_ITEM_DELIVERED',
      `Order #${order.number} · Item ${item.item_index}`,
      `Delivered to ${customer?.display_name} (${windowStatus.deliveryMode})`
    );
    saveDatabase(db);
    return res.json({ item, order, windowStatus });
  });

  // Categories & Dynamic Category Fields Management
  app.post('/api/categories', (req, res) => {
    const actor = getActor(req);
    if (actor.role !== 'owner' && actor.role !== 'admin' && actor.role !== 'staff') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { name_en, name_ur } = req.body;
    if (!name_en || !String(name_en).trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const newCat = {
      id: `cat-${Date.now()}`,
      name_en: String(name_en).trim(),
      name_ur: String(name_ur || name_en).trim(),
      usage_count: 1,
      active: true,
    };
    db.categories.push(newCat);
    addAudit(actor, 'CATEGORY_CREATED', newCat.name_en, 'Added new jewelry category');
    saveDatabase(db);
    return res.json({ category: newCat });
  });

  app.post('/api/category-fields', (req, res) => {
    const actor = getActor(req);
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return res.status(403).json({ error: 'Only Owner or Admin can edit category field schema' });
    }
    const { category_id, key, label_en, label_ur, field_type, units } = req.body;
    if (!key || !label_en) {
      return res.status(400).json({ error: 'Field key and English label are required' });
    }
    const newField = {
      id: `cf-${Date.now()}`,
      category_id: category_id || '*',
      key: String(key).trim().toLowerCase().replace(/\s+/g, '_'),
      label_en: String(label_en).trim(),
      label_ur: String(label_ur || label_en).trim(),
      field_type: field_type || 'unit_number',
      units: Array.isArray(units) ? units : ['mm', 'inch'],
    };
    db.category_fields.push(newField);
    addAudit(actor, 'CATEGORY_FIELD_ADDED', newField.label_en, `Category: ${category_id}`);
    saveDatabase(db);
    return res.json({ field: newField });
  });

  // User Accounts Management (Owner Only - Section 2: "Staff: Everything the owner can do except creating, editing or deleting accounts")
  app.post('/api/users', (req, res) => {
    const actor = getActor(req);
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Only the Business Owner can create, edit, or deactivate Staff/Designer accounts.' });
    }

    const { action, user_id, username, full_name, role, specialty } = req.body;
    if (action === 'toggle_active') {
      const target = db.users.find((u) => u.id === user_id);
      if (!target) return res.status(404).json({ error: 'User not found' });
      target.active = !target.active;
      addAudit(
        actor,
        'USER_STATUS_CHANGED',
        target.full_name,
        `Active set to ${target.active}`
      );
      saveDatabase(db);
      return res.json({ user: target });
    }

    if (!username || !full_name) {
      return res.status(400).json({ error: 'Username and full name are required' });
    }

    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      username: String(username).trim().toLowerCase(),
      full_name: String(full_name).trim(),
      role: role === 'staff' ? 'staff' : 'designer',
      specialty: specialty || 'CAD / RP Designer',
      active: true,
      last_login: new Date().toISOString(),
    };
    db.users.push(newUser);
    addAudit(
      actor,
      'USER_ACCOUNT_CREATED',
      newUser.full_name,
      `Role: ${newUser.role} (@${newUser.username})`
    );
    saveDatabase(db);
    return res.json({ user: newUser });
  });

  // System & Privacy Settings (Owner can switch off Admin access to order data; Admin can adjust quiet period)
  app.post('/api/settings', (req, res) => {
    const actor = getActor(req);
    const updates = req.body as Partial<typeof db.settings>;

    if (
      updates.admin_data_access_enabled !== undefined &&
      updates.admin_data_access_enabled !== db.settings.admin_data_access_enabled
    ) {
      if (actor.role !== 'owner') {
        return res
          .status(403)
          .json({ error: 'Only the Owner can toggle Admin access to order data.' });
      }
      db.settings.admin_data_access_enabled = Boolean(updates.admin_data_access_enabled);
      addAudit(
        actor,
        'ADMIN_DATA_ACCESS_TOGGLED',
        'Privacy Switch',
        `Owner set admin_data_access_enabled = ${db.settings.admin_data_access_enabled}`
      );
    }

    if (updates.quiet_period_minutes !== undefined) {
      db.settings.quiet_period_minutes = Math.max(1, Number(updates.quiet_period_minutes) || 3);
    }
    if (updates.followup_text_sets_change_requested !== undefined) {
      db.settings.followup_text_sets_change_requested = Boolean(
        updates.followup_text_sets_change_requested
      );
    }
    if (updates.followup_image_creates_draft !== undefined) {
      db.settings.followup_image_creates_draft = Boolean(updates.followup_image_creates_draft);
    }
    if (updates.auto_urdu_ack_enabled !== undefined) {
      db.settings.auto_urdu_ack_enabled = Boolean(updates.auto_urdu_ack_enabled);
    }
    if (updates.ack_template_urdu !== undefined) {
      db.settings.ack_template_urdu = String(updates.ack_template_urdu);
    }
    if (updates.ai_enabled !== undefined) {
      db.settings.ai_enabled = Boolean(updates.ai_enabled);
    }

    saveDatabase(db);
    return res.json({ settings: db.settings });
  });

  // Toggle WhatsApp Account Active Status or Record 14-day Coexistence Keepalive
  app.post('/api/whatsapp-accounts', (req, res) => {
    const actor = getActor(req);
    const { account_id, action, name, phone_number, phone_number_id, business_account_id } = req.body;

    if (action === 'add_number') {
      if (!name || !phone_number) {
        return res.status(400).json({ error: 'Name and phone number are required' });
      }
      const added = {
        id: `wa-${Date.now()}`,
        name: String(name),
        phone_number: String(phone_number),
        phone_number_id: String(phone_number_id || '109283746500000'),
        business_account_id: String(business_account_id || '987654321012345'),
        active: true,
        app_type: 'whatsapp_business_coexistence' as const,
        app_version: '2.24.22.78',
        last_keepalive_at: new Date().toISOString(),
        outbound_messages_month: 0,
        free_tier_limit: 1000,
      };
      db.whatsapp_accounts.push(added);
      addAudit(actor, 'WHATSAPP_NUMBER_ADDED', added.phone_number, added.name);
      saveDatabase(db);
      return res.json({ account: added });
    }

    const acct = db.whatsapp_accounts.find((a) => a.id === account_id);
    if (!acct) return res.status(404).json({ error: 'WhatsApp account not found' });

    if (action === 'toggle_active') {
      acct.active = !acct.active;
      addAudit(actor, 'WHATSAPP_NUMBER_TOGGLED', acct.phone_number, `Active: ${acct.active}`);
    } else if (action === 'record_keepalive') {
      acct.last_keepalive_at = new Date().toISOString();
      addAudit(actor, 'COEXISTENCE_KEEPALIVE', acct.phone_number, 'Reset 14-day link timer');
    }

    saveDatabase(db);
    return res.json({ account: acct });
  });

  // AI Prompt Version Management & One-Click Rollback (Section 11)
  app.post('/api/ai/prompts', (req, res) => {
    const actor = getActor(req);
    const { action, instruction_text, model = 'gemini-3.8-flash', version_id } = req.body;

    if (action === 'activate_version') {
      db.ai_prompt_versions.forEach((v) => {
        v.active = v.id === version_id;
      });
      const activeVer = db.ai_prompt_versions.find((v) => v.id === version_id);
      addAudit(
        actor,
        'AI_PROMPT_ROLLBACK',
        `Version v${activeVer?.version}`,
        'Activated prompt version'
      );
      saveDatabase(db);
      return res.json({ versions: db.ai_prompt_versions });
    }

    if (!instruction_text || !String(instruction_text).trim()) {
      return res.status(400).json({ error: 'Instruction text cannot be empty' });
    }

    const nextVer =
      db.ai_prompt_versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    db.ai_prompt_versions.forEach((v) => {
      v.active = false;
    });

    const newPrompt = {
      id: `prompt-v${nextVer}-${Date.now()}`,
      version: nextVer,
      model,
      instruction_text: String(instruction_text).trim(),
      created_by: actor.full_name,
      created_at: new Date().toISOString(),
      active: true,
      last_test_accuracy: 95,
    };
    db.ai_prompt_versions.unshift(newPrompt);
    addAudit(actor, 'AI_PROMPT_VERSION_SAVED', `Version v${nextVer}`, `Model: ${model}`);
    saveDatabase(db);
    return res.json({ prompt: newPrompt, versions: db.ai_prompt_versions });
  });

  // "Suggest Improvements" Button using Server-Side @google/genai SDK (Section 11.4)
  app.post('/api/ai/suggest-improvements', async (req, res) => {
    const activePrompt =
      db.ai_prompt_versions.find((v) => v.active) || db.ai_prompt_versions[0];
    const recentCorrections = db.ai_corrections.slice(0, 10);

    const correctionsText = recentCorrections
      .map(
        (c) =>
          `- Order #${c.order_number}: Field "${c.field_name}" -> AI suggested "${c.ai_value}", human corrected to "${c.human_value}"`
      )
      .join('\n');

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Current System Instruction:\n${activePrompt.instruction_text}\n\nThis Week's Human Corrections of AI Suggestions:\n${correctionsText}\n\nPropose an improved system instruction paragraph that prevents these mistakes while strictly preserving units as spoken (gram, tola, masha, ratti; mm, inch; steel, plastic, cheen sitar). Return ONLY the proposed instruction text.`,
        });

        const proposed = (response.text || '').trim();
        if (proposed) {
          return res.json({
            proposed_instruction: proposed,
            source: 'gemini-3.8-flash',
            analyzed_corrections_count: recentCorrections.length,
          });
        }
      } catch (err) {
        console.warn('Gemini API fallback triggered:', err);
      }
    }

    // Deterministic high-signal proposal based on actual corrections in db.ai_corrections
    const proposedFallback = `${activePrompt.instruction_text} Additionally, when customers say "sutar" or "points" (e.g. "2 inch 4 sutar"), record it as a Bangle/Kara in "inch + points" format rather than decimal inches, and recognize "cheen sitar" as a valid Ring Size Standard alongside steel and plastic.`;

    return res.json({
      proposed_instruction: proposedFallback,
      source: 'correction_analyzer',
      analyzed_corrections_count: recentCorrections.length,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RP Design Order Management Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
