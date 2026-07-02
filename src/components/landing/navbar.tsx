import Link from "next/link";
import { Eye } from "lucide-react";
import { AuthButtons } from "@/components/auth/clerk-wrappers";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
            <Eye className="h-4 w-4 text-white" />
          </div>
          <span className="gradient-text">WatchFlow AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="/#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-foreground transition-colors">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthButtons signUpClassName="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" />
        </div>
      </div>
    </header>
  );
}
