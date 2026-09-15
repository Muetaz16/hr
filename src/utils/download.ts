/**
 * Hands a generated file to the browser.
 *
 * Extracted because this exact function was copy-pasted into five components and inlined in about
 * fifteen more, with the canonical copy living oddly inside a payroll component. The variants had
 * drifted — some used `window.URL`, some appended to the document body first, some never revoked
 * the object URL and leaked the blob for the life of the tab.
 */
export const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * A filename fragment safe on every filesystem, matching what the payroll exports already produce.
 * Arabic and any other non-Latin text collapses to underscores, so callers should pass the Latin
 * name where one exists rather than relying on this to transliterate — it cannot.
 */
export const safeFilePart = (value: string): string =>
    (value || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'export';
