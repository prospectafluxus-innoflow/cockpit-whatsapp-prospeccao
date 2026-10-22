export const REMINDER_TIME_ZONE = "America/Sao_Paulo";

export type ReminderWindow = "morning" | "lunch" | "afternoon" | "evening";

export type SaoPauloLocalParts = {
  localDate: string;
  hour: number;
  minute: number;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REMINDER_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function getSaoPauloLocalParts(now: Date): SaoPauloLocalParts {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("A data do lembrete é inválida.");
  }

  const values = Object.fromEntries(
    formatter.formatToParts(now)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  ) as Record<string, string>;

  // Alguns runtimes representam meia-noite como 24 quando hour12=false.
  const hour = Number(values.hour) % 24;
  return {
    localDate: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute: Number(values.minute),
  };
}

export function getSaoPauloDateKey(now: Date): string {
  return getSaoPauloLocalParts(now).localDate;
}

export function isSaoPauloMinuteZero(now: Date): boolean {
  return getSaoPauloLocalParts(now).minute === 0;
}
