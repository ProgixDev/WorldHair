"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  getAdminSession,
  updateAdminEmail,
  updateAdminPassword,
} from "@/services/adminAuth";
import { useEffect, useState } from "react";

export default function AdminParametresPage() {
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((session) => {
      if (session) setEmail(session.email);
    });
  }, []);

  const handleEmailSave = async () => {
    setEmailSaving(true);
    setEmailError(null);
    setEmailMessage(null);
    try {
      await updateAdminEmail(email);
      setEmailMessage("Vérifiez votre boîte mail pour confirmer le changement d'adresse.");
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (newPassword.length < 6) {
      setPasswordError("6 caractères minimum.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await updateAdminPassword(newPassword);
      setPasswordMessage("Mot de passe mis à jour.");
      setNewPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
      <AdminTopBar title="Paramètres" />

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          <div className="flex max-w-md flex-col gap-4 rounded-2xl bg-[#111c2e] p-5">
            <p className="text-sm font-medium text-[#f2f6fb]">Mon compte</p>

            <label className="flex flex-col gap-1.5 text-xs text-[#93a6bc]">
              Adresse email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] focus:outline-2 focus:outline-[#2a93d5]"
              />
            </label>
            {emailError && <p className="text-xs text-[#ff7a70]">{emailError}</p>}
            {emailMessage && <p className="text-xs text-[#1f9d55]">{emailMessage}</p>}
            <button
              type="button"
              disabled={emailSaving}
              onClick={() => void handleEmailSave()}
              className="self-start rounded-full bg-[#2a93d5] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {emailSaving ? "Enregistrement…" : "Mettre à jour l'email"}
            </button>

            <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
              <label className="flex flex-col gap-1.5 text-xs text-[#93a6bc]">
                Nouveau mot de passe
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="6 caractères minimum"
                  className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                />
              </label>
              {passwordError && <p className="text-xs text-[#ff7a70]">{passwordError}</p>}
              {passwordMessage && <p className="text-xs text-[#1f9d55]">{passwordMessage}</p>}
              <button
                type="button"
                disabled={passwordSaving || !newPassword}
                onClick={() => void handlePasswordSave()}
                className="self-start rounded-full bg-[#2a93d5] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {passwordSaving ? "Enregistrement…" : "Changer le mot de passe"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
