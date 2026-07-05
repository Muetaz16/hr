import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ar' : 'en';
        i18n.changeLanguage(newLang);
    };

    useEffect(() => {
        document.body.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-bold text-slate-700 hover:bg-white hover:shadow-md transition-all"
            title={i18n.language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
            <Globe className="w-4 h-4 text-blue-600" />
            <span>{i18n.language === 'en' ? 'العربية' : 'English'}</span>
        </button>
    );
};

export default LanguageSwitcher;
