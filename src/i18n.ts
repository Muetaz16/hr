import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: false, // Set to true for development debugging
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
            // The translation file is fetched over HTTP like any other asset, so the browser
            // caches it — and a stale copy is indistinguishable from a missing translation: the
            // key silently falls back to its English defaultValue inside an Arabic page. This has
            // already cost real debugging time more than once.
            //
            // In development every reload gets a fresh copy, because that is when keys are being
            // added. In a build the id is fixed at build time, so a deploy invalidates the cache
            // exactly once and repeat visits still benefit from it.
            queryStringParams: { v: import.meta.env.DEV ? String(Date.now()) : __I18N_BUILD_ID__ },
        },
    });

export default i18n;
