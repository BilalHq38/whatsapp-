import React, { useState } from 'react';
import {
  CheckCircle2,
  Upload,
  Send,
  AlertTriangle,
  Play,
  X,
  RotateCcw,
  Lock,
  Film,
  Image as ImageIcon,
  Clock,
} from 'lucide-react';
import {
  Category,
  CategoryFieldDefinition,
  Customer,
  ItemSpecs,
  MediaFile,
  Order,
  OrderItem,
  StatusHistoryEntry,
  UserAccount,
  WhatsAppMessage,
} from '../types';
import { Lang, statusLabel, t } from '../i18n/translations';
import { JewelryArtCard, VoiceNotePlayer } from './JewelryVisuals';
import { checkCustomerServiceWindow } from '../utils/orderRules';

export const DesignerMyWorkView: React.FC<{
  lang: Lang;
  actor: UserAccount;
  orderItems: OrderItem[];
  categories: Category[];
  categoryFields: CategoryFieldDefinition[];
  media: MediaFile[];
  messages: WhatsAppMessage[];
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({
  lang,
  actor,
  orderItems,
  categories,
  categoryFields,
  media,
  messages,
  onRefresh,
  apiPost,
}) => {
  // Sort so items with newest changes (change_flag === true or status === 'Change requested') appear highlighted at top
  const myItems = [...orderItems]
    .filter((it) => it.designer_id === actor.id)
    .sort((a, b) => {
      if (a.change_flag && !b.change_flag) return -1;
      if (!a.change_flag && b.change_flag) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const [selectedItemId, setSelectedItemId] = useState<string>(myItems[0]?.id || '');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadMediaType, setUploadMediaType] = useState<'image' | 'video'>('image');
  const [actionError, setActionError] = useState<string | null>(null);

  const activeItem = myItems.find((it) => it.id === selectedItemId) || myItems[0];

  const getFieldLabel = (key: string) => {
    const def = categoryFields.find((f) => f.key === key);
    if (!def) return key;
    return lang === 'ur' ? def.label_ur : def.label_en;
  };

  const handleMarkSeen = async (itemId: string) => {
    setActionError(null);
    await apiPost('/api/items/mark-seen', { item_id: itemId });
    onRefresh();
  };

  const handleDesignerAction = async (
    itemId: string,
    action: 'start_work' | 'upload_output' | 'submit_work'
  ) => {
    setActionError(null);
    try {
      await apiPost('/api/items/designer-action', {
        item_id: itemId,
        action,
        upload_title: uploadTitle.trim() || undefined,
        upload_media_type: uploadMediaType,
      });
      setUploadTitle('');
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Designer Header with Customer Phone Protection Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'myWork')} — {actor.full_name}
          </h2>
          <p className="text-xs text-slate-600">
            {actor.specialty} · Showing only orders allotted to you. Newest changes are highlighted
            first.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Lock className="h-3.5 w-3.5 text-emerald-700" />
          <span>{t(lang, 'customerPhoneProtected')}</span>
        </div>
      </div>

      {myItems.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
          No items are currently allotted to {actor.full_name}. Switch to another designer or allot
          work from the Owner panel.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Allotted Items List */}
          <div className="lg:col-span-4 space-y-2.5">
            {myItems.map((it) => {
              const cat = categories.find((c) => c.id === it.category_id);
              const isSelected = activeItem?.id === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedItemId(it.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-slate-900 bg-white shadow-sm'
                      : it.change_flag || it.status === 'Change requested'
                      ? 'border-rose-300 bg-rose-50/60 hover:bg-rose-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-sm font-bold text-slate-900">
                      Order #{it.order_number}.{it.item_index}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        it.status === 'Change requested'
                          ? 'text-rose-700'
                          : it.status === 'Submitted'
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {statusLabel(lang, it.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    {lang === 'ur' ? cat?.name_ur : cat?.name_en}
                  </div>
                  {it.change_flag && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Change requested — review crossed-out values &amp; tap Seen
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Column: Designer Item Screen (Strict Top-to-Bottom Order from Section 4) */}
          {activeItem && (
            <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              {/* Top Action Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-num text-lg font-bold text-slate-900">
                      Order #{activeItem.order_number} · Item {activeItem.item_index}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-slate-800">
                      {
                        categories.find((c) => c.id === activeItem.category_id)?.[
                          lang === 'ur' ? 'name_ur' : 'name_en'
                        ]
                      }
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-slate-900">
                      {statusLabel(lang, activeItem.status)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(activeItem.change_flag || activeItem.status === 'Change requested') && (
                    <button
                      type="button"
                      onClick={() => handleMarkSeen(activeItem.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t(lang, 'markChangeSeen')}
                    </button>
                  )}

                  {activeItem.status === 'Allotted' && (
                    <button
                      type="button"
                      onClick={() => handleDesignerAction(activeItem.id, 'start_work')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {t(lang, 'startWork')}
                    </button>
                  )}

                  {activeItem.status !== 'Submitted' && activeItem.status !== 'Delivered' && (
                    <button
                      type="button"
                      onClick={() => handleDesignerAction(activeItem.id, 'submit_work')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t(lang, 'submitWork')}
                    </button>
                  )}
                </div>
              </div>

              {actionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                  {actionError}
                </div>
              )}

              {/* Change Requested Banner */}
              {(activeItem.change_flag || activeItem.status === 'Change requested') && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-1">
                  <div className="text-xs font-bold text-rose-900">
                    Change Requested — Old values are crossed out beside the new ones below
                  </div>
                  {activeItem.change_note && (
                    <p className="text-xs text-rose-800">{activeItem.change_note}</p>
                  )}
                </div>
              )}

              {/* SECTION 4.1: "1. The detail fields that were filled in, in large text. Empty fields are hidden." */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    1. {t(lang, 'filledSpecsHeader')}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {t(lang, 'emptyFieldsHiddenNote')}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(activeItem.specs)
                    .filter(([, val]) => val && val.value && val.value.trim() !== '')
                    .map(([key, val]) => {
                      const prevVal = activeItem.previous_specs?.[key];
                      const showUnit =
                        val.unit &&
                        val.unit !== 'inch + points' &&
                        !val.value.toLowerCase().includes(val.unit.toLowerCase());
                      const showPrevUnit =
                        prevVal?.unit &&
                        prevVal.unit !== 'inch + points' &&
                        !prevVal.value.toLowerCase().includes(prevVal.unit.toLowerCase());
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <div className="text-xs font-medium text-slate-500">
                            {getFieldLabel(key)}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1 flex flex-wrap items-baseline gap-2 font-mono-num"
                          >
                            {prevVal?.value && (
                              <span className="text-base text-rose-600 line-through">
                                {prevVal.value} {showPrevUnit ? prevVal.unit : ''}
                              </span>
                            )}
                            <span className="text-2xl font-bold text-slate-900">
                              {val.value}{' '}
                              {showUnit && (
                                <span className="text-base font-semibold text-slate-700">
                                  {val.unit}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {activeItem.note && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-500">
                      {t(lang, 'freeTextNoteLabel')}
                    </div>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{activeItem.note}</p>
                  </div>
                )}
              </div>

              {/* SECTION 4.2: "2. Images and videos." (Reference + Designer Output Upload) */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h3 className="text-xs font-semibold text-slate-700">
                  2. {t(lang, 'referenceMedia')} &amp; {t(lang, 'designerOutputMedia')}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-600">
                      Customer Reference Media ({activeItem.reference_media_ids.length})
                    </div>
                    {media
                      .filter((m) => activeItem.reference_media_ids.includes(m.id))
                      .map((m) => (
                        <JewelryArtCard key={m.id} media={m} />
                      ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-600">
                      Uploaded Designer Outputs ({activeItem.output_media_ids.length})
                    </div>
                    {activeItem.output_media_ids.length === 0 ? (
                      <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                        No output uploaded yet. Use the upload box below to attach finished CAD
                        renders and 360° videos.
                      </div>
                    ) : (
                      media
                        .filter((m) => activeItem.output_media_ids.includes(m.id))
                        .map((m) => <JewelryArtCard key={m.id} media={m} />)
                    )}
                  </div>
                </div>

                {/* Upload Output Bar (Any number of images & videos) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-800">
                    {t(lang, 'uploadOutput')} (Any number of images &amp; videos)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={uploadMediaType}
                      onChange={(e) => setUploadMediaType(e.target.value as 'image' | 'video')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                    >
                      <option value="image">CAD Render Image (PNG/JPG)</option>
                      <option value="video">360° Turntable Video (MP4 · ffmpeg compressed)</option>
                    </select>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Output title (e.g. Top & Side Matrix View)..."
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleDesignerAction(activeItem.id, 'upload_output')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add Output File
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 4.3: "3. The customer's messages and voice notes in time order, with play buttons." */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <h3 className="text-xs font-semibold text-slate-700">
                  3. {t(lang, 'customerMessagesVoice')} (Chronological Order)
                </h3>
                <div className="space-y-2.5">
                  {messages
                    .filter(
                      (m) =>
                        m.order_id === activeItem.order_id && m.direction === 'inbound'
                    )
                    .map((msg) =>
                      msg.type === 'audio' ? (
                        <VoiceNotePlayer
                          key={msg.id}
                          durationSec={15}
                          transcriptPreview={msg.text}
                          timestamp={msg.timestamp}
                        />
                      ) : (
                        <div
                          key={msg.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span>Customer Message (Phone Hidden)</span>
                            <span className="font-mono-num">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p dir="auto" className="font-medium text-slate-900">
                            {msg.text}
                          </p>
                        </div>
                      )
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const OrderDetailModal: React.FC<{
  lang: Lang;
  item: OrderItem;
  order?: Order;
  customer?: Customer;
  categories: Category[];
  categoryFields: CategoryFieldDefinition[];
  users: UserAccount[];
  media: MediaFile[];
  messages: WhatsAppMessage[];
  statusHistory: StatusHistoryEntry[];
  onClose: () => void;
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({
  lang,
  item,
  order,
  customer,
  categories,
  categoryFields,
  users,
  media,
  messages,
  statusHistory,
  onClose,
  onRefresh,
  apiPost,
}) => {
  const [specsEdit, setSpecsEdit] = useState<ItemSpecs>({ ...item.specs });
  const [noteEdit, setNoteEdit] = useState(item.note || '');
  const [changeReason, setChangeReason] = useState('');
  const [deliveryFeedback, setDeliveryFeedback] = useState<string | null>(null);

  const windowCheck = checkCustomerServiceWindow(customer?.last_message_at);
  const applicableFields = categoryFields.filter(
    (cf) => cf.category_id === '*' || cf.category_id === item.category_id
  );
  const itemHistory = statusHistory.filter((sh) => sh.item_id === item.id);
  const orderMessages = messages.filter((m) => m.order_id === item.order_id);

  const handleSaveSpecs = async () => {
    await apiPost('/api/items/update-specs', {
      item_id: item.id,
      specs: specsEdit,
      note: noteEdit,
      flag_change: true,
    });
    onRefresh();
  };

  const handleReview = async (decision: 'Approved' | 'Change requested') => {
    await apiPost('/api/items/review', {
      item_id: item.id,
      decision,
      note:
        decision === 'Change requested'
          ? changeReason || 'Please adjust weight and stone setting as discussed'
          : 'Approved by Owner',
    });
    onRefresh();
  };

  const handleDeliverToCustomer = async (useTemplateFallback: boolean) => {
    const res = (await apiPost('/api/items/deliver', {
      item_id: item.id,
      use_template_if_closed: useTemplateFallback,
    })) as { windowStatus?: { deliveryMode: string } };
    setDeliveryFeedback(
      res?.windowStatus?.deliveryMode === 'freeform'
        ? 'Sent approved media directly on WhatsApp (24h customer window open).'
        : 'Sent pre-approved Meta Template message first + queued media (24h window was closed).'
    );
    onRefresh();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order #${item.order_number} Item ${item.item_index} Detail`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
    >
      <div className="my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono-num text-xl font-bold text-slate-900">
                Order #{item.order_number} · Item {item.item_index}
              </span>
              <span>·</span>
              <span className="font-semibold text-slate-800">{customer?.display_name}</span>
              <span>·</span>
              <span className="font-mono-num">{customer?.phone}</span>
              <span>·</span>
              <span className="font-bold text-slate-900">{statusLabel(lang, item.status)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {windowCheck.isOpen ? (
                <span className="text-emerald-700 font-medium">
                  {t(lang, 'windowOpen')} ({windowCheck.hoursRemaining}h remaining)
                </span>
              ) : (
                <span className="text-amber-700 font-medium">{t(lang, 'windowClosed')}</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Order Detail"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Owner / Staff Approval & WhatsApp Delivery Controls */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-800">
              Owner / Staff Review &amp; WhatsApp Customer Delivery
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleReview('Approved')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t(lang, 'approveOutput')}
              </button>

              <button
                type="button"
                onClick={() => handleDeliverToCustomer(!windowCheck.isOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                {windowCheck.isOpen
                  ? t(lang, 'sendToCustomer')
                  : 'Send Template + Media (24h Window Closed)'}
              </button>
            </div>
          </div>

          {/* Request Change input */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Reason for change request (returns item to designer with note)..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => handleReview('Change requested')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t(lang, 'requestChange')}
            </button>
          </div>

          {deliveryFeedback && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              {deliveryFeedback}
            </div>
          )}
        </div>

        {/* Specification Editor (Triggers Crossed-Out Diff for Designer!) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-800">
              Specifications (Editing an active item crosses out the old value for the designer)
            </h3>
            <button
              type="button"
              onClick={handleSaveSpecs}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Save Spec Changes
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {applicableFields.map((field) => {
              const cur = specsEdit[field.key];
              const prev = item.previous_specs?.[field.key];
              return (
                <div key={field.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                    <span>{lang === 'ur' ? field.label_ur : field.label_en}</span>
                    {prev?.value && (
                      <span className="line-through text-rose-600 font-mono-num">
                        Was: {prev.value} {prev.unit || ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={cur?.value || ''}
                      onChange={(e) =>
                        setSpecsEdit((s) => ({
                          ...s,
                          [field.key]: {
                            value: e.target.value,
                            unit: cur?.unit || field.units?.[0],
                          },
                        }))
                      }
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono-num"
                    />
                    {field.units && field.units.length > 0 && (
                      <select
                        value={cur?.unit || field.units[0]}
                        onChange={(e) =>
                          setSpecsEdit((s) => ({
                            ...s,
                            [field.key]: {
                              value: cur?.value || '',
                              unit: e.target.value,
                            },
                          }))
                        }
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-1 text-xs"
                      >
                        {field.units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Media Gallery: Reference vs Designer Output */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700">
              {t(lang, 'referenceMedia')} ({item.reference_media_ids.length})
            </h4>
            {media
              .filter((m) => item.reference_media_ids.includes(m.id))
              .map((m) => (
                <JewelryArtCard key={m.id} media={m} />
              ))}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700">
              {t(lang, 'designerOutputMedia')} ({item.output_media_ids.length})
            </h4>
            {item.output_media_ids.length === 0 ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                Awaiting designer upload
              </div>
            ) : (
              media
                .filter((m) => item.output_media_ids.includes(m.id))
                .map((m) => <JewelryArtCard key={m.id} media={m} />)
            )}
          </div>
        </div>

        {/* Message Thread & Status History */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700">WhatsApp Thread</h4>
            {orderMessages.map((msg) =>
              msg.type === 'audio' ? (
                <VoiceNotePlayer
                  key={msg.id}
                  durationSec={14}
                  transcriptPreview={msg.text}
                  timestamp={msg.timestamp}
                />
              ) : (
                <div
                  key={msg.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                >
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>{msg.direction === 'outbound' ? 'Outbound WhatsApp' : 'Customer'}</span>
                    <span className="font-mono-num">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p dir="auto" className="text-slate-800">
                    {msg.text}
                  </p>
                </div>
              )
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              Item Status History ({itemHistory.length})
            </h4>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              {itemHistory.map((sh) => (
                <div key={sh.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between font-medium text-slate-900">
                    <span>
                      {sh.from_status} &rarr; {sh.to_status}
                    </span>
                    <span className="font-mono-num text-[11px] text-slate-500">
                      {new Date(sh.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    By {sh.user_name} {sh.note ? `· ${sh.note}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
