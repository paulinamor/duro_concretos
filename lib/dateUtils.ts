const TZ = "America/Monterrey";
const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const FMT_MONTH = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });

/** YYYY-MM-DD for today in Monterrey time (never UTC). */
export function todayCST(): string {
  return FMT.format(new Date());
}

/** YYYY-MM-DD for an arbitrary Date in Monterrey time. */
export function localISODate(d: Date): string {
  return FMT.format(d);
}

/** YYYY-MM for the current month in Monterrey time. */
export function currentMonthCST(): string {
  return FMT_MONTH.format(new Date()).slice(0, 7);
}
