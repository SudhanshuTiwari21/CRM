"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, splitCustomerName } from "@/lib/utils";
import { parseApiResponse } from "@/lib/parse-api-response";

export type CustomerSuggestion = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  pan: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  type: string;
};

export type CustomerProfileFill = {
  title?: string;
  name: string;
  phone: string;
  email?: string;
  pan?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  customerId?: string;
};

function toProfileFill(c: CustomerSuggestion): CustomerProfileFill {
  const { title, name } = splitCustomerName(c.name);
  return {
    title,
    name,
    phone: c.phone || "",
    email: c.email || "",
    pan: c.pan || "",
    gstin: c.gstin || "",
    address: c.address || "",
    city: c.city || "",
    state: c.state || "",
    pincode: c.pincode || "",
    customerId: c.id,
  };
}

export function CustomerNameAutocomplete({
  value,
  onChange,
  onSelectCustomer,
  placeholder = "Full name (without title)",
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (profile: CustomerProfileFill) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<CustomerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

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
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search: q, limit: "12", page: "1" });
        const res = await fetch(`/api/crm/customers?${params}`, { credentials: "include" });
        const { ok, data } = await parseApiResponse(res);
        setOptions(ok ? ((data.customers as CustomerSuggestion[]) || []) : []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={wrapRef} className={cn("relative flex-1", className)}>
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoComplete="off"
          onFocus={() => {
            if (options.length > 0) setOpen(true);
          }}
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
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                const profile = toProfileFill(opt);
                skipNextSearch.current = true;
                setQuery(profile.name);
                onChange(profile.name);
                onSelectCustomer?.(profile);
                setOptions([]);
                setOpen(false);
              }}
            >
              <span className="font-medium">{opt.name}</span>
              <span className="text-xs text-muted-foreground">
                {[opt.phone, opt.email, opt.gstin].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
