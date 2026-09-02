"use client";

import { cn } from "@/lib/utils";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import {
  type AdminSession,
  getAdminSession,
  updateAdminEmail,
  updateAdminPassword,
} from "@/services/adminAuth";
import {
  type AdminUser,
  createAdmin,
  deleteAdmin,
  listAdmins,
} from "@/services/adminApi";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const TIER_LABELS: Record<AdminUser["tier"], string> = {
  admin: "Admin",
  admin_limited: "Modérateur",
};

const TIER_STYLES: Record<AdminUser["tier"], string> = {
  admin: "bg-[#2a93d5]/15 text-[#2a93d5]",
  admin_limited: "bg-white/10 text-[#93a6bc]",
};

const ADMINS_PAGE_SIZE = 5;

export default function AdminParametresPage() {
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [session, setSession] = useState<AdminSession | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);
  const [createAdminMessage, setCreateAdminMessage] = useState<string | null>(null);
  const [adminsPage, setAdminsPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSession().then((data) => {
      if (data) {
        setEmail(data.email);
        setSession(data);
      }
    });
  }, []);

  const loadAdmins = useCallback(() => {
    listAdmins()
      .then((data) => {
        setAdmins(data);
        setAdminsError(null);
      })
      .catch(() => setAdminsError("Impossible de charger les administrateurs."))
      .finally(() => setAdminsLoading(false));
  }, []);

  useEffect(() => {
    if (session?.tier === "admin") loadAdmins();
  }, [session, loadAdmins]);

  const handleCreateAdmin = async () => {
    setCreatingAdmin(true);
    setCreateAdminError(null);
    setCreateAdminMessage(null);
    try {
      await createAdmin(newAdminEmail, newAdminPassword);
      setCreateAdminMessage("Administrateur créé.");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setAdminsPage(1);
      loadAdmins();
    } catch (error) {
      setCreateAdminError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteAdmin(id);
      setAdmins((current) => current.filter((admin) => admin.id !== id));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setDeletingId(null);
    }
  };

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

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          <div className="flex items-center gap-4 rounded-2xl bg-[#111c2e] p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-base font-bold text-[#f2f6fb]">
              {email[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f2f6fb]">Administrateur</p>
              <p className="truncate text-xs text-[#93a6bc]">{email || "…"}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-5">
              <p className="text-sm font-medium text-[#f2f6fb]">Adresse email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] focus:outline-2 focus:outline-[#2a93d5]"
                />
                <button
                  type="button"
                  disabled={emailSaving}
                  onClick={() => void handleEmailSave()}
                  className="h-11 shrink-0 rounded-full bg-[#2a93d5] px-6 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
                >
                  {emailSaving ? "Enregistrement…" : "Mettre à jour"}
                </button>
              </div>
              {emailError && <p className="text-xs text-[#ff7a70]">{emailError}</p>}
              {emailMessage && <p className="text-xs text-[#1f9d55]">{emailMessage}</p>}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-5">
              <p className="text-sm font-medium text-[#f2f6fb]">Mot de passe</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="6 caractères minimum"
                  className="h-11 min-w-0 flex-1 rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                />
                <button
                  type="button"
                  disabled={passwordSaving || !newPassword}
                  onClick={() => void handlePasswordSave()}
                  className="h-11 shrink-0 rounded-full bg-[#2a93d5] px-6 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
                >
                  {passwordSaving ? "Enregistrement…" : "Changer"}
                </button>
              </div>
              {passwordError && <p className="text-xs text-[#ff7a70]">{passwordError}</p>}
              {passwordMessage && <p className="text-xs text-[#1f9d55]">{passwordMessage}</p>}
            </div>
          </div>

          {session?.tier === "admin" && (
            <div className="flex flex-col gap-4 rounded-2xl bg-[#111c2e] p-5">
              <div>
                <p className="text-sm font-medium text-[#f2f6fb]">Gestion des admins</p>
                <p className="text-xs text-[#5b7186]">
                  Les administrateurs créés ici ont tous les droits sauf celui d&apos;en créer
                  d&apos;autres.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-xs text-[#93a6bc]">
                  Email
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] focus:outline-2 focus:outline-[#2a93d5]"
                  />
                </label>
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-xs text-[#93a6bc]">
                  Mot de passe
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(event) => setNewAdminPassword(event.target.value)}
                    placeholder="6 caractères minimum"
                    className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                  />
                </label>
                <button
                  type="button"
                  disabled={creatingAdmin || !newAdminEmail || !newAdminPassword}
                  onClick={() => void handleCreateAdmin()}
                  className="h-11 shrink-0 rounded-full bg-[#2a93d5] px-8 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
                >
                  {creatingAdmin ? "Création…" : "Créer"}
                </button>
              </div>
              {createAdminError && <p className="text-xs text-[#ff7a70]">{createAdminError}</p>}
              {createAdminMessage && (
                <p className="text-xs text-[#1f9d55]">{createAdminMessage}</p>
              )}

              <div className="flex flex-col gap-2">
                {adminsLoading && <p className="text-xs text-[#93a6bc]">Chargement…</p>}
                {adminsError && <p className="text-xs text-[#ff7a70]">{adminsError}</p>}
                {deleteError && <p className="text-xs text-[#ff7a70]">{deleteError}</p>}
                {!adminsLoading &&
                  !adminsError &&
                  pageSlice(admins, adminsPage, ADMINS_PAGE_SIZE).map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#080f1a] px-4 py-2.5"
                    >
                      <span className="truncate text-sm text-[#f2f6fb]">{admin.email}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            TIER_STYLES[admin.tier],
                          )}
                        >
                          {TIER_LABELS[admin.tier]}
                        </span>
                        {admin.id !== session?.userId && (
                          <button
                            type="button"
                            aria-label="Supprimer cet administrateur"
                            disabled={deletingId === admin.id}
                            onClick={() => void handleDeleteAdmin(admin.id)}
                            className="grid size-7 place-items-center rounded-full text-[#93a6bc] transition-colors hover:bg-[#ff7a70]/15 hover:text-[#ff7a70] disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                {!adminsLoading && !adminsError && (
                  <Pagination
                    page={adminsPage}
                    total={admins.length}
                    pageSize={ADMINS_PAGE_SIZE}
                    onPageChange={setAdminsPage}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
