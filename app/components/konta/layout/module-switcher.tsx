import { useId, useRef, useState, type MouseEvent } from "react";
import { STORE_MODULES, STORE_MODULE_ROUTES, type StoreModuleId } from "../../../lib/store-modules";
import Icon from "../../ui-icon";

type ModuleSwitcherProps = {
  enabledModules: StoreModuleId[];
  currentModule: StoreModuleId;
  onNavigate: (moduleId: StoreModuleId) => void;
};

export function ModuleSwitcher({ enabledModules, currentModule, onNavigate }: ModuleSwitcherProps) {
  const [menuOpen, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = STORE_MODULES.find((item) => item.id === currentModule);
  const allowed = STORE_MODULES.filter((item) => enabledModules.includes(item.id));
  const canSwitch = allowed.some((item) => item.id !== currentModule);
  const open = canSwitch && menuOpen;

  function followModule(event: MouseEvent<HTMLAnchorElement>, moduleId: StoreModuleId) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(false);
    onNavigate(moduleId);
  }

  return <div className="module-switcher" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }}>
    <button ref={buttonRef} className="module-switcher-trigger" type="button" disabled={!canSwitch} aria-label={current?.label} aria-expanded={canSwitch ? open : undefined} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)}>
      <Icon name="store" size={19} />
      <span><small>Módulo</small><strong>{current?.label}</strong></span>
      {canSwitch && <Icon name="chevron" size={17} />}
    </button>
    {open && <div id={menuId} className="module-switcher-menu">
      <p>Os seus módulos</p>
      <ul>{allowed.map((item) => <li key={item.id}>
        <a href={STORE_MODULE_ROUTES[item.id]} aria-current={item.id === currentModule ? "page" : undefined} onClick={(event) => followModule(event, item.id)}>
          <span><strong>{item.label}</strong>{item.id !== "commerce" && <small>Em desenvolvimento</small>}</span>
          {item.id === currentModule && <Icon name="check" size={17} />}
        </a>
      </li>)}</ul>
    </div>}
  </div>;
}
