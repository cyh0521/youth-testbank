export const TEXTBANK_SOURCES = ['static', 'firestore'];

export function resolveTextbankSource(data, fallback = 'static') {
  return TEXTBANK_SOURCES.includes(data?.mode) ? data.mode : fallback;
}
