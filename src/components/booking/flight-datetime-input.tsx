"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  normalizeFlightDateTime,
  parseFlightDateTime,
  toDatetimeLocalValue,
  toFlightDateTimeInputDisplay,
} from "@/lib/flight-datetime";

interface FlightDateTimeInputProps {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Text datetime field agents can type into (DD/MM/YYYY, HH:mm),
 * with an optional native picker for calendar selection.
 * Stores wall-clock values as YYYY-MM-DDTHH:mm.
 */
export function FlightDateTimeInput({
  value = "",
  onChange,
  onBlur,
  name,
  id,
  className,
  placeholder = "DD/MM/YYYY, HH:mm",
  disabled,
}: FlightDateTimeInputProps) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toFlightDateTimeInputDisplay(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(toFlightDateTimeInputDisplay(value));
    setInvalid(false);
  }, [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      onChange("");
      setText("");
      return;
    }

    const normalized = normalizeFlightDateTime(trimmed);
    const parsed = parseFlightDateTime(normalized);
    if (!parsed) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    onChange(normalized);
    setText(toFlightDateTimeInputDisplay(normalized));
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onBlur={() => {
          commit(text);
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn("pr-9", invalid && "border-destructive focus-visible:ring-destructive")}
      />
      <button
        type="button"
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        aria-label="Open date picker"
        onClick={() => {
          const el = pickerRef.current;
          if (!el) return;
          try {
            el.showPicker?.();
          } catch {
            el.click();
          }
        }}
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        id={pickerId}
        type="datetime-local"
        step={60}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        value={toDatetimeLocalValue(value)}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) {
            onChange("");
            setText("");
            return;
          }
          const normalized = normalizeFlightDateTime(next);
          onChange(normalized);
          setText(toFlightDateTimeInputDisplay(normalized));
          setInvalid(false);
        }}
      />
      {invalid ? (
        <p className="mt-1 text-xs text-destructive">Use DD/MM/YYYY, HH:mm (e.g. 11/08/2025, 15:26)</p>
      ) : null}
    </div>
  );
}
