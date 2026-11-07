import React, { useEffect, useState, useCallback } from 'react';
import {
  Inbox,
  LayoutGrid,
  UserCheck,
  Users,
  PlusCircle,
  History,
  Contact,
  Shield,
  Hammer,
  Terminal,
  Languages,
} from 'lucide-react';
import {
  AdminAccessLogEntry,
  AICorrection,
  AIPromptVersion,
  AuditLogEntry,
  Category,
  CategoryFieldDefinition,
  Customer,
  ErrorLogEntry,
  MediaFile,
  Order,
  OrderItem,
  StatusHistoryEntry,
  SystemSettings,
  UserAccount,
  WhatsAppAccount,
  WhatsAppMessage,
} from './types';
import { Lang, t } from './i18n/translations';
import { InboxAndSimulatorView } from './components/InboxAndSimulatorView';
import {
  AddOnsiteOrderView,
  AllotScreenView,
  DesignersTodayView,
  HistoryAndCustomersView,
  TodayBoardView,
} from './components/TodayAllotAndDesignersView';
import { DesignerMyWorkView, OrderDetailModal } from './components/DesignerAndDetailView';
import { AdminAndVpsView } from './components/AdminAndVpsView';

type ActiveScreen =
  | 'inbox'
  | 'today'
  | 'allot'
  | 'designers_today'
  | 'add_onsite'
  | 'history'
  | 'customers'
  | 'accounts'
  | 'my_work'
  | 'admin';

