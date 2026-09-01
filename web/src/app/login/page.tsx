"use client";

import { Button } from "@/components/ui/Button";
import { signInAdmin } from "@/services/adminAuth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInAdmin(email, password);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17243a] px-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#080f1a] p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/Logo.png" alt="WorldHair" width={40} height={40} />
          <h1 className="text-lg font-medium text-[#f2f6fb]">
            Espace administrateur
          </h1>
          <p className="text-xs text-[#93a6bc]">
            Connectez-vous avec votre compte WorldHair.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-[#93a6bc]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl bg-[#111c2e] px-4 text-sm text-[#f2f6fb] focus:outline-2 focus:outline-[#2a93d5]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-[#93a6bc]">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl bg-[#111c2e] px-4 text-sm text-[#f2f6fb] focus:outline-2 focus:outline-[#2a93d5]"
            />
          </div>

          {error && <p className="text-xs text-[#ff7a70]">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="mt-2 h-11 rounded-xl bg-[#2a93d5] text-white hover:bg-[#2a93d5]/90"
          >
            {submitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
