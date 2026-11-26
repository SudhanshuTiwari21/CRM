"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRY_DIAL_CODES,
  findCountryByIso2,
  joinPhoneWithCountry,
  splitPhoneWithCountry,
} from "@/lib/country-dial-codes";
import { cn } from "@/lib/utils";

type PhoneWithCountryProps = {
  value?: string | null;
  onChange: (fullPhone: string) => void;
  defaultCountryIso2?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export function PhoneWithCountry({
  value,
  onChange,
  defaultCountryIso2 = "IN",
  placeholder = "Phone number",
  id,
  disabled,
  className,
}: PhoneWithCountryProps) {
  const initial = useMemo(
    () => splitPhoneWithCountry(value, defaultCountryIso2),
    // Only seed from value when mounting / external value identity changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value]
  );

  const [iso2, setIso2] = useState(initial.iso2);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const next = splitPhoneWithCountry(value, defaultCountryIso2);
    const currentFull = joinPhoneWithCountry(
      findCountryByIso2(iso2)?.dial || initial.dial,
      national
    );
    const incoming = (value || "").trim();
    if (incoming === currentFull) return;
    setIso2(next.iso2);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = findCountryByIso2(iso2) || COUNTRY_DIAL_CODES[0];

  function emit(nextIso2: string, nextNational: string) {
    const dial = findCountryByIso2(nextIso2)?.dial || country.dial;
    onChange(joinPhoneWithCountry(dial, nextNational));
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={iso2}
        disabled={disabled}
        onValueChange={(next) => {
          setIso2(next);
          emit(next, national);
        }}
      >
        <SelectTrigger className="w-[118px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5 truncate">
              <span aria-hidden>{country.flag}</span>
              <span>+{country.dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRY_DIAL_CODES.map((c) => (
            <SelectItem key={`${c.iso2}-${c.dial}`} value={c.iso2}>
              <span className="flex items-center gap-2">
                <span aria-hidden>{c.flag}</span>
                <span className="font-medium">+{c.dial}</span>
                <span className="text-muted-foreground">{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        value={national}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d\s-]/g, "");
          setNational(next);
          emit(iso2, next);
        }}
        className="flex-1"
      />
    </div>
  );
}
