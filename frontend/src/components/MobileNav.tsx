"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar, type AppSidebarProps } from "@/components/AppSidebar";
import { Menu } from "lucide-react";

interface MobileNavProps extends Omit<AppSidebarProps, "variant" | "onNavigate"> {
  /** Optional right-side content (e.g., preview selector) */
  rightContent?: React.ReactNode;
}

export function MobileNav({ rightContent, ...sidebarProps }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="md:hidden h-14 flex items-center justify-between px-4 bg-clinical-panel border-b border-clinical-border shrink-0">
      {/* Hamburger + Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="flex items-center justify-center w-10 h-10 rounded-lg text-clinical-text hover:bg-clinical-surface transition-all cursor-pointer"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 w-[280px] bg-clinical-panel border-clinical-border"
          showCloseButton={true}
        >
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <AppSidebar
            {...sidebarProps}
            variant="mobile"
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Center: Company info */}
      <div className="flex items-center gap-2">
        {sidebarProps.companyLogo ? (
          <img src={sidebarProps.companyLogo} alt={sidebarProps.companyName || "Empresa"} className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-sm font-bold text-clinical-teal uppercase tracking-wide">
            {sidebarProps.companyName || "InformeAI"}
          </span>
        )}
      </div>

      {/* Right: Optional content */}
      <div className="flex items-center">
        {rightContent || <div className="w-10" />}
      </div>
    </header>
  );
}
