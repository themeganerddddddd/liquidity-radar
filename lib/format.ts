import type { MoneyRange } from "../app/data";

export function money(value: number, digits = 1) {
  const absolute = Math.abs(value);
  const divisor =
    absolute >= 1_000_000_000
      ? 1_000_000_000
      : absolute >= 1_000_000
        ? 1_000_000
        : 1_000;
  const suffix =
    divisor === 1_000_000_000 ? "B" : divisor === 1_000_000 ? "M" : "K";
  return `${value < 0 ? "−" : ""}$${(absolute / divisor).toFixed(digits).replace(/\.0$/, "")}${suffix}`;
}

export function rangeMoney(range: MoneyRange) {
  return `${money(range.low)}–${money(range.high)}`;
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}
