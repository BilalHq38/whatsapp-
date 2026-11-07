import React, { useState } from 'react';
import {
  UserCheck,
  Users,
  PlusCircle,
  Search,
  Eye,
  AlertCircle,
  ShieldCheck,
  ShieldOff,
  BookOpen,
  Repeat,
} from 'lucide-react';
import {
  AdminAccessLogEntry,
  Category,
  CategoryFieldDefinition,
  Customer,
  ItemSpecs,
  MediaFile,
  Order,
  OrderItem,
  OrderItemStatus,
  SystemSettings,
  UserAccount,
  UserRole,
} from '../types';
import { Lang, statusLabel, t } from '../i18n/translations';
import { JewelryArtCard } from './JewelryVisuals';
import { checkCustomerServiceWindow } from '../utils/orderRules';

const ALL_STATUSES: OrderItemStatus[] = [
  'New',
  'Allotted',
  'In progress',
  'Submitted',
  'Approved',
  'Delivered',
  'Change requested',
];

export const TodayBoardView: React.FC<{
  lang: Lang;
  orders: Order[];
  orderItems: OrderItem[];
  customers: Customer[];
  categories: Category[];
  users: UserAccount[];
  media: MediaFile[];
  onSelectItem: (item: OrderItem) => void;
}> = ({
  lang,
  orders,
  orderItems,
  customers,
  categories,
  users,
  media,
  onSelectItem,
}) => {
  const [statusFilter, setStatusFilter] = useState<OrderItemStatus | 'ALL'>('ALL');
  const confirmedOrderIds = new Set(
    orders.filter((o) => !o.is_draft && !o.deleted_at).map((o) => o.id)
  );
  const confirmedItems = orderItems.filter((it) => confirmedOrderIds.has(it.order_id));

  const filteredItems =
    statusFilter === 'ALL'
      ? confirmedItems
      : confirmedItems.filter((it) => it.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Segmented Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'todayBoard')}
          </h2>
          <p className="text-xs text-slate-600">
            All active items organized by lifecycle stage. Click any item to review, approve, request
            changes, or send to customer on WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({confirmedItems.length})
          </button>
          {ALL_STATUSES.map((st) => {
            const count = confirmedItems.filter((i) => i.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {statusLabel(lang, st)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Table / Cards */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Order / Item</th>
                <th className="px-4 py-3 font-semibold">Preview</th>
                <th className="px-4 py-3 font-semibold">Customer &amp; Source</th>
                <th className="px-4 py-3 font-semibold">Category &amp; Filled Details</th>
                <th className="px-4 py-3 font-semibold">Designer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((item) => {
                const order = orders.find((o) => o.id === item.order_id);
                const customer = customers.find((c) => c.id === order?.customer_id);
                const category = categories.find((c) => c.id === item.category_id);
                const designer = users.find((u) => u.id === item.designer_id);
                const refMedia = media.find((m) => item.reference_media_ids.includes(m.id));

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono-num font-bold text-slate-900 text-sm">
                        #{item.order_number}.{item.item_index}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {order?.source === 'onsite' ? 'On-site Counter' : 'WhatsApp'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {refMedia && <JewelryArtCard media={refMedia} compact />}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">{customer?.display_name}</div>
                      <div className="font-mono-num text-[11px] text-slate-500">
                        {customer?.phone}
                      </div>
                      {order?.catalog_book_name && (
                        <div className="mt-1 text-[11px] text-slate-600">
                          Catalog: {order.catalog_book_name} #{order.catalog_item_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">
                        {lang === 'ur' ? category?.name_ur : category?.name_en}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
                        {Object.entries(item.specs).map(([k, v]) => {
                          if (!v?.value) return null;
                          const oldVal = item.previous_specs?.[k];
                          return (
                            <span key={k} className="font-mono-num">
                              <span className="text-slate-500">{k}:</span>{' '}
                              {oldVal?.value && (
                                <span className="line-through text-rose-600 mr-1">
                                  {oldVal.value} {oldVal.unit || ''}
                                </span>
                              )}
                              <strong className="text-slate-900">
                                {v.value} {v.unit || ''}
                              </strong>
                            </span>
                          );
                        })}
                      </div>
                      {item.note && (
                        <p className="mt-1 text-[11px] text-slate-500 truncate max-w-xs">
                          Note: {item.note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {designer ? (
                        <div>
                          <div className="font-semibold text-slate-900">{designer.full_name}</div>
                          <div className="text-[11px] text-slate-500">{designer.specialty}</div>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">
                        {statusLabel(lang, item.status)}
                      </div>
                      {item.change_flag && (
                        <div className="mt-0.5 text-[11px] font-medium text-rose-700">
                          Change Unseen by Designer
                        </div>
                      )}
                      {item.output_media_ids.length > 0 && (
                        <div className="mt-0.5 font-mono-num text-[11px] text-emerald-700">
                          {item.output_media_ids.length} output file(s)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect / Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AllotScreenView: React.FC<{
  lang: Lang;
  orders: Order[];
  orderItems: OrderItem[];
  categories: Category[];
  users: UserAccount[];
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({ lang, orders, orderItems, categories, users, onRefresh, apiPost }) => {
  const designers = users.filter((u) => u.role === 'designer' && u.active);
  const confirmedOrderIds = new Set(
    orders.filter((o) => !o.is_draft && !o.deleted_at).map((o) => o.id)
  );
  const activeItems = orderItems.filter(
    (it) => confirmedOrderIds.has(it.order_id) && it.status !== 'Delivered'
  );

  const [bulkDesignerId, setBulkDesignerId] = useState<string>(designers[0]?.id || 'des-1');

  const getDesignerOpenCount = (designerId: string) =>
    activeItems.filter(
      (it) =>
        it.designer_id === designerId &&
        it.status !== 'Delivered' &&
        it.status !== 'Approved'
    ).length;

  const handleAssignSingle = async (itemId: string, designerId: string) => {
    if (!designerId) return;
    await apiPost('/api/items/allot', {
      item_ids: [itemId],
      designer_id: designerId,
    });
    onRefresh();
  };

  const handleAssignAllUnassigned = async (itemIds: string[]) => {
    if (!bulkDesignerId || itemIds.length === 0) return;
    await apiPost('/api/items/allot', {
      item_ids: itemIds,
      designer_id: bulkDesignerId,
    });
    onRefresh();
  };

  const unassignedItems = activeItems.filter((it) => !it.designer_id || it.status === 'New');

  return (
    <div className="space-y-6">
      {/* Header + "Assign all to one designer" bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'allotWork')} ({designers.length} Designers)
          </h2>
          <p className="text-xs text-slate-600">
            Pick a designer manually. Each designer&apos;s open count is shown as information only —
            a busy designer never blocks assignment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={bulkDesignerId}
            onChange={(e) => setBulkDesignerId(e.target.value)}
            aria-label="Select designer for bulk assignment"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} ({getDesignerOpenCount(d.id)} open)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              handleAssignAllUnassigned(
                unassignedItems.length > 0
                  ? unassignedItems.map((i) => i.id)
                  : activeItems.map((i) => i.id)
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserCheck className="h-4 w-4" />
            {t(lang, 'assignAllToOne')} (
            {unassignedItems.length > 0 ? unassignedItems.length : activeItems.length})
          </button>
        </div>
      </div>

      {/* Items to Allot Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Order / Item</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Specifications</th>
              <th className="px-4 py-3 font-semibold">Current Status</th>
              <th className="px-4 py-3 font-semibold">Pick Designer (Open Count Shown)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeItems.map((item) => {
              const category = categories.find((c) => c.id === item.category_id);
              return (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono-num font-bold text-slate-900">
                    #{item.order_number}.{item.item_index}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {lang === 'ur' ? category?.name_ur : category?.name_en}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 font-mono-num text-slate-700">
                      {Object.entries(item.specs).map(([k, v]) =>
                        v?.value ? (
                          <span key={k}>
                            {k}: <strong>{v.value}</strong> {v.unit || ''}
                          </span>
                        ) : null
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {statusLabel(lang, item.status)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={item.designer_id || ''}
                      onChange={(e) => handleAssignSingle(item.id, e.target.value)}
                      aria-label={`Assign designer for item ${item.order_number}.${item.item_index}`}
                      className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
                    >
                      <option value="">— Select Designer —</option>
                      {designers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} · {getDesignerOpenCount(d.id)} {t(lang, 'openItemsCount')}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DesignersTodayView: React.FC<{
  lang: Lang;
  orderItems: OrderItem[];
  categories: Category[];
  users: UserAccount[];
  onSelectItem: (item: OrderItem) => void;
}> = ({ lang, orderItems, categories, users, onSelectItem }) => {
  const designers = users.filter((u) => u.role === 'designer');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          {t(lang, 'designersToday')} ({designers.length} Designers)
        </h2>
        <p className="text-xs text-slate-600">
          Compact overview of every designer in the workshop and the items they are working on
          today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {designers.map((designer) => {
          const items = orderItems.filter(
            (it) => it.designer_id === designer.id && it.status !== 'Delivered'
          );
          return (
            <div
              key={designer.id}
              className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{designer.full_name}</h3>
                    <p className="text-[11px] text-slate-500">{designer.specialty}</p>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-slate-900">
                    {items.length} open
                  </span>
                </div>

                <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  {items.length === 0 ? (
                    <p className="py-3 text-xs text-slate-400">No active items right now</p>
                  ) : (
                    items.map((it) => {
                      const cat = categories.find((c) => c.id === it.category_id);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => onSelectItem(it)}
                          className="w-full py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="text-xs">
                            <span className="font-mono-num font-bold text-slate-900">
                              #{it.order_number}.{it.item_index}
                            </span>{' '}
                            <span className="text-slate-600">· {cat?.name_en}</span>
                          </div>
                          <span
                            className={`text-[11px] font-medium ${
                              it.status === 'Change requested'
                                ? 'text-rose-700 font-semibold'
                                : it.status === 'Submitted'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-600'
                            }`}
                          >
                            {statusLabel(lang, it.status)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AddOnsiteOrderView: React.FC<{
  lang: Lang;
  categories: Category[];
  categoryFields: CategoryFieldDefinition[];
  users: UserAccount[];
  orders: Order[];
  onOrderCreated: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({
  lang,
  categories,
  categoryFields,
  users,
  orders,
  onOrderCreated,
  apiPost,
}) => {
  const designers = users.filter((u) => u.role === 'designer' && u.active);
  const [customerPhone, setCustomerPhone] = useState('+92 300 5519200');
  const [customerName, setCustomerName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-ring');
  const [designerId, setDesignerId] = useState('');
  const [catalogBook, setCatalogBook] = useState('');
  const [catalogItemNum, setCatalogItemNum] = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState('');
  const [note, setNote] = useState('');
  const [specs, setSpecs] = useState<ItemSpecs>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applicableFields = categoryFields.filter(
    (cf) => cf.category_id === '*' || cf.category_id === categoryId
  );

  const updateSpec = (key: string, value: string, unit?: string) => {
    setSpecs((prev) => ({
      ...prev,
      [key]: { value, ...(unit ? { unit } : prev[key]?.unit ? { unit: prev[key]?.unit } : {}) },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      setErrorMsg('Customer phone number is required.');
      return;
    }
    setErrorMsg(null);
    await apiPost('/api/orders/onsite', {
      customer_phone: customerPhone.trim(),
      customer_name: customerName.trim() || 'Walk-in Customer',
      category_id: categoryId,
      designer_id: designerId || undefined,
      catalog_book_name: catalogBook.trim() || undefined,
      catalog_item_number: catalogItemNum.trim() || undefined,
      linked_order_id: linkedOrderId || undefined,
      link_type: linkedOrderId ? 'repeat' : undefined,
      specs,
      note,
    });
    onOrderCreated();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 space-y-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          {t(lang, 'addOrder')}
        </h2>
        <p className="text-xs text-slate-600">
          Manual order entry for walk-in customers or physical catalog orders (Book Name &amp; Item
          Number). Units are stored exactly as entered.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Customer Phone *
          </label>
          <input
            type="text"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Customer / Shop Name
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Bismillah Jewellers"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Allot Designer Immediately (Optional)
          </label>
          <select
            value={designerId}
            onChange={(e) => setDesignerId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="">— Leave as New (Allot Later) —</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Plain Catalog Order Fields & Repeat Order Link */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <BookOpen className="inline h-3.5 w-3.5 mr-1 text-slate-500" />
            {t(lang, 'catalogBookLabel')}
          </label>
          <input
            type="text"
            value={catalogBook}
            onChange={(e) => setCatalogBook(e.target.value)}
            placeholder="e.g. Royal Bridal Vol. 4"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t(lang, 'catalogItemNumLabel')}
          </label>
          <input
            type="text"
            value={catalogItemNum}
            onChange={(e) => setCatalogItemNum(e.target.value)}
            placeholder="e.g. RB-104"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <Repeat className="inline h-3.5 w-3.5 mr-1 text-slate-500" />
            Link as Repeat / Revision of Past Order
          </label>
          <select
            value={linkedOrderId}
            onChange={(e) => setLinkedOrderId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
          >
            <option value="">— Not Linked —</option>
            {orders
              .filter((o) => !o.is_draft)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  Order #{o.number}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Category & Dynamic Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'ur' ? c.name_ur : c.name_en}
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Karigar / design instructions..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {applicableFields.map((field) => {
            const val = specs[field.key];
            return (
              <div key={field.id} className="rounded-lg border border-slate-200 p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ur' ? field.label_ur : field.label_en}
                </label>
                {field.field_type === 'select' ? (
                  <select
                    value={val?.value || ''}
                    onChange={(e) => updateSpec(field.key, e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
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
                      value={val?.value || ''}
                      onChange={(e) =>
                        updateSpec(field.key, e.target.value, val?.unit || field.units?.[0])
                      }
                      placeholder={field.placeholder || 'Optional'}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono-num"
                    />
                    {field.units && field.units.length > 0 && (
                      <select
                        value={val?.unit || field.units[0]}
                        onChange={(e) => updateSpec(field.key, val?.value || '', e.target.value)}
                        className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-medium"
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Save On-Site Order
        </button>
      </div>
    </form>
  );
};

export const HistoryAndCustomersView: React.FC<{
  lang: Lang;
  mode: 'history' | 'customers' | 'accounts';
  actorRole: UserRole;
  orders: Order[];
  orderItems: OrderItem[];
  customers: Customer[];
  categories: Category[];
  users: UserAccount[];
  settings: SystemSettings;
  adminAccessLog: AdminAccessLogEntry[];
  onSelectItem: (item: OrderItem) => void;
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({
  lang,
  mode,
  actorRole,
  orders,
  orderItems,
  customers,
  categories,
  users,
  settings,
  adminAccessLog,
  onSelectItem,
  onRefresh,
  apiPost,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesigner, setFilterDesigner] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [imageSimilarityCategory, setImageSimilarityCategory] = useState('ALL');

  // New account creation state (Owner only)
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'designer' | 'staff'>('designer');
  const [newSpecialty, setNewSpecialty] = useState('');

  if (mode === 'customers') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'customers')} ({customers.length})
          </h2>
          <p className="text-xs text-slate-600">
            Customer phone numbers, 24-hour WhatsApp service window status, and past order counts so
            repeat orders are easy to find.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Display Name</th>
                <th className="px-4 py-3 font-semibold">WhatsApp Phone</th>
                <th className="px-4 py-3 font-semibold">24h Service Window</th>
                <th className="px-4 py-3 font-semibold">Past Orders</th>
                <th className="px-4 py-3 font-semibold">Workshop Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.map((c) => {
                const custOrders = orders.filter((o) => o.customer_id === c.id && !o.deleted_at);
                const win = checkCustomerServiceWindow(c.last_message_at);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.display_name}</td>
                    <td className="px-4 py-3 font-mono-num text-slate-700">{c.phone}</td>
                    <td className="px-4 py-3">
                      {win.isOpen ? (
                        <span className="font-medium text-emerald-700">
                          Open ({win.hoursRemaining}h remaining · Free-form allowed)
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">
                          Closed (&gt;24h · Meta Template required first)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-num">
                      {custOrders.map((o) => `#${o.number}`).join(', ') || 'None'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mode === 'accounts') {
    const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUsername.trim() || !newFullName.trim()) return;
      await apiPost('/api/users', {
        username: newUsername.trim(),
        full_name: newFullName.trim(),
        role: newRole,
        specialty: newSpecialty.trim() || 'CAD / RP Designer',
      });
      setNewUsername('');
      setNewFullName('');
      setNewSpecialty('');
      onRefresh();
    };

    const toggleAdminDataAccess = async () => {
      await apiPost('/api/settings', {
        admin_data_access_enabled: !settings.admin_data_access_enabled,
      });
      onRefresh();
    };

    return (
      <div className="space-y-6">
        {/* Owner Privacy Control Switch (Section 2: "The owner has a setting to switch off admin access to data. Every admin view of order data is written to an access log.") */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              {settings.admin_data_access_enabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <ShieldOff className="h-5 w-5 text-rose-600" />
              )}
              {settings.admin_data_access_enabled
                ? t(lang, 'adminAccessEnabled')
                : t(lang, 'adminAccessDisabled')}
            </h2>
            <p className="text-xs text-slate-600">
              Protects both the Owner and the Admin (Developer). Every Admin view of order data is
              recorded in the immutable Access Log below.
            </p>
          </div>

          {actorRole === 'owner' ? (
            <button
              type="button"
              onClick={toggleAdminDataAccess}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                settings.admin_data_access_enabled
                  ? 'border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
              }`}
            >
              {settings.admin_data_access_enabled
                ? 'Switch Off Admin Access to Order Data'
                : 'Re-Enable Admin Access to Order Data'}
            </button>
          ) : (
            <span className="text-xs font-medium text-slate-500">
              Only the Owner account can change this setting.
            </span>
          )}
        </div>

        {/* Create Designer / Staff Account (Owner Only) */}
        {actorRole === 'owner' ? (
          <form
            onSubmit={handleAddUser}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Create Staff or Designer Account (Owner Only)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Full Name (e.g. Kashif Raza)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Login Username"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-num"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'designer' | 'staff')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="designer">Designer</option>
                <option value="staff">Staff</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  placeholder="Specialty (Rings/Bangles)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Add User
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            Staff accounts can perform all business operations except creating, editing, or deleting
            user accounts (Owner only).
          </div>
        )}

        {/* User Accounts Directory */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Full Name</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Specialty</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {actorRole === 'owner' && (
                  <th className="px-4 py-3 text-right font-semibold">Manage</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 font-mono-num text-slate-600">@{u.username}</td>
                  <td className="px-4 py-3 capitalize font-medium text-slate-800">{u.role}</td>
                  <td className="px-4 py-3 text-slate-600">{u.specialty || '—'}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-emerald-700 font-semibold">Active</span>
                    ) : (
                      <span className="text-slate-400">Deactivated</span>
                    )}
                  </td>
                  {actorRole === 'owner' && (
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiPost('/api/users', {
                              action: 'toggle_active',
                              user_id: u.id,
                            });
                            onRefresh();
                          }}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Admin Data Access Log */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Admin Data Access Log ({adminAccessLog.length} recorded views)
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {adminAccessLog.map((entry) => (
              <div key={entry.id} className="py-2 flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-900">{entry.admin_name}</span> ·{' '}
                  <span className="font-mono-num text-slate-700">{entry.endpoint}</span> ·{' '}
                  <span className="text-slate-600">{entry.reason}</span>
                </div>
                <span className="font-mono-num text-slate-500">
                  {new Date(entry.at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // History & Search Mode (Section 7)
  const DesignersList = users.filter((u) => u.role === 'designer');
  const filteredHistory = orderItems.filter((item) => {
    const order = orders.find((o) => o.id === item.order_id);
    if (!order || order.is_draft || order.deleted_at) return false;
    const customer = customers.find((c) => c.id === order.customer_id);

    if (filterDesigner !== 'ALL' && item.designer_id !== filterDesigner) return false;
    if (filterCategory !== 'ALL' && item.category_id !== filterCategory) return false;
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (
      imageSimilarityCategory !== 'ALL' &&
      item.category_id !== imageSimilarityCategory
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = String(item.order_number).includes(q);
      const matchCust = customer?.display_name.toLowerCase().includes(q) || customer?.phone.includes(q);
      const matchNote = item.note.toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchNote) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Summary Counts Per Day, Month, Category, Designer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Today&apos;s Total Items</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
            {orderItems.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Target capacity: 16–20 orders/day</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">November 2026 Monthly Total</div>
          <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">142</div>
          <div className="mt-1 text-[11px] text-slate-500">Zero hard-deletes (deleted_at intact)</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Top Category This Month</div>
          <div className="mt-1 font-display text-lg font-bold text-slate-900">
            Ring ({categories[0]?.usage_count})
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Followed by Bangle (112)</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Phase 3 pgvector Visual Lookup</div>
          <select
            value={imageSimilarityCategory}
            onChange={(e) => setImageSimilarityCategory(e.target.value)}
            aria-label="Simulate CLIP image similarity lookup"
            className="mt-1.5 w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium"
          >
            <option value="ALL">Upload/Match Image by Embedding: All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                Match Similar Designs: {c.name_en}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(lang, 'searchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
        <select
          value={filterDesigner}
          onChange={(e) => setFilterDesigner(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="ALL">{t(lang, 'allDesigners')}</option>
          {DesignersList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="ALL">{t(lang, 'allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_en}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="ALL">{t(lang, 'allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(lang, s)}
            </option>
          ))}
        </select>
      </div>

      {/* Filtered Results */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Order #</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Designer</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredHistory.map((item) => {
              const ord = orders.find((o) => o.id === item.order_id);
              const cust = customers.find((c) => c.id === ord?.customer_id);
              const cat = categories.find((c) => c.id === item.category_id);
              const des = users.find((u) => u.id === item.designer_id);

              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono-num font-bold text-slate-900">
                    #{item.order_number}.{item.item_index}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-slate-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{cust?.display_name}</td>
                  <td className="px-4 py-3 text-slate-800">{cat?.name_en}</td>
                  <td className="px-4 py-3 text-slate-700">{des?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {statusLabel(lang, item.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
