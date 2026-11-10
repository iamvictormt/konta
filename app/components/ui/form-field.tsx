import type { ReactNode } from "react";

type FormFieldProps = {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
};

export default function FormField({ id, label, className, children }: FormFieldProps) {
  return (
    <div className={className ? `form-field ${className}` : "form-field"}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
