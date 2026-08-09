"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const nav = [
  { href: "/colleges", label: "Explore" },
  { href: "/match", label: "Match" },
  { href: "/compare", label: "Compare" },
  { href: "/saved", label: "Saved" },
  { href: "/#how-it-works", label: "How it works" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href.startsWith("/#")) return pathname === "/";
    if (href === "/colleges") return pathname.startsWith("/colleges");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="site-container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl tracking-tight text-forest sm:text-2xl">
          DormScope
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive(item.href) && "font-medium text-primary"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/match" className="hidden sm:block">
            <Button size="sm" className="font-medium">
              Find My Best Dorm
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-border/70 lg:hidden">
          <nav className="site-container flex flex-col gap-1 py-3" aria-label="Mobile">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm",
                  isActive(item.href) ? "bg-accent font-medium text-primary" : "text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/match" onClick={() => setOpen(false)} className="mt-2">
              <Button className="w-full">Find My Best Dorm</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
