import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Icon from "../../ui-icon";

const MOBILE_QUERY = "(max-width: 650px)";

/** Estado do menu lateral deslizante no telemóvel: Esc fecha, a página não rola por baixo e o menu fecha ao voltar ao desktop. */
export function useMobileDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    function closeOnDesktop() {
      if (!mediaQuery.matches) setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      mediaQuery.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return { open, setOpen };
}

type MobileHeaderProps = {
  menuOpen: boolean;
  onMenuToggle: () => void;
  /** Controlos à direita (por exemplo, o seletor de módulo). */
  children?: ReactNode;
};

/** Cabeçalho fixo do telemóvel: botão do menu, logo ao centro e controlos à direita, sobre o verde do menu lateral. */
export function MobileHeader({ menuOpen, onMenuToggle, children }: MobileHeaderProps) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-side">
        <button className="mobile-menu-button" type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={onMenuToggle}>
          <Icon name="menu" size={22} />
        </button>
      </div>
      <div className="brand-logo-frame mobile-header-logo">
        <Image src="/images/konta-logo.svg" alt="Kontá" width={1152} height={512} sizes="132px" loading="eager" />
      </div>
      <div className="mobile-header-side mobile-header-side--end">{children}</div>
    </header>
  );
}
