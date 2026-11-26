'use client';

import { useState, type FormEvent } from 'react';
import { Copy, Cpu, FileDown, Terminal } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export interface HardwareSnapshotRow {
  id: string;
  stage: 'BEFORE' | 'AFTER';
  source: string;
  cpuModel: string | null;
  ramGb: number | null;
  storageSummary: string | null;
  smartHealthPct: number | null;
  batteryHealthPct: number | null;
  osVersion: string | null;
  cpuTempCelsius: number | null;
  notes: string | null;
  createdAt: string;
}

export interface HardwareDiffResponse {
  snapshots: HardwareSnapshotRow[];
  before: HardwareSnapshotRow | null;
  after: HardwareSnapshotRow | null;
  diff: {
    ramDeltaGb: number | null;
    tempDeltaCelsius: number | null;
    smartDeltaPct: number | null;
    storageChanged: boolean;
  };
}

const POWERSHELL_COLLECTOR = `Get-CimInstance Win32_ComputerSystem | Select-Object @{N='cpuModel';E={(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)}}, @{N='ramGb';E={[math]::Round($_.TotalPhysicalMemory/1GB)}}, @{N='osVersion';E={(Get-CimInstance Win32_OperatingSystem).Caption}}, @{N='storageSummary';E={((Get-PhysicalDisk | ForEach-Object {"$($_.FriendlyName) $([math]::Round($_.Size/1GB))GB"}) -join ' | ')}} | ConvertTo-Json -Compress`;

