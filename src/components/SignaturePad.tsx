import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser, Save, Trash2 } from 'lucide-react';

interface SignaturePadProps {
    /** Existing signature (PNG data URL) to pre-load into the pad, if any. */
    initialValue?: string | null;
    /** Called with the drawn PNG data URL, or null to remove the signature. */
    onSave: (dataUrl: string | null) => void | Promise<void>;
    onCancel?: () => void;
    saving?: boolean;
}

const STROKE_COLOR = '#1e293b';
const STROKE_WIDTH = 2.5;

const SignaturePad: React.FC<SignaturePadProps> = ({ initialValue, onSave, onCancel, saving }) => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(!initialValue);

    // Size the canvas backing store to its display size × devicePixelRatio for
    // crisp strokes, then (re)load any existing signature so it can be edited.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ratio = window.devicePixelRatio || 1;
        // Use the layout box (clientWidth/Height) rather than getBoundingClientRect
        // so a parent CSS transform (e.g. the modal's open animation) can't skew sizing.
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;

        if (initialValue) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, width, height);
            img.src = initialValue;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        lastPoint.current = pointFromEvent(e);
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !lastPoint.current) return;
        const p = pointFromEvent(e);
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastPoint.current = p;
        if (isEmpty) setIsEmpty(false);
    };

    const endDraw = () => {
        drawing.current = false;
        lastPoint.current = null;
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas || isEmpty) return;
        onSave(canvas.toDataURL('image/png'));
    };

    return (
        <div className="space-y-5">
            <p className="text-sm text-slate-500 font-medium">
                {t('signature_pad_hint', { defaultValue: 'Draw your signature below using your mouse or finger. It will be used on approval forms.' })}
            </p>

            <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-52 touch-none cursor-crosshair block"
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    onPointerCancel={endDraw}
                />
                {isEmpty && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                        {t('sign_here', { defaultValue: 'Sign here' })}
                    </span>
                )}
                {/* Baseline guide */}
                <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-slate-200" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={clear}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        <Eraser className="w-4 h-4" />
                        {t('clear', { defaultValue: 'Clear' })}
                    </button>
                    {initialValue && (
                        <button
                            type="button"
                            onClick={() => onSave(null)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('remove', { defaultValue: 'Remove' })}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isEmpty || saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#541c2c] text-white font-bold text-sm hover:bg-[#3d1420] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? t('saving', { defaultValue: 'Saving…' }) : t('save_signature', { defaultValue: 'Save Signature' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignaturePad;
