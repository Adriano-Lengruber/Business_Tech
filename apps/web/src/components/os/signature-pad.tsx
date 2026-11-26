'use client';

import { useRef, useState } from 'react';
import { Check, Eraser, PenTool } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export function SignaturePadCard({
  osId,
  existingSignature,
  signedAt,
  onSaved,
}: {
  osId: string;
  existingSignature?: string | null;
  signedAt?: string | null;
  onSaved: () => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [saving, setSaving] = useState(false);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#14B8A6';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasStroke(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  async function saveSignature() {
    const canvas = canvasRef.current;
    const token = window.localStorage.getItem('al_token');
    if (!canvas || !token || !hasStroke) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await apiFetch(`/service-orders/${osId}/signature`, {
        method: 'POST',
        token,
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <PenTool className="h-3.5 w-3.5 text-accent" />
          Assinatura Digital (Balcão)
        </span>
        {signedAt && (
          <span className="font-mono text-[10px] text-success">
            {new Date(signedAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {existingSignature ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-bg p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingSignature}
              alt="Assinatura do cliente"
              className="mx-auto h-20 object-contain"
            />
          </div>
          <p className="text-[11px] text-text-muted">
            Assinatura coletada e auditada na ordem de serviço.
          </p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={340}
            height={110}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full touch-none rounded-xl border border-dashed border-border bg-bg cursor-crosshair"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary"
            >
              <Eraser className="h-3 w-3" />
              Limpar
            </button>
            <button
              type="button"
              disabled={!hasStroke || saving}
              onClick={() => void saveSignature()}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
              {saving ? 'Salvando...' : 'Confirmar Assinatura'}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
