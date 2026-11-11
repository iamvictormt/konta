import Icon from "../../ui-icon";

export function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? "Expandir menu lateral" : "Recolher menu lateral";

  return <button
    className="sidebar-toggle"
    type="button"
    aria-label={label}
    aria-controls="primary-navigation"
    aria-expanded={!collapsed}
    title={label}
    onClick={onToggle}
  >
    <Icon className={`sidebar-toggle-icon ${collapsed ? "is-collapsed" : ""}`} name="chevron" size={17} />
  </button>;
}
