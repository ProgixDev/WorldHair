"use client";

import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { THEME_VARIANTS, useTheme } from "@/contexts/ThemeContext";
import { Palette } from "lucide-react";

/**
 * Mirrors mobile's ThemeVariantPreview — a swatch (that variant's own
 * `--primary`, read live once its `data-theme` is applied) next to the name,
 * so picking a palette doesn't require switching to it first to see it.
 */
export function VariantSelector() {
  const { variantId, setVariantId } = useTheme();
  const current = THEME_VARIANTS.find((v) => v.id === variantId) ?? THEME_VARIANTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Change color theme">
          <Palette />
          {current.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_VARIANTS.map((variant) => (
          <DropdownMenuItem key={variant.id} onSelect={() => setVariantId(variant.id)}>
            <span
              data-theme={variant.id}
              className="bg-primary size-4 shrink-0 rounded-full border"
              aria-hidden
            />
            {variant.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
