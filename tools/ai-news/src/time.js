/** タイムゾーンを固定した日付・時刻の整形ヘルパ */

/** YYYY-MM-DD */
export function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** HH:MM */
export function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

/** YYYY-MM-DD HH:MM */
export function formatDateTime(date, timeZone) {
  return `${formatDate(date, timeZone)} ${formatTime(date, timeZone)}`;
}

/** --date で渡された YYYY-MM-DD を検証する */
export function parseDateOption(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`--date は YYYY-MM-DD 形式で指定してください: ${value}`);
  }
  return value;
}
