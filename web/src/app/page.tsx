import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { VariantSelector } from "@/components/ui/VariantSelector";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Image src="/Logo.png" alt="Logo" width={96} height={96} priority />
      <h1 className="text-2xl font-semibold tracking-tight">App</h1>
      <div className="flex items-center gap-2">
        <VariantSelector />
        <ThemeToggle />
      </div>
    </div>
  );
}
