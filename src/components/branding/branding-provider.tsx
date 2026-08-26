"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  BRAND_STORAGE_KEY,
  getBrandPreset,
  isBrandId,
  type BrandId,
  type BrandPreset,
} from "@/lib/branding";

interface BrandingContextValue {
  brandId: BrandId;
  brand: BrandPreset;
  setBrandId: (id: BrandId) => void;
  ready: boolean;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brandId, setBrandIdState] = useState<BrandId>("book-to-roam");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const stored = localStorage.getItem(BRAND_STORAGE_KEY);
        if (isBrandId(stored)) {
          if (!cancelled) setBrandIdState(stored);
        }

        // Sync cookie with localStorage so server APIs use the same brand.
        if (isBrandId(stored)) {
          await fetch("/api/crm/brand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brandId: stored }),
          }).catch(() => null);
        }
      } catch {
        // Keep default brand if hydrate fails.
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.brand = brandId;
    return () => {
      delete document.documentElement.dataset.brand;
    };
  }, [brandId]);

  const setBrandId = useCallback((id: BrandId) => {
    setBrandIdState(id);
    localStorage.setItem(BRAND_STORAGE_KEY, id);
    const preset = getBrandPreset(id);

    void fetch("/api/crm/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not update brand");
        }
        toast.success(`Switched to ${preset.label} — showing that brand's data only`);
        // Full reload so all lists/APIs load the other brand's records.
        window.location.reload();
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not update brand");
      });
  }, []);

  const value = useMemo(
    () => ({
      brandId,
      brand: getBrandPreset(brandId),
      setBrandId,
      ready,
    }),
    [brandId, setBrandId, ready]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within BrandingProvider");
  }
  return ctx;
}