interface AppStatePayload {
  actor: UserAccount;
  settings: SystemSettings;
  whatsapp_accounts: WhatsAppAccount[];
  users: UserAccount[];
  categories: Category[];
  category_fields: CategoryFieldDefinition[];
  customers: Customer[];
  media: MediaFile[];
  orders: Order[];
  order_items: OrderItem[];
  messages: WhatsAppMessage[];
  status_history: StatusHistoryEntry[];
  audit_log: AuditLogEntry[];
  admin_access_log: AdminAccessLogEntry[];
  error_log: ErrorLogEntry[];
  ai_prompt_versions: AIPromptVersion[];
  ai_corrections: AICorrection[];
  admin_data_blocked?: boolean;
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [activeUserId, setActiveUserId] = useState<string>('user-owner');
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('inbox');
  const [state, setState] = useState<AppStatePayload | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchState = useCallback(
    async (logAdminAccess = false) => {
      try {
        const res = await fetch(
          `/api/state${logAdminAccess ? '?log_access=1' : ''}`,
          {
            headers: {
              'x-user-id': activeUserId,
            },
          }
        );
        if (res.ok) {
          const data = (await res.json()) as AppStatePayload;
          setState(data);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeUserId]
  );

  useEffect(() => {
    fetchState(true);
    // Section 9: "Live updates through polling every 30 seconds at first."
    const timer = window.setInterval(() => {
      fetchState(false);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [fetchState]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const apiPost = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': activeUserId,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Request failed');
    }
    return data;
  };

  const handleUserChange = (newUserId: string) => {
    setActiveUserId(newUserId);
    const targetUser = state?.users.find((u) => u.id === newUserId);
    if (targetUser?.role === 'designer') {
      setActiveScreen('my_work');
    } else if (targetUser?.role === 'admin') {
      setActiveScreen('admin');
    } else {
      setActiveScreen('inbox');
    }
  };

  if (loading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-sm font-medium text-slate-600">
          Loading RP Design Order Management System...
        </div>
      </div>
    );
  }

  const actor = state.actor;
  const draftCount = state.orders.filter((o) => o.is_draft && !o.deleted_at).length;
  const unassignedCount = state.order_items.filter(
    (it) =>
      !it.designer_id &&
      it.status === 'New' &&
      state.orders.some((o) => o.id === it.order_id && !o.is_draft && !o.deleted_at)
  ).length;

  const selectedItem = selectedItemId
    ? state.order_items.find((it) => it.id === selectedItemId) || null
    : null;

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className={`min-h-screen bg-slate-50 text-slate-900 ${lang === 'ur' ? 'urdu-ui' : ''}`}
    >
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveScreen(actor.role === 'designer' ? 'my_work' : 'inbox');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {t(lang, 'appName')}
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {actor.role !== 'designer' && (
            <>
              <button
                type="button"
                onClick={() => setActiveScreen('inbox')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === 'inbox'
                    ? 'text-slate-900 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'inbox')} ({draftCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('today')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === 'today'
                    ? 'text-slate-900 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'todayBoard')}
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('allot')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === 'allot'
                    ? 'text-slate-900 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'allotWork')} ({unassignedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('designers_today')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === 'designers_today'
                    ? 'text-slate-900 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'designersToday')}
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('admin')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === 'admin'
                    ? 'text-slate-900 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'adminConsole')}
              </button>
            </>
          )}

          {actor.role === 'designer' && (
            <button
              type="button"
              onClick={() => setActiveScreen('my_work')}
              className="text-slate-900 font-semibold underline underline-offset-8 whitespace-nowrap shrink-0"
            >
              {t(lang, 'myWork')}
            </button>
          )}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
            aria-label={lang === 'en' ? 'Switch interface to Urdu' : 'Switch interface to English'}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === 'en' ? t(lang, 'urduToggle') : t(lang, 'englishToggle')}
          </button>
        </div>
      </header>

      {/* Secondary Workspace Bar: Role / Login Switcher & All Operational Screens */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          {/* Sub-navigation buttons for all screens (also accessible on mobile) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {actor.role !== 'designer' ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveScreen('inbox')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'inbox'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Inbox className="h-3.5 w-3.5" />
                  {t(lang, 'inbox')} ({draftCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('today')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'today'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t(lang, 'todayBoard')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('allot')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'allot'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {t(lang, 'allotWork')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('designers_today')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'designers_today'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {t(lang, 'designersToday')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('add_onsite')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'add_onsite'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  {t(lang, 'addOrder')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('history')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'history'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  {t(lang, 'historySearch')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('customers')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'customers'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Contact className="h-3.5 w-3.5" />
                  {t(lang, 'customers')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('accounts')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'accounts'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {t(lang, 'accountsPrivacy')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('admin')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScreen === 'admin'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  {t(lang, 'adminConsole')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setActiveScreen('my_work')}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shrink-0"
              >
                <Hammer className="h-3.5 w-3.5" />
                {t(lang, 'myWork')} ({state.order_items.length})
              </button>
            )}
          </div>

          {/* Role & Account Switcher (Owner, Staff, 10 Designers, Admin) */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="role-switcher-select"
              className="text-xs font-semibold text-slate-600 whitespace-nowrap"
            >
              {t(lang, 'switchRole')}:
            </label>
            <select
              id="role-switcher-select"
              value={activeUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
            >
              {state.users
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    [{u.role.toUpperCase()}] {u.full_name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {activeScreen === 'inbox' && actor.role !== 'designer' && (
          <InboxAndSimulatorView
            lang={lang}
            orders={state.orders}
            orderItems={state.order_items}
            customers={state.customers}
            categories={state.categories}
            categoryFields={state.category_fields}
            media={state.media}
            messages={state.messages}
            quietPeriodMinutes={state.settings.quiet_period_minutes}
            onRefresh={() => fetchState(false)}
            apiPost={apiPost}
          />
        )}

        {activeScreen === 'today' && actor.role !== 'designer' && (
          <TodayBoardView
            lang={lang}
            orders={state.orders}
            orderItems={state.order_items}
            customers={state.customers}
            categories={state.categories}
            users={state.users}
            media={state.media}
            onSelectItem={(item) => setSelectedItemId(item.id)}
          />
        )}

        {activeScreen === 'allot' && actor.role !== 'designer' && (
          <AllotScreenView
            lang={lang}
            orders={state.orders}
            orderItems={state.order_items}
            categories={state.categories}
            users={state.users}
            onRefresh={() => fetchState(false)}
            apiPost={apiPost}
          />
        )}

        {activeScreen === 'designers_today' && actor.role !== 'designer' && (
          <DesignersTodayView
            lang={lang}
            orderItems={state.order_items}
            categories={state.categories}
            users={state.users}
            onSelectItem={(item) => setSelectedItemId(item.id)}
          />
        )}

        {activeScreen === 'add_onsite' && actor.role !== 'designer' && (
          <AddOnsiteOrderView
            lang={lang}
            categories={state.categories}
            categoryFields={state.category_fields}
            users={state.users}
            orders={state.orders}
            onOrderCreated={() => {
              fetchState(false);
              setActiveScreen('today');
            }}
            apiPost={apiPost}
          />
        )}

        {(activeScreen === 'history' ||
          activeScreen === 'customers' ||
          activeScreen === 'accounts') &&
          actor.role !== 'designer' && (
            <HistoryAndCustomersView
              lang={lang}
              mode={activeScreen}
              actorRole={actor.role}
              orders={state.orders}
              orderItems={state.order_items}
              customers={state.customers}
              categories={state.categories}
              users={state.users}
              settings={state.settings}
              adminAccessLog={state.admin_access_log}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onRefresh={() => fetchState(false)}
              apiPost={apiPost}
            />
          )}

        {(activeScreen === 'my_work' || actor.role === 'designer') && (
          <DesignerMyWorkView
            lang={lang}
            actor={actor}
            orderItems={state.order_items}
            categories={state.categories}
            categoryFields={state.category_fields}
            media={state.media}
            messages={state.messages}
            onRefresh={() => fetchState(false)}
            apiPost={apiPost}
          />
        )}

        {activeScreen === 'admin' && actor.role !== 'designer' && (
          <AdminAndVpsView
            lang={lang}
            settings={state.settings}
            whatsappAccounts={state.whatsapp_accounts}
            categories={state.categories}
            categoryFields={state.category_fields}
            orderItems={state.order_items}
            aiPromptVersions={state.ai_prompt_versions}
            aiCorrections={state.ai_corrections}
            auditLog={state.audit_log}
            errorLog={state.error_log}
            adminAccessLog={state.admin_access_log}
            adminDataBlocked={state.admin_data_blocked}
            onRefresh={() => fetchState(false)}
            apiPost={apiPost}
          />
        )}
      </main>

      {/* Order Detail Modal for Owner / Staff */}
      {selectedItem && (
        <OrderDetailModal
          lang={lang}
          item={selectedItem}
          order={state.orders.find((o) => o.id === selectedItem.order_id)}
          customer={state.customers.find(
            (c) =>
              c.id ===
              state.orders.find((o) => o.id === selectedItem.order_id)?.customer_id
          )}
          categories={state.categories}
          categoryFields={state.category_fields}
          users={state.users}
          media={state.media}
          messages={state.messages}
          statusHistory={state.status_history}
          onClose={() => setSelectedItemId(null)}
          onRefresh={() => fetchState(false)}
          apiPost={apiPost}
        />
      )}
    </div>
  );
}
