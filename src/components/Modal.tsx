import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) setShouldRender(true);
    }, [isOpen]);

    const handleAnimationEnd = () => {
        if (!isOpen) setShouldRender(false);
    };

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${isOpen ? 'bg-slate-900/40 backdrop-blur-sm opacity-100' : 'bg-slate-900/0 backdrop-blur-none opacity-0 pointer-events-none'
                }`}
            onClick={onClose}
            onTransitionEnd={handleAnimationEnd}
        >
            <div
                className={`bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 transform transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xl font-outfit font-bold text-slate-800">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-8 max-h-[85vh] overflow-y-auto scroll-smooth">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