export function HardwareCompareTab({
  osId,
  data,
  onReload,
}: {
  osId: string;
  data: HardwareDiffResponse | null;
  onReload: () => Promise<void>;
}) {
  const [stage, setStage] = useState<'BEFORE' | 'AFTER'>('BEFORE');
  const [cpuModel, setCpuModel] = useState('');
  const [ramGb, setRamGb] = useState('');
  const [storageSummary, setStorageSummary] = useState('');
  const [smartHealthPct, setSmartHealthPct] = useState('');
  const [batteryHealthPct, setBatteryHealthPct] = useState('');
  const [cpuTempCelsius, setCpuTempCelsius] = useState('');
  const [osVersion, setOsVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [collectorJson, setCollectorJson] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleImportJson(raw: string) {
    setCollectorJson(raw);
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.cpuModel === 'string') setCpuModel(parsed.cpuModel);
      if (typeof parsed.ramGb === 'number') setRamGb(String(parsed.ramGb));
      if (typeof parsed.storageSummary === 'string')
        setStorageSummary(parsed.storageSummary);
      if (typeof parsed.osVersion === 'string') setOsVersion(parsed.osVersion);
    } catch {
      // Usuário ainda digitando/colando
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch(`/service-orders/${osId}/hardware-snapshots`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          stage,
          source: collectorJson.trim() ? 'windows_collector' : 'manual',
          cpuModel: cpuModel || undefined,
          ramGb: ramGb ? Number(ramGb) : undefined,
          storageSummary: storageSummary || undefined,
          smartHealthPct: smartHealthPct ? Number(smartHealthPct) : undefined,
          batteryHealthPct: batteryHealthPct
            ? Number(batteryHealthPct)
            : undefined,
          cpuTempCelsius: cpuTempCelsius ? Number(cpuTempCelsius) : undefined,
          osVersion: osVersion || undefined,
          notes: notes || undefined,
        }),
      });
      setNotes('');
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadLaudoPdf() {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const res = await fetch(
      `${apiBase}/service-orders/${osId}/diagnostic-report-pdf`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  const before = data?.before ?? null;
  const after = data?.after ?? null;

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <Cpu className="h-4 w-4 text-accent" />
              Comparativo Técnico Antes x Depois (Bancada)
            </h3>
            <p className="text-xs text-text-secondary">
              Evidência objetiva de upgrade, limpeza térmica e troca de disco para o cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDownloadLaudoPdf()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            <FileDown className="h-3.5 w-3.5" />
            Laudo Comparativo (PDF)
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted/60 text-text-secondary">
              <tr>
                <th className="px-4 py-2.5 font-medium">Indicador</th>
                <th className="px-4 py-2.5 font-medium">Entrada (Antes)</th>
                <th className="px-4 py-2.5 font-medium">Entrega (Depois)</th>
                <th className="px-4 py-2.5 font-medium">Evolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Processador
                </td>
                <td className="px-4 py-2.5">{before?.cpuModel ?? '—'}</td>
                <td className="px-4 py-2.5">{after?.cpuModel ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-muted">—</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Memória RAM
                </td>
                <td className="px-4 py-2.5">
                  {before?.ramGb != null ? `${before.ramGb} GB` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {after?.ramGb != null ? `${after.ramGb} GB` : '—'}
                </td>
                <td className="px-4 py-2.5 text-accent">
                  {data?.diff.ramDeltaGb != null
                    ? `${data.diff.ramDeltaGb >= 0 ? '+' : ''}${data.diff.ramDeltaGb} GB`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Armazenamento
                </td>
                <td className="px-4 py-2.5">{before?.storageSummary ?? '—'}</td>
                <td className="px-4 py-2.5">{after?.storageSummary ?? '—'}</td>
                <td className="px-4 py-2.5 text-accent">
                  {data?.diff.storageChanged ? 'Substituído / Upgrade' : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Saúde SMART
                </td>
                <td className="px-4 py-2.5">
                  {before?.smartHealthPct != null
                    ? `${before.smartHealthPct}%`
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {after?.smartHealthPct != null
                    ? `${after.smartHealthPct}%`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-success">
                  {data?.diff.smartDeltaPct != null
                    ? `${data.diff.smartDeltaPct >= 0 ? '+' : ''}${data.diff.smartDeltaPct}%`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Temperatura CPU
                </td>
                <td className="px-4 py-2.5">
                  {before?.cpuTempCelsius != null
                    ? `${before.cpuTempCelsius}°C`
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {after?.cpuTempCelsius != null
                    ? `${after.cpuTempCelsius}°C`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-success">
                  {data?.diff.tempDeltaCelsius != null
                    ? `${data.diff.tempDeltaCelsius}°C`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-sans text-text-secondary">
                  Sistema Operacional
                </td>
                <td className="px-4 py-2.5">{before?.osVersion ?? '—'}</td>
                <td className="px-4 py-2.5">{after?.osVersion ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 space-y-3 lg:col-span-2">
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-accent">
            <Terminal className="h-3.5 w-3.5" />
            COLETOR WINDOWS SOMENTE-LEITURA
          </span>
          <p className="text-xs text-text-secondary">
            Execute no PowerShell do equipamento com consentimento do cliente para extrair CPU, RAM, Disco e SO sem instalar executável:
          </p>
          <pre className="overflow-x-auto rounded-xl border border-border bg-bg p-3 font-mono text-[10px] text-text-secondary">
            {POWERSHELL_COLLECTOR}
          </pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(POWERSHELL_COLLECTOR);
              setCopiedCmd(true);
              setTimeout(() => setCopiedCmd(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium hover:border-accent"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiedCmd ? 'Comando copiado!' : 'Copiar comando PowerShell'}
          </button>

          <div className="pt-2">
            <label className="block text-[11px] font-medium text-text-secondary">
              Colar JSON retornado pelo coletor (opcional):
            </label>
            <textarea
              rows={3}
              value={collectorJson}
              onChange={(e) => handleImportJson(e.target.value)}
              placeholder='{"cpuModel":"...","ramGb":16,...}'
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h4 className="font-display text-sm font-semibold">
            Registrar Snapshot de Hardware
          </h4>
          <form onSubmit={handleSave} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-text-secondary">Momento</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as 'BEFORE' | 'AFTER')}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="BEFORE">Entrada (Antes do reparo)</option>
                <option value="AFTER">Entrega (Depois do reparo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary">CPU</label>
              <input
                placeholder="Ex: Ryzen 5 5600 / Core i5-1235U"
                value={cpuModel}
                onChange={(e) => setCpuModel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary">RAM (GB)</label>
              <input
                type="number"
                placeholder="16"
                value={ramGb}
                onChange={(e) => setRamGb(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary">
                Armazenamento
              </label>
              <input
                placeholder="Ex: NVMe 1TB Kingston"
                value={storageSummary}
                onChange={(e) => setStorageSummary(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div>
                <label className="block text-[11px] text-text-secondary">
                  SMART (%)
                </label>
                <input
                  type="number"
                  placeholder="98"
                  value={smartHealthPct}
                  onChange={(e) => setSmartHealthPct(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-secondary">
                  Bateria (%)
                </label>
                <input
                  type="number"
                  placeholder="85"
                  value={batteryHealthPct}
                  onChange={(e) => setBatteryHealthPct(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-secondary">
                  Temp (°C)
                </label>
                <input
                  type="number"
                  placeholder="64"
                  value={cpuTempCelsius}
                  onChange={(e) => setCpuTempCelsius(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary">
                Sistema Operacional
              </label>
              <input
                placeholder="Windows 11 Pro 24H2"
                value={osVersion}
                onChange={(e) => setOsVersion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary">Notas</label>
              <input
                placeholder="Observações da coleta"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Snapshot Técnico'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
