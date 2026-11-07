import React, { useState } from 'react';
import {
  Check,
  GitMerge,
  Split,
  Plus,
  Sparkles,
  AlertTriangle,
  Send,
  MessageSquarePlus,
  Volume2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Category,
  CategoryFieldDefinition,
  Customer,
  ItemSpecs,
  MediaFile,
  Order,
  OrderItem,
  WhatsAppMessage,
} from '../types';
import { Lang, t } from '../i18n/translations';
import { JewelryArtCard, VoiceNotePlayer } from './JewelryVisuals';

interface InboxProps {
  lang: Lang;
  orders: Order[];
  orderItems: OrderItem[];
  customers: Customer[];
  categories: Category[];
  categoryFields: CategoryFieldDefinition[];
  media: MediaFile[];
  messages: WhatsAppMessage[];
  quietPeriodMinutes: number;
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}

export const InboxAndSimulatorView: React.FC<InboxProps> = ({
  lang,
  orders,
  orderItems,
  customers,
  categories,
  categoryFields,
  media,
  messages,
  quietPeriodMinutes,
  onRefresh,
  apiPost,
}) => {
  const draftOrders = orders.filter((o) => o.is_draft && !o.deleted_at);
  const openOrders = orders.filter((o) => !o.is_draft && !o.deleted_at && !o.delivered_at);

  // Local state for editing draft items before confirmation
  const [itemEdits, setItemEdits] = useState<
    Record<string, { category_id: string; specs: ItemSpecs; note: string }>
  >({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showSimulator, setShowSimulator] = useState(false);

  // Simulator state
  const [simPhone, setSimPhone] = useState('+92 300 4128900');
  const [simName, setSimName] = useState('Sheikh Waqas (Al-Madina Sarafa)');
  const [simType, setSimType] = useState<'image' | 'audio' | 'text'>('image');
  const [simSvg, setSimSvg] = useState<'ring' | 'bangle' | 'earrings' | 'necklace'>('ring');
  const [simText, setSimText] = useState(
    'Bhai yeh gent ring bana den weight 1.5 tola aur steel size 20'
  );
  const [simStatusMsg, setSimStatusMsg] = useState<string | null>(null);

  const sortedCategories = [...categories].sort((a, b) => b.usage_count - a.usage_count);

  const getEditState = (item: OrderItem) => {
    if (itemEdits[item.id]) return itemEdits[item.id];
    return {
      category_id: item.category_id,
      specs: { ...item.specs },
      note: item.note || '',
    };
  };

  const updateItemSpec = (
    item: OrderItem,
    key: string,
    value: string,
    unit?: string
  ) => {
    const current = getEditState(item);
    const nextSpecs: ItemSpecs = {
      ...current.specs,
      [key]: {
        value,
        ...(unit ? { unit } : current.specs[key]?.unit ? { unit: current.specs[key]?.unit } : {}),
      },
    };
    setItemEdits((prev) => ({
      ...prev,
      [item.id]: {
        ...current,
        specs: nextSpecs,
      },
    }));
  };

  const acceptAiSuggestion = (item: OrderItem, key: string) => {
    const aiVal = item.ai_suggested_specs?.[key];
    if (!aiVal) return;
    updateItemSpec(item, key, aiVal.value, aiVal.unit);
  };

  const handleConfirmDraft = async (order: Order) => {
    const items = orderItems.filter((it) => it.order_id === order.id);
    const items_updates = items.map((it) => {
      const ed = getEditState(it);
      return {
        item_id: it.id,
        category_id: ed.category_id,
        specs: ed.specs,
        note: ed.note,
      };
    });
    await apiPost('/api/orders/confirm-draft', {
      order_id: order.id,
      items_updates,
    });
    onRefresh();
  };

  const handleMergeDraft = async (draftId: string, targetOrderId: string) => {
    await apiPost('/api/orders/merge-draft', {
      draft_order_id: draftId,
      target_order_id: targetOrderId,
    });
    onRefresh();
  };

  const handleSplitItem = async (itemId: string) => {
    await apiPost('/api/orders/split-item', { item_id: itemId });
    onRefresh();
  };

  const handleAddCategorySpot = async () => {
    if (!newCategoryName.trim()) return;
    await apiPost('/api/categories', {
      name_en: newCategoryName.trim(),
      name_ur: newCategoryName.trim(),
    });
    setNewCategoryName('');
    onRefresh();
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = (await apiPost('/api/whatsapp/simulate', {
      customer_phone: simPhone,
      customer_name: simName,
      message_type: simType,
      svg_type: simSvg,
      text: simText,
      ai_suggested_category_id:
        simSvg === 'bangle'
          ? 'cat-bangle'
          : simSvg === 'earrings'
          ? 'cat-earrings'
          : simSvg === 'necklace'
          ? 'cat-necklace'
          : 'cat-ring',
      ai_suggested_specs:
        simSvg === 'bangle'
          ? {
              weight: { value: '2.25', unit: 'tola' },
              bangle_size: { value: '2 inch 4 points', unit: 'inch + points' },
            }
          : {
              weight: { value: '1.5', unit: 'tola' },
              ring_standard: { value: 'steel' },
              ring_size_number: { value: '20' },
              thawa_size: { value: '14', unit: 'mm' },
            },
    })) as { decision?: { action: string }; order?: { number: number } };

    if (res?.decision) {
      setSimStatusMsg(
        `Webhook processed -> ${res.decision.action.replace(/_/g, ' ')} (Order #${
          res.order?.number
        })`
      );
    }
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Quiet period explanation + Simulate Incoming WhatsApp Message button */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'inbox')} · <span className="font-mono-num">{draftOrders.length}</span>
          </h2>
          <p className="text-xs text-slate-600">
            {lang === 'ur' ? (
              <>
                ایک ہی کسٹمر کے <span className="font-mono-num font-semibold text-slate-900">{quietPeriodMinutes} منٹ</span> کے اندر آنے والے واٹس ایپ پیغامات ایک ہی ڈرافٹ آرڈر میں جمع ہوتے ہیں اور ایک خودکار اردو تصدیقی پیغام بھیجا جاتا ہے۔
              </>
            ) : (
              <>
                Incoming WhatsApp messages from the same customer within{' '}
                <span className="font-mono-num font-semibold text-slate-900">
                  {quietPeriodMinutes} minutes
                </span>{' '}
                group into one draft order. One Urdu acknowledgement is sent per group.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquarePlus className="h-4 w-4 text-emerald-600" />
            {t(lang, 'simulateWhatsapp')}
          </button>
        </div>
      </div>

      {/* Live WhatsApp Webhook Simulator Panel */}
      {showSimulator && (
        <form
          onSubmit={handleSimulateWebhook}
          className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                WhatsApp Cloud API Incoming Webhook Simulator
              </h3>
              <p className="text-xs text-slate-600">
                Test the 3-minute quiet period grouping, follow-up rules on open orders, and
                automatic Urdu acknowledgement reply.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSimPhone('+92 300 4128900');
                  setSimName('Sheikh Waqas (Al-Madina Sarafa)');
                  setSimType('audio');
                  setSimText(
                    'Voice Note: "Haji sahib gent ring ka thawa 15 mm rakhna aur wazan 8.5 gram"'
                  );
                }}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Preset 1: Voice Note on Draft #128
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimPhone('+92 333 9104455');
                  setSimName('Malik Asad (Zainab Zewar)');
                  setSimType('text');
                  setSimText('Bhai Order #126 mein chori ki chaurai thori kam rakhna please');
                }}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Preset 2: Follow-up Text on Open Order #126 (Flags Change Requested)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimPhone('+92 333 9104455');
                  setSimName('Malik Asad (Zainab Zewar)');
                  setSimType('image');
                  setSimSvg('bangle');
                  setSimText('Yeh ek aur kara design اسی آرڈر میں شامل کر دیں');
                }}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Preset 3: New Image on Open Order #126 (Creates Draft + One-Tap Merge)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer WhatsApp Phone
              </label>
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer Profile Name
              </label>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message Type</label>
              <select
                value={simType}
                onChange={(e) => setSimType(e.target.value as 'image' | 'audio' | 'text')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
              >
                <option value="image">Image (Creates Item)</option>
                <option value="audio">Voice Note (Ogg Opus -&gt; AAC)</option>
                <option value="text">Text Message</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jewelry Photo Preset
              </label>
              <select
                value={simSvg}
                onChange={(e) =>
                  setSimSvg(e.target.value as 'ring' | 'bangle' | 'earrings' | 'necklace')
                }
                disabled={simType !== 'image'}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <option value="ring">Gent / Ladies Ring</option>
                <option value="bangle">Jali Bangle / Kara</option>
                <option value="earrings">Jhumka Earrings</option>
                <option value="necklace">Locket / Necklace</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              placeholder="Customer message caption or voice transcript..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Fire Incoming Webhook
            </button>
          </div>

          {simStatusMsg && (
            <div className="text-xs font-medium text-emerald-800">{simStatusMsg}</div>
          )}
        </form>
      )}

      {/* Quick Add Category Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">
            {lang === 'ur' ? 'سب سے زیادہ استعمال ہونے والی کیٹیگریز:' : 'Most-Used Categories:'}
          </span>{' '}
          {sortedCategories.map((c, idx) => (
            <React.Fragment key={c.id}>
              {idx > 0 && <span className="mx-1.5 text-slate-300">·</span>}
              <span>
                {lang === 'ur' ? c.name_ur : c.name_en}{' '}
                <span className="font-mono-num text-slate-400">({c.usage_count})</span>
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={lang === 'ur' ? 'نئی کیٹیگری شامل کریں...' : 'Add new category on the spot...'}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleAddCategorySpot}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === 'ur' ? 'کیٹیگری شامل کریں' : 'Add Category'}
          </button>
        </div>
      </div>

      {/* Draft Orders List */}
      {draftOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            Inbox is clear — all WhatsApp drafts have been confirmed.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Click &ldquo;{t(lang, 'simulateWhatsapp')}&rdquo; above to test an incoming customer
            order with photos and voice notes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {draftOrders.map((order) => {
            const customer = customers.find((c) => c.id === order.customer_id);
            const items = orderItems.filter((it) => it.order_id === order.id);
            const orderMessages = messages.filter((m) => m.order_id === order.id);
            const mergeTarget =
              order.mergeable_into_order_id
                ? orders.find((o) => o.id === order.mergeable_into_order_id)
                : openOrders.find((o) => o.customer_id === order.customer_id);

            return (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
              >
                {/* Draft Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span dir="ltr" className="font-mono-num font-bold text-slate-900 text-base">
                        Draft Order #{order.number}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-800">
                        {customer?.display_name}
                      </span>
                      <span>·</span>
                      <span dir="ltr" className="font-mono-num text-slate-600">
                        {customer?.phone}
                      </span>
                      <span>·</span>
                      <span dir="ltr">{items.length} item(s) grouped</span>
                    </div>
                    {order.ack_sent && order.ack_message_text && (
                      <p className="text-xs text-emerald-700">
                        Auto Urdu Ack sent once:{' '}
                        <span className="urdu-text font-medium" dir="rtl">
                          {order.ack_message_text}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {mergeTarget && (
                      <button
                        type="button"
                        onClick={() => handleMergeDraft(order.id, mergeTarget.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                        {t(lang, 'mergeIntoOpen')} (#{mergeTarget.number})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleConfirmDraft(order)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Check className="h-4 w-4" />
                      {t(lang, 'confirmOrder')} #{order.number}
                    </button>
                  </div>
                </div>

                {/* Customer Messages & Voice Notes Thread */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700">
                    {t(lang, 'customerMessagesVoice')}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {orderMessages.map((msg) => {
                      if (msg.type === 'audio') {
                        return (
                          <VoiceNotePlayer
                            key={msg.id}
                            durationSec={16}
                            transcriptPreview={msg.text}
                            timestamp={msg.timestamp}
                            replyToLabel={
                              msg.reply_to_wa_id ? 'Item #1 Reference Photo' : undefined
                            }
                          />
                        );
                      }
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-lg border p-3 text-xs ${
                            msg.direction === 'outbound'
                              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                              : 'border-slate-200 bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-medium">
                              {msg.direction === 'outbound'
                                ? 'Automatic Urdu Ack (Outbound)'
                                : `${customer?.display_name} (WhatsApp)`}
                            </span>
                            <span className="font-mono-num">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p dir="auto" className="font-medium leading-relaxed">
                            {msg.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items in this Draft Order */}
                <div className="space-y-4">
                  {items.map((item) => {
                    const edit = getEditState(item);
                    const refMedia = media.filter((m) =>
                      item.reference_media_ids.includes(m.id)
                    );
                    const applicableFields = categoryFields.filter(
                      (cf) => cf.category_id === '*' || cf.category_id === edit.category_id
                    );

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono-num font-semibold text-slate-900">
                              Item #{order.number}.{item.item_index}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600">
                              Select category &amp; fill optional specs (units never auto-convert)
                            </span>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleSplitItem(item.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                            >
                              <Split className="h-3.5 w-3.5" />
                              {t(lang, 'splitItem')}
                            </button>
                          )}
                        </div>

                        {/* Phase 3 Repeat-Order CLIP Similarity Warning */}
                        {item.similar_order_warning && (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Repeat-Order Similarity Alert:</strong>{' '}
                              {item.similar_order_warning.summary}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                          {/* Left: Reference Media */}
                          <div className="lg:col-span-4 space-y-2">
                            {refMedia.map((m) => (
                              <JewelryArtCard key={m.id} media={m} />
                            ))}
                          </div>

                          {/* Right: Category & Dynamic Fields */}
                          <div className="lg:col-span-8 space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Category (Most-used first)
                                </label>
                                <select
                                  value={edit.category_id}
                                  onChange={(e) =>
                                    setItemEdits((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...edit,
                                        category_id: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                                >
                                  {sortedCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {lang === 'ur' ? c.name_ur : c.name_en} ({c.usage_count})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  {t(lang, 'freeTextNoteLabel')}
                                </label>
                                <input
                                  type="text"
                                  value={edit.note}
                                  onChange={(e) =>
                                    setItemEdits((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...edit,
                                        note: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Optional note for designer..."
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                                />
                              </div>
                            </div>

                            {/* Dynamic Category Fields Grid */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {applicableFields.map((field) => {
                                const currentSpec = edit.specs[field.key];
                                const aiSuggested = item.ai_suggested_specs?.[field.key];
                                const hasAiUnconfirmed =
                                  aiSuggested &&
                                  (!currentSpec || !currentSpec.value) &&
                                  aiSuggested.value;

                                return (
                                  <div
                                    key={field.id}
                                    className={`rounded-lg border p-2.5 ${
                                      hasAiUnconfirmed
                                        ? 'border-amber-300 bg-amber-50/70'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <label className="text-[11px] font-semibold text-slate-700">
                                        {lang === 'ur' ? field.label_ur : field.label_en}
                                      </label>
                                      {hasAiUnconfirmed && (
                                        <button
                                          type="button"
                                          onClick={() => acceptAiSuggestion(item, field.key)}
                                          className="inline-flex items-center gap-1 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-300"
                                          title="AI suggested from voice note — tap to confirm"
                                        >
                                          <Sparkles className="h-2.5 w-2.5" />
                                          Tap Confirm: {aiSuggested.value}{' '}
                                          {aiSuggested.unit || ''}
                                        </button>
                                      )}
                                    </div>

                                    {field.field_type === 'select' ? (
                                      <select
                                        value={currentSpec?.value || ''}
                                        onChange={(e) =>
                                          updateItemSpec(item, field.key, e.target.value)
                                        }
                                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                                      >
                                        <option value="">— Optional —</option>
                                        {(field.options || []).map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={currentSpec?.value || ''}
                                          onChange={(e) =>
                                            updateItemSpec(
                                              item,
                                              field.key,
                                              e.target.value,
                                              currentSpec?.unit || field.units?.[0]
                                            )
                                          }
                                          placeholder={
                                            hasAiUnconfirmed
                                              ? `Suggested: ${aiSuggested.value}`
                                              : field.placeholder || 'Optional'
                                          }
                                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono-num"
                                        />
                                        {field.units && field.units.length > 0 && (
                                          <select
                                            value={currentSpec?.unit || field.units[0]}
                                            onChange={(e) =>
                                              updateItemSpec(
                                                item,
                                                field.key,
                                                currentSpec?.value || '',
                                                e.target.value
                                              )
                                            }
                                            aria-label={`${field.label_en} unit`}
                                            className="rounded border border-slate-300 bg-slate-50 px-1.5 py-1.5 text-xs font-medium text-slate-800 shrink-0"
                                          >
                                            {field.units.map((u) => (
                                              <option key={u} value={u}>
                                                {u}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
