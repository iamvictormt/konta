import Icon, { type IconName } from "../../ui-icon";
import { dayLabel, money } from "../format";
import type { Activity } from "../types";

export function ActivityRow({ item, icon, showSign = true }: { item: Activity; icon?: IconName; showSign?: boolean }) {
  const expense = item.kind === "expense";
  const sign = showSign ? (expense ? "−" : "+") : "";
  return <div className={`activity-row ${expense ? "expense" : ""}`}>
    <span className="activity-icon"><Icon name={icon ?? (expense ? "receipt" : "cart")} size={17} /></span>
    <span className="activity-copy"><strong>{item.title}</strong><span>{item.detail} · {dayLabel(new Date(item.createdAt), { hour: "2-digit", minute: "2-digit" })}</span></span>
    <strong className={`activity-amount ${expense ? "negative" : ""}`}>{sign}{money(item.amount)}</strong>
  </div>;
}
