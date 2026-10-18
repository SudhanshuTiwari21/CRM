"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CityOption = {
  id: string;
  city: string;
  country: string;
  state: string;
  label: string;
};

export function CityAutocomplete({
  value,
  onChange,
  onSelectCity,
  placeholder = "Start typing a city…",
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectCity?: (city: CityOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/crm/cities/autocomplete?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => setOptions(Array.isArray(data.cities) ? data.cities : []))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange(opt.city);
                onSelectCity?.(opt);
                setQuery(opt.city);
                setOpen(false);
              }}
            >
              <span className="font-medium">{opt.city}</span>
              <span className="text-xs text-muted-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
