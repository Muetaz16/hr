import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean; // true → red confirm button (destructive); default true
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

// In-app replacement for window.confirm(). Returns a promise that resolves true/false.
export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [opts, setOpts] = useState<ConfirmOptions>({ message: '' });
    const resolver = useRef<((v: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((input) => {
        const normalized: ConfirmOptions = typeof input === 'string' ? { message: input } : input;
        setOpts(normalized);
        setOpen(true);
        return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    }, []);

    const settle = (value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setOpen(false);
    };

    const danger = opts.danger !== false; // default to destructive styling

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal isOpen={open} onClose={() => settle(false)} title={opts.title || t('please_confirm', { defaultValue: 'Please Confirm' })} maxWidth="max-w-md">
                <div className="space-y-6 py-1">
                    <div className="flex items-start gap-4">
                        <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            <AlertTriangle size={22} />
                        </div>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed pt-1.5 whitespace-pre-line">{opts.message}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => settle(false)}
                            className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                        >
                            {opts.cancelText || t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button
                            onClick={() => settle(true)}
                            autoFocus
                            className={`flex-[2] py-3 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {opts.confirmText || t('confirm', { defaultValue: 'Confirm' })}
                        </button>
                    </div>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
};

export default ConfirmProvider;
