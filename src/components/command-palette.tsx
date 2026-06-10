"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plane, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchResult {
  bookings: { id: string; publicRef: string; pnr: string | null; customer: { name: string } }[];
  customers: { id: string; name: string; phone: string }[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ bookings: [], customers: [] });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({ bookings: [], customers: [] });
      return;
    }
    const res = await fetch(`/api/crm/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function navigate(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
        <span className="text-muted-foreground">Search...</span>
        <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="Search bookings, customers, PNR..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.bookings.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Bookings</p>
                {results.bookings.map((b) => (
                  <button
                    key={b.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                    onClick={() => navigate(`/bookings/${b.id}`)}
                  >
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{b.publicRef}</span>
                    <span className="text-muted-foreground">{b.customer.name}</span>
                    {b.pnr && <span className="ml-auto text-xs text-muted-foreground">{b.pnr}</span>}
                  </button>
                ))}
              </div>
            )}
            {results.customers.length > 0 && (
              <div>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Customers</p>
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && results.bookings.length === 0 && results.customers.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No results found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
