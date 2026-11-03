// Settings saved on this phone only (localStorage). Wrapped in try/catch for private browsing.
export const store = {
  get(key: string, fallback: string) {
    try { return localStorage.getItem(`hollow.${key}`) ?? fallback; } catch { return fallback; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(`hollow.${key}`, value); } catch { /* storage unavailable */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(`hollow.${key}`); } catch { /* storage unavailable */ }
  },
};
