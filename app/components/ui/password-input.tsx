"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import Icon from "../ui-icon";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & { id: string };

export default function PasswordInput({ id, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar senha" : "Mostrar senha";

  return (
    <div className="password-input">
      <input {...props} id={id} disabled={disabled} type={visible ? "text" : "password"} />
      <button
        className="password-visibility"
        type="button"
        aria-label={label}
        aria-controls={id}
        title={label}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={19} />
      </button>
    </div>
  );
}
