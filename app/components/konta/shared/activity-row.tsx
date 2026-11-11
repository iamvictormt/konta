import Icon from "../../ui-icon";
import { dayLabel, money } from "../format";
import type { Activity } from "../types";

export function ActivityRow({ item }: { item: Activity }) {
  return <div className={`activity-row ${item.kind === "expense" ? "expense" : ""}`}><span className="activity-icon"><Icon name={item.kind === "sale" ? "cart" : "receipt"} size={17} /></span><span className="activity-copy"><strong>{item.title}</strong><span>{item.detail} · {dayLabel(new Date(item.createdAt), { hour: "2-digit", minute: "2-digit" })}</span></span><strong className={`activity-amount ${item.kind === "expense" ? "negative" : ""}`}>{item.kind === "expense" ? "−" : "+"}{money(item.amount)}</strong></div>;
}
