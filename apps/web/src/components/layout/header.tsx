"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const nav = [
  { href: "/colleges", label: "Colleges" },
  { href: "/dorms", label: "Dorms" },
  { href: "/compare", label: "Compare" },
  { href: "/quiz", label: "Quiz" },
  { href: "/map", label: "Map" },
  { href: "/analytics", label: "Analytics" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Building2 className="h-6 w-6 text-primary" />
          DormScope
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "hover:text-primary transition-colors",
                pathname === item.href && "text-primary font-medium"
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/saved" className="hover:text-primary">
            Saved
          </Link>
          <Link href="/admin" className="text-muted-foreground hover:text-primary">
            Admin
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-2">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/saved" onClick={() => setOpen(false)}>Saved</Link>
          <Link href="/admin" onClick={() => setOpen(false)}>Admin</Link>
        </div>
      )}
    </header>
  );
}
