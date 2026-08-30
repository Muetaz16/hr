import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import Modal from './Modal';

export interface PromptOptions {
    title?: string;
    message?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    defaultValue?: string;
    required?: boolean;   // when true, OK stays disabled until the field is non-empty
    multiline?: boolean;  // render a textarea instead of a single-line input
}

// Resolves to the entered string on OK (may be empty when not required), or null on Cancel/close —
// same semantics as window.prompt(), so callers can branch on `=== null` to mean "cancelled".
type PromptFn = (opts: PromptOptions | string) => Promise<string | null>;

const PromptContext = createContext<PromptFn>(async () => null);

// In-app replacement for window.prompt(). Returns a promise resolving to the text or null.
export const usePrompt = () => useContext(PromptContext);

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [opts, setOpts] = useState<PromptOptions>({});
    const [value, setValue] = useState('');
    const resolver = useRef<((v: string | null) => void) | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    const prompt = useCallback<PromptFn>((input) => {
        const normalized: PromptOptions = typeof input === 'string' ? { message: input } : input;
        setOpts(normalized);
        setValue(normalized.defaultValue || '');
        setOpen(true);
        return new Promise<string | null>((resolve) => { resolver.current = resolve; });
    }, []);

    const settle = (result: string | null) => {
        resolver.current?.(result);
        resolver.current = null;
        setOpen(false);
    };

    // Focus (and select) the field once the dialog has opened.
    useEffect(() => {
        if (open) {
            const id = window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, 60);
            return () => window.clearTimeout(id);
        }
    }, [open]);

    const canSubmit = !opts.required || value.trim().length > 0;
    const submit = () => { if (canSubmit) settle(value); };

    return (
        <PromptContext.Provider value={prompt}>
            {children}
            <Modal isOpen={open} onClose={() => settle(null)} title={opts.title || t('please_enter', { defaultValue: 'Please Enter' })} maxWidth="max-w-md">
                <div className="space-y-6 py-1">
                    <div className="flex items-start gap-4">
                        <div className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600">
                            <MessageSquare size={22} />
                        </div>
                        <div className="flex-1 space-y-3 pt-0.5">
                            {opts.message && (
                                <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-line">{opts.message}</p>
                            )}
                            {opts.multiline ? (
                                <textarea
                                    ref={el => { inputRef.current = el; }}
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder={opts.placeholder}
                                    rows={4}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none resize-none"
                                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
                                />
                            ) : (
                                <input
                                    ref={el => { inputRef.current = el; }}
                                    type="text"
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder={opts.placeholder}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => settle(null)}
                            className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                        >
                            {opts.cancelText || t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button
                            onClick={submit}
                            disabled={!canSubmit}
                            className="flex-[2] py-3 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {opts.confirmText || t('ok', { defaultValue: 'OK' })}
                        </button>
                    </div>
                </div>
            </Modal>
        </PromptContext.Provider>
    );
};

export default PromptProvider;
