import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
    fullScreen?: boolean; // render as a full page instead of a centered dialog
    fullScreenWidth?: string; // content max-width when fullScreen (default max-w-4xl)
    headerActions?: React.ReactNode; // extra controls rendered in the header (e.g. Edit/Save)
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl', fullScreen = false, fullScreenWidth = 'max-w-4xl', headerActions }) => {
    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) setShouldRender(true);
    }, [isOpen]);

    const handleAnimationEnd = () => {
        if (!isOpen) setShouldRender(false);
    };

    if (!shouldRender) return null;

    // Full-page variant — an opaque page that takes over the viewport (no popup dialog).
    if (fullScreen) {
        return createPortal(
            <div
                className={`fixed inset-0 z-50 bg-slate-50 overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onTransitionEnd={handleAnimationEnd}
            >
                <div className="min-h-full flex flex-col">
                    <div className="sticky top-0 z-10 flex justify-between items-center gap-4 px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-100 bg-white/90 backdrop-blur-md">
                        <h3 className="text-xl sm:text-2xl font-outfit font-black text-slate-800 pr-2 truncate">{title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                            {headerActions}
                            <button
                                onClick={onClose}
                                className="shrink-0 p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <div className={`flex-1 w-full ${fullScreenWidth} mx-auto p-4 sm:p-8`}>
                        {children}
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto transition-all duration-300 ${isOpen ? 'bg-slate-900/40 backdrop-blur-sm opacity-100' : 'bg-slate-900/0 backdrop-blur-none opacity-0 pointer-events-none'
                }`}
            onClick={onClose}
            onTransitionEnd={handleAnimationEnd}
        >
            <div
                className={`bg-white rounded-[32px] shadow-2xl w-full ${maxWidth} my-auto max-h-[92vh] flex flex-col overflow-hidden border border-white/20 transform transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="shrink-0 flex justify-between items-center px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg sm:text-xl font-outfit font-bold text-slate-800 pr-4 truncate">{title}</h3>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content — scrolls internally so the modal always fits the viewport and stays centered */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth p-6 sm:p-8">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
