"use client";

import { useEffect, useRef } from "react";
import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from "react";

type MaskedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "min" | "max" | "step"
> & {
  value: string;
  onValueChange: (value: string) => void;
  minValue?: number;
  maxValue?: number;
};

export function formatMaskedInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function validationMessage(value: string, minValue?: number, maxValue?: number) {
  if (value === "") return "";

  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) return "Introduza um valor inteiro válido.";
  if (minValue !== undefined && amount < minValue) {
    return `O valor mínimo é ${formatMaskedInteger(String(minValue))}.`;
  }
  if (maxValue !== undefined && amount > maxValue) {
    return `O valor máximo é ${formatMaskedInteger(String(maxValue))}.`;
  }

  return "";
}

function caretAfterDigitCount(displayValue: string, digitCount: number) {
  if (digitCount <= 0) return 0;

  let digitsFound = 0;
  for (let index = 0; index < displayValue.length; index += 1) {
    if (/\d/.test(displayValue[index])) digitsFound += 1;
    if (digitsFound >= digitCount) return index + 1;
  }

  return displayValue.length;
}

export default function MaskedNumberInput({
  value,
  onValueChange,
  minValue,
  maxValue,
  onBlur,
  onFocus,
  ...inputProps
}: MaskedNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const invalid = validationMessage(value, minValue, maxValue) !== "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(validationMessage(value, minValue, maxValue));
  }, [value, minValue, maxValue]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const currentValue = input.value;
    const cursor = input.selectionStart ?? currentValue.length;
    const digitsBeforeCursor = currentValue.slice(0, cursor).replace(/\D/g, "").length;
    const digits = currentValue.replace(/\D/g, "");
    const leadingZeroCount = digits.match(/^0+(?=\d)/)?.[0].length ?? 0;
    const nextValue = digits.replace(/^0+(?=\d)/, "");
    const nextCursorDigitCount = Math.max(0, digitsBeforeCursor - leadingZeroCount);

    input.setCustomValidity(validationMessage(nextValue, minValue, maxValue));
    onValueChange(nextValue);

    window.requestAnimationFrame(() => {
      const currentInput = inputRef.current;
      if (!currentInput || document.activeElement !== currentInput) return;
      const nextDisplayValue = formatMaskedInteger(nextValue);
      const nextCursor = caretAfterDigitCount(nextDisplayValue, nextCursorDigitCount);
      currentInput.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    inputRef.current?.setCustomValidity(validationMessage(value, minValue, maxValue));
    onBlur?.(event);
  }

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9.]*"
      value={formatMaskedInteger(value)}
      aria-invalid={invalid ? "true" : inputProps["aria-invalid"]}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      autoComplete={inputProps.autoComplete ?? "off"}
      spellCheck={false}
    />
  );
}
