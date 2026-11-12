import type { ReactNode } from "react";

export function PageHeading({ title, subtitle, children, className }: { title: string; subtitle: string; children?: ReactNode; className?: string }) {
  return <div className={className ? `page-heading ${className}` : "page-heading"}><div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
