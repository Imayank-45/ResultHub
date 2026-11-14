const HEADLESS_MODE_KEY = 'resultai_headless_mode';

export function getHeadlessMode() {
  const saved = sessionStorage.getItem(HEADLESS_MODE_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

export function setHeadlessMode(enabled) {
  sessionStorage.setItem(HEADLESS_MODE_KEY, String(enabled));
}
