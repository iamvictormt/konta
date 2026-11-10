"use client";

import { useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import Icon from "../ui-icon";

export type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  id: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  variant?: "default" | "symbol";
  disabled?: boolean;
};

export default function CustomSelect({
  id,
  value,
  options,
  onChange,
  variant = "default",
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [placement, setPlacement] = useState<"above" | "below">("below");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];
  const listboxId = `${id}-listbox`;

  function openListbox(index = selectedIndex >= 0 ? selectedIndex : 0) {
    const bounds = triggerRef.current?.getBoundingClientRect();
    const menuHeight = Math.min(options.length, 5) * 44 + 8;
    if (bounds) {
      setPlacement(window.innerHeight - bounds.bottom < menuHeight ? "above" : "below");
    }
    setActiveIndex(Math.max(0, index));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setActiveIndex(index);
  }

  function moveActive(direction: -1 | 1) {
    if (options.length === 0) return;
    setActiveIndex((current) => {
      const start = current ?? (selectedIndex >= 0 ? selectedIndex : 0);
      return (start + direction + options.length) % options.length;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openListbox();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex ?? selectedIndex);
      else openListbox();
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const query = event.key.toLocaleLowerCase();
      const start = (activeIndex ?? selectedIndex) + 1;
      const matchIndex = [...options.keys()].map((offset) => (start + offset) % options.length)
        .find((index) => options[index].label.toLocaleLowerCase().startsWith(query));
      if (matchIndex !== undefined) {
        setActiveIndex(matchIndex);
        if (!open) openListbox(matchIndex);
      }
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  return (
    <div ref={rootRef} className={`custom-select custom-select--${variant}`} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        id={id}
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex !== null ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openListbox())}
        onKeyDown={handleKeyDown}
      >
        <span className="custom-select-value">{selectedOption?.label ?? "Seleccionar"}</span>
        <Icon className={`custom-select-chevron ${open ? "is-open" : ""}`} name="chevron" size={16} />
      </button>
      <div
        id={listboxId}
        className="custom-select-listbox"
        role="listbox"
        aria-labelledby={id}
        data-placement={placement}
        hidden={!open}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-option-${index}`}
            className={`custom-select-option ${index === activeIndex ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`}
            role="option"
            aria-selected={option.value === value}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <Icon name="check" size={15} />}
          </div>
        ))}
      </div>
    </div>
  );
}
