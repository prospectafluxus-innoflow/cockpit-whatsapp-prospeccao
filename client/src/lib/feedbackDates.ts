export function formatFeedbackDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string") {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (parts) {
      const [, year, month, day] = parts;
      const date = new Date(`${value}T12:00:00Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) ||
        date.getUTCDate() !== Number(day)
      )
        return "—";
      return `${day}/${month}/${year}`;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}
