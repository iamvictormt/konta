import type { ReactNode } from "react";
import Icon from "../../ui-icon";

export function Modal({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="modal-close" type="button" aria-label="Fechar" onClick={onClose}><Icon name="close" size={16} /></button></div>{children}</section></div>;
}
