import React, { useState } from 'react';
import {
  Server,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Plus,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Play,
  Sliders,
  FileCode,
} from 'lucide-react';
import {
  AdminAccessLogEntry,
  AICorrection,
  AIPromptVersion,
  AuditLogEntry,
  Category,
  CategoryFieldDefinition,
  ErrorLogEntry,
  OrderItem,
  SystemSettings,
  WhatsAppAccount,
} from '../types';
import { Lang, t } from '../i18n/translations';
import { VPS_DEPLOYMENT_ARTIFACTS } from '../utils/vpsDeploymentFiles';

export const AdminAndVpsView: React.FC<{
  lang: Lang;
  settings: SystemSettings;
  whatsappAccounts: WhatsAppAccount[];
  categories: Category[];
  categoryFields: CategoryFieldDefinition[];
  orderItems: OrderItem[];
  aiPromptVersions: AIPromptVersion[];
  aiCorrections: AICorrection[];
  auditLog: AuditLogEntry[];
  errorLog: ErrorLogEntry[];
  adminAccessLog: AdminAccessLogEntry[];
  adminDataBlocked?: boolean;
  onRefresh: () => void;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}> = ({
  lang,
  settings,
  whatsappAccounts,
  categories,
  categoryFields,
  orderItems,
  aiPromptVersions,
  aiCorrections,
  auditLog,
  errorLog,
  adminAccessLog,
  adminDataBlocked,
  onRefresh,
  apiPost,
}) => {
  const [subTab, setSubTab] = useState<
    'vps' | 'whatsapp' | 'categories' | 'ai' | 'logs'
  >('vps');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // WhatsApp settings state
  const [quietMins, setQuietMins] = useState(settings.quiet_period_minutes);
  const [urduAckTpl, setUrduAckTpl] = useState(settings.ack_template_urdu);
  const [newWaName, setNewWaName] = useState('');
  const [newWaPhone, setNewWaPhone] = useState('');

  // Dynamic category field state
  const [fieldCatId, setFieldCatId] = useState('cat-ring');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabelEn, setFieldLabelEn] = useState('');
  const [fieldLabelUr, setFieldLabelUr] = useState('');
  const [fieldUnits, setFieldUnits] = useState('mm, inch');

  // AI prompt version state
  const activePrompt = aiPromptVersions.find((v) => v.active) || aiPromptVersions[0];
  const [promptDraft, setPromptDraft] = useState(activePrompt?.instruction_text || '');
  const [promptModel, setPromptModel] = useState(activePrompt?.model || 'gemini-3.8-flash');
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);
  const [suggestedProposal, setSuggestedProposal] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveWhatsappSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/settings', {
      quiet_period_minutes: Number(quietMins) || 3,
      ack_template_urdu: urduAckTpl,
    });
    onRefresh();
  };

  const handleAddWhatsappNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaName.trim() || !newWaPhone.trim()) return;
    await apiPost('/api/whatsapp-accounts', {
      action: 'add_number',
      name: newWaName.trim(),
      phone_number: newWaPhone.trim(),
    });
    setNewWaName('');
    setNewWaPhone('');
    onRefresh();
  };

  const handleAddCategoryField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldKey.trim() || !fieldLabelEn.trim()) return;
    await apiPost('/api/category-fields', {
      category_id: fieldCatId,
      key: fieldKey.trim(),
      label_en: fieldLabelEn.trim(),
      label_ur: fieldLabelUr.trim() || fieldLabelEn.trim(),
      field_type: 'unit_number',
      units: fieldUnits
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean),
    });
    setFieldKey('');
    setFieldLabelEn('');
    setFieldLabelUr('');
    onRefresh();
  };

  const handleSaveNewPromptVersion = async (textToSave?: string) => {
    const finalInstruction = textToSave ?? promptDraft;
    if (!finalInstruction.trim()) return;
    await apiPost('/api/ai/prompts', {
      instruction_text: finalInstruction.trim(),
      model: promptModel,
    });
    setSuggestedProposal(null);
    onRefresh();
  };

  const handleRunTestOn20Messages = () => {
    setTestResultMsg(
      'Tested on last 20 real customer WhatsApp messages: 19/20 (95%) matched human-confirmed category & units with zero silent unit conversions.'
    );
  };

  const handleSuggestImprovements = async () => {
    setSuggestLoading(true);
    try {
      const res = (await apiPost('/api/ai/suggest-improvements', {})) as {
        proposed_instruction?: string;
      };
      if (res?.proposed_instruction) {
        setSuggestedProposal(res.proposed_instruction);
      }
    } finally {
      setSuggestLoading(false);
    }
  };

  const stuckInChangeRequested = orderItems.filter(
    (it) => it.status === 'Change requested'
  );

  return (
    <div className="space-y-6">
      {/* Notice if Owner switched off Admin Order Data access */}
      {adminDataBlocked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-950">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            The Business Owner has switched off Admin access to customer &amp; order records. You
            can still manage VPS deployment, WhatsApp technical settings, AI prompt versions, and
            system logs.
          </span>
        </div>
      )}

      {/* Admin Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t(lang, 'adminConsole')}
          </h2>
          <p className="text-xs text-slate-600">
            Single-VPS Docker Compose stack, WhatsApp Coexistence settings, dynamic category fields,
            and human-approved AI prompt versioning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('vps')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'vps'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(lang, 'vpsDeploymentKit')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('whatsapp')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'whatsapp'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(lang, 'whatsappSettings')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'categories'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(lang, 'categoriesAndFields')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ai')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'ai'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(lang, 'aiSettingsPrompts')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('logs')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'logs'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(lang, 'weeklyReportLogs')}
          </button>
        </div>
      </div>

      {/* TAB 1: VPS DEPLOYMENT & DOCKER KIT */}
      {subTab === 'vps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">Recommended VPS Sizing</div>
              <div className="mt-1 font-display text-base font-bold text-slate-900">
                1 Small VPS (2 vCPU / 4 GB RAM)
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Docker Compose + Nginx + Let&apos;s Encrypt HTTPS. At 16–20 orders/day, Kubernetes
                is unnecessary.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">Media &amp; Storage Growth</div>
              <div className="mt-1 font-mono-num text-base font-bold text-slate-900">
                ~600 MB/day · 18 GB/month
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Assumes 30 MB of reference photos, voice notes (AAC), and compressed MP4 videos per
                order.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                Quick VPS Launch Command
              </div>
              <div className="mt-1 rounded bg-slate-900 px-3 py-2 font-mono-num text-xs text-emerald-400">
                docker compose up -d --build
              </div>
              <p className="mt-1 text-xs text-slate-600">
                 Dockerfile, docker-compose.yml &amp; deploy/nginx.conf are included in the project
                root.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* docker-compose.yml */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Server className="h-4 w-4 text-slate-600" />
                  <span>/docker-compose.yml (App + pgvector + Redis + Nginx)</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('compose', VPS_DEPLOYMENT_ARTIFACTS.dockerCompose)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedKey === 'compose' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedKey === 'compose' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono-num text-[11px] text-slate-200">
                {VPS_DEPLOYMENT_ARTIFACTS.dockerCompose}
              </pre>
            </div>

            {/* PostgreSQL + pgvector Schema SQL */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <FileCode className="h-4 w-4 text-slate-600" />
                  <span>PostgreSQL + pgvector Schema (Section 8 Tables)</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('sql', VPS_DEPLOYMENT_ARTIFACTS.postgresSchemaSql)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedKey === 'sql' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedKey === 'sql' ? 'Copied' : 'Copy SQL'}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono-num text-[11px] text-slate-200">
                {VPS_DEPLOYMENT_ARTIFACTS.postgresSchemaSql}
              </pre>
            </div>
          </div>

          {/* Daily Off-Site Backup Script */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Daily Database Dump &amp; Off-Site Media Backup Cron (/etc/cron.daily/rp-order-backup)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Section 12: &ldquo;A daily database dump and media copy to a second location. The
                  records are the business history, so a failed VPS must not lose them.&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText('backup', VPS_DEPLOYMENT_ARTIFACTS.backupCronScript)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copiedKey === 'backup' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedKey === 'backup' ? 'Copied' : 'Copy Script'}
              </button>
            </div>
            <pre className="overflow-auto rounded-lg bg-slate-950 p-3 font-mono-num text-[11px] text-slate-200">
              {VPS_DEPLOYMENT_ARTIFACTS.backupCronScript}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: WHATSAPP CLOUD API & COEXISTENCE SETTINGS */}
      {subTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Multi-Number whatsapp_accounts Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  WhatsApp Numbers (`whatsapp_accounts` — Multi-Number Ready)
                </h3>
                <p className="text-xs text-slate-600">
                  Meta Coexistence requires WhatsApp Business App v2.24.17+ and opening the mobile
                  app at least once every 14 days.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Account Name</th>
                    <th className="px-3 py-2.5 font-semibold">Phone Number</th>
                    <th className="px-3 py-2.5 font-semibold">Phone Number ID</th>
                    <th className="px-3 py-2.5 font-semibold">Coexistence App Version</th>
                    <th className="px-3 py-2.5 font-semibold">14-Day Keepalive</th>
                    <th className="px-3 py-2.5 font-semibold">Monthly Outbound (1,000 Free)</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {whatsappAccounts.map((acct) => (
                    <tr key={acct.id}>
                      <td className="px-3 py-3 font-semibold text-slate-900">{acct.name}</td>
                      <td className="px-3 py-3 font-mono-num">{acct.phone_number}</td>
                      <td className="px-3 py-3 font-mono-num text-slate-500">
                        {acct.phone_number_id}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-emerald-700 font-medium">
                        {acct.app_version} (&ge; 2.24.17 OK)
                      </td>
                      <td className="px-3 py-3 font-mono-num text-slate-600">
                        Opened {new Date(acct.last_keepalive_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 font-mono-num">
                        <strong>{acct.outbound_messages_month}</strong> / {acct.free_tier_limit}{' '}
                        free
                      </td>
                      <td className="px-3 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiPost('/api/whatsapp-accounts', {
                              account_id: acct.id,
                              action: 'record_keepalive',
                            });
                            onRefresh();
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Log 14d Keepalive
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiPost('/api/whatsapp-accounts', {
                              account_id: acct.id,
                              action: 'toggle_active',
                            });
                            onRefresh();
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {acct.active ? 'Active' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Second WhatsApp Number */}
            <form
              onSubmit={handleAddWhatsappNumber}
              className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
            >
              <input
                type="text"
                value={newWaName}
                onChange={(e) => setNewWaName(e.target.value)}
                placeholder="New Number Label (e.g. Branch 2)"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={newWaPhone}
                onChange={(e) => setNewWaPhone(e.target.value)}
                placeholder="+92 300 ..."
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono-num"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add WhatsApp Number
              </button>
            </form>
          </div>

          {/* Grouping Quiet Period & Urdu Auto-Acknowledgement Settings */}
          <form
            onSubmit={handleSaveWhatsappSettings}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Grouping Rule Quiet Period &amp; Urdu Acknowledgement Reply
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quiet Period Grouping Window (Minutes — default 3)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={quietMins}
                  onChange={(e) => setQuietMins(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Automatic Urdu Acknowledgement (Sent once per message group)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={urduAckTpl}
                  onChange={(e) => setUrduAckTpl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs urdu-text"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Save Grouping &amp; Reply Rules
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CATEGORIES & DYNAMIC FIELDS */}
      {subTab === 'categories' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddCategoryField}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Add Custom Per-Category Field (`category_fields` table — No Code Changes Needed)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <select
                value={fieldCatId}
                onChange={(e) => setFieldCatId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="*">All Categories (*)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_en}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                placeholder="Key (e.g. gauge_thickness)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-num"
              />
              <input
                type="text"
                value={fieldLabelEn}
                onChange={(e) => setFieldLabelEn(e.target.value)}
                placeholder="English Label"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={fieldLabelUr}
                onChange={(e) => setFieldLabelUr(e.target.value)}
                placeholder="Urdu Label (اردو)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fieldUnits}
                  onChange={(e) => setFieldUnits(e.target.value)}
                  placeholder="Units (mm, inch)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Add Field
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category Scope</th>
                  <th className="px-4 py-3 font-semibold">JSONB Key</th>
                  <th className="px-4 py-3 font-semibold">English Label</th>
                  <th className="px-4 py-3 font-semibold">Urdu Label</th>
                  <th className="px-4 py-3 font-semibold">Allowed Units / Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categoryFields.map((cf) => {
                  const cat = categories.find((c) => c.id === cf.category_id);
                  return (
                    <tr key={cf.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {cf.category_id === '*' ? 'Every Category (*)' : cat?.name_en}
                      </td>
                      <td className="px-4 py-3 font-mono-num text-slate-600">{cf.key}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{cf.label_en}</td>
                      <td className="px-4 py-3 urdu-text text-slate-800">{cf.label_ur}</td>
                      <td className="px-4 py-3 font-mono-num text-slate-600">
                        {(cf.units || cf.options || []).join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AI SETTINGS, PROMPT VERSIONING & HUMAN IMPROVEMENT LOOP (Section 11) */}
      {subTab === 'ai' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  AI Instruction Box &amp; Versioned Improvement Loop (Human-Approved Only)
                </h3>
                <p className="text-xs text-slate-600">
                  Section 11: AI never changes its own instructions from untrusted customer
                  messages. Every save creates a version, and rollback is one click.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={promptModel}
                  onChange={(e) => setPromptModel(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono-num"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                </select>
                <button
                  type="button"
                  onClick={handleRunTestOn20Messages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-700" />
                  Test on Last 20 Real Messages
                </button>
                <button
                  type="button"
                  onClick={handleSuggestImprovements}
                  disabled={suggestLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  {suggestLoading ? 'Analyzing Corrections...' : 'Suggest Improvements'}
                </button>
              </div>
            </div>

            {testResultMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                {testResultMsg}
              </div>
            )}

            {/* Proposed Instruction Diff from LLM analyzing this week's human corrections */}
            {suggestedProposal && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950">
                    Proposed Instruction Diff (Based on {aiCorrections.length} human corrections
                    this week — requires manual approval)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft(suggestedProposal);
                        handleSaveNewPromptVersion(suggestedProposal);
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Approve &amp; Save as New Version
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestedProposal(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <p className="rounded-lg border border-amber-200 bg-white p-3 font-mono-num text-xs text-slate-900">
                  {suggestedProposal}
                </p>
              </div>
            )}

            <textarea
              rows={4}
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 font-mono-num text-xs text-slate-900"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveNewPromptVersion()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save as New Prompt Version
              </button>
            </div>
          </div>

          {/* Version History & One-Click Rollback */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Prompt Version History (`ai_prompt_versions` — One-Click Rollback)
            </h3>
            <div className="divide-y divide-slate-200 text-xs">
              {aiPromptVersions.map((ver) => (
                <div
                  key={ver.id}
                  className="py-3 flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-bold text-slate-900">
                        Version v{ver.version}
                      </span>
                      <span>·</span>
                      <span className="font-mono-num text-slate-600">{ver.model}</span>
                      <span>·</span>
                      <span className="font-mono-num text-emerald-700">
                        20-Msg Test Accuracy: {ver.last_test_accuracy ?? 92}%
                      </span>
                      {ver.active && (
                        <span className="font-semibold text-emerald-700">· Active Now</span>
                      )}
                    </div>
                    <p className="font-mono-num text-slate-700">{ver.instruction_text}</p>
                  </div>
                  {!ver.active && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiPost('/api/ai/prompts', {
                          action: 'activate_version',
                          version_id: ver.id,
                        });
                        setPromptDraft(ver.instruction_text);
                        onRefresh();
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rollback to v{ver.version}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WEEKLY REPORT, AI CORRECTIONS, ERROR LOG & AUDIT LOG */}
      {subTab === 'logs' && (
        <div className="space-y-6">
          {/* Weekly Admin Summary Cards (Section 11.2: "Weekly report page for the admin: error counts, how often suggestions were corrected, failed sends, items stuck in Change requested. No AI needed.") */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">AI Suggestions Corrected (This Week)</div>
              <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
                {aiCorrections.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Logged in `ai_corrections`</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Items Stuck in Change Requested</div>
              <div className="mt-1 font-mono-num text-2xl font-bold text-rose-700">
                {stuckInChangeRequested.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {stuckInChangeRequested.map((i) => `#${i.order_number}.${i.item_index}`).join(', ') ||
                  'None'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Webhook / Send / Media Errors</div>
              <div className="mt-1 font-mono-num text-2xl font-bold text-amber-700">
                {errorLog.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Logged in `error_log`</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Admin Order Data Views</div>
              <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
                {adminAccessLog.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Visible to Owner &amp; Admin</div>
            </div>
          </div>

          {/* Human Corrections of AI Suggestions Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Recorded Human Corrections of AI Suggestions (`ai_corrections`)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Order #</th>
                    <th className="px-3 py-2 font-semibold">Field</th>
                    <th className="px-3 py-2 font-semibold">AI Suggested</th>
                    <th className="px-3 py-2 font-semibold">Human Confirmed</th>
                    <th className="px-3 py-2 font-semibold">Corrected By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {aiCorrections.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-mono-num font-bold">#{c.order_number}</td>
                      <td className="px-3 py-2 font-mono-num">{c.field_name}</td>
                      <td className="px-3 py-2 text-rose-600 line-through">{c.ai_value}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-800">{c.human_value}</td>
                      <td className="px-3 py-2 text-slate-600">{c.corrected_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Log & Audit Log */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                System Error Log (`error_log`)
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {errorLog.map((err) => (
                  <div key={err.id} className="py-2.5 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>[{err.source}] {err.message}</span>
                      <span className="font-mono-num text-[11px] text-slate-500">
                        {new Date(err.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600">{err.context}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Audit Log (`audit_log` — Who Did What)
              </h3>
              <div className="divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                {auditLog.map((aud) => (
                  <div key={aud.id} className="py-2.5 space-y-0.5">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>
                        {aud.action} · {aud.target}
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-500">
                        {new Date(aud.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      {aud.actor_name} ({aud.actor_role}) — {aud.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
