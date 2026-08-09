import Link from "next/link";

const legal = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/how-rankings-work", label: "How rankings work" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/80 bg-secondary/40">
      <div className="site-container py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-md space-y-3">
            <p className="font-display text-2xl text-forest">DormScope</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Independent dorm intelligence for students. We are not affiliated with any university.
              Always verify costs, eligibility, and policies with your school&apos;s official housing office.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            {legal.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} DormScope. Public sources only — data may be incomplete.
        </p>
      </div>
    </footer>
  );
}
