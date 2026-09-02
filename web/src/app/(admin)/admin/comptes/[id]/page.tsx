"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";
import {
  type AdminAccount,
  type CoiffeurApplication,
  type DocumentUrls,
  getAccount,
  getApplicationDocumentUrls,
  getCoiffeurApplicationByProfileId,
  setAccountStatus,
} from "@/services/adminApi";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STATUS_STYLES: Record<AdminAccount["accountStatus"], string> = {
  active: "bg-[#1f9d55]/15 text-[#1f9d55]",
  suspended: "bg-[#e4b980]/15 text-[#e4b980]",
  banned: "bg-[#ff7a70]/15 text-[#ff7a70]",
};

const STATUS_LABELS: Record<AdminAccount["accountStatus"], string> = {
  active: "Actif",
  suspended: "Suspendu",
  banned: "Banni",
};

const APPLICATION_STATUS_STYLES: Record<CoiffeurApplication["status"], string> = {
  pending: "bg-[#2a93d5]/15 text-[#2a93d5]",
  validated: "bg-[#1f9d55]/15 text-[#1f9d55]",
  rejected: "bg-[#ff7a70]/15 text-[#ff7a70]",
};

const APPLICATION_STATUS_LABELS: Record<CoiffeurApplication["status"], string> = {
  pending: "En attente",
  validated: "Validé",
  rejected: "Refusé",
};

const DOCUMENT_LABELS: Record<keyof DocumentUrls, string> = {
  identity: "Pièce d'identité",
  diploma: "Diplôme",
  kbis: "KBIS / extrait RNE",
  invoice: "Facture du local",
};

export default function AdminAccountProfilePage() {
  const { id } = useParams<{ id: string }>();

  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [application, setApplication] = useState<CoiffeurApplication | null>(null);
  const [documentUrls, setDocumentUrls] = useState<DocumentUrls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);

  const load = useCallback(() => {
    getAccount(id)
      .then(async (data) => {
        setAccount(data);
        if (data.role === "coiffeur") {
          const app = await getCoiffeurApplicationByProfileId(id);
          setApplication(app);
          if (app) {
            const urls = await getApplicationDocumentUrls(app.id);
            setDocumentUrls(urls);
          }
        }
        setError(null);
      })
      .catch(() => setError("Impossible de charger ce profil."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetStatus = async (status: AdminAccount["accountStatus"]) => {
    setActioning(true);
    try {
      const updated = await setAccountStatus(id, status);
      setAccount(updated);
    } finally {
      setActioning(false);
    }
  };

  const fullName = application
    ? `${application.firstName} ${application.lastName}`.trim()
    : account
      ? `${account.firstName} ${account.lastName}`.trim()
      : "";
  const displayName = fullName || account?.email || "";

  return (
    <>
      <AdminTopBar title="Profil" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <Link
          href="/admin/comptes"
          className="inline-flex items-center gap-1.5 text-xs text-[#93a6bc] transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Retour aux comptes
        </Link>

        <div className="mt-4 rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
          {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}

          {!loading && !error && account && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-lg font-bold text-[#f2f6fb]">
                    {displayName[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-[#f2f6fb]">{displayName}</p>
                    <p className="truncate text-xs text-[#93a6bc]">{account.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#93a6bc]">
                    {account.role === "coiffeur" ? "Coiffeur" : "Particulier"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      STATUS_STYLES[account.accountStatus],
                    )}
                  >
                    {STATUS_LABELS[account.accountStatus]}
                  </span>
                  <span className="text-xs text-[#93a6bc]">
                    Créé le {new Date(account.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {account.accountStatus !== "active" && (
                  <button
                    type="button"
                    disabled={actioning}
                    onClick={() => void handleSetStatus("active")}
                    className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1a8549] disabled:opacity-50"
                  >
                    Réactiver
                  </button>
                )}
                {account.accountStatus !== "suspended" && account.accountStatus !== "banned" && (
                  <button
                    type="button"
                    disabled={actioning}
                    onClick={() => void handleSetStatus("suspended")}
                    className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#e4b980] transition-colors hover:text-[#e4b980]/80 disabled:opacity-50"
                  >
                    Suspendre
                  </button>
                )}
                {account.accountStatus !== "banned" && (
                  <button
                    type="button"
                    disabled={actioning}
                    onClick={() => void handleSetStatus("banned")}
                    className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#921f18] disabled:opacity-50"
                  >
                    Bannir
                  </button>
                )}
              </div>

              {account.role === "coiffeur" && (
                <div className="rounded-2xl bg-[#111c2e] p-5">
                  <p className="text-sm font-medium text-[#f2f6fb]">Dossier coiffeur</p>

                  {!application && (
                    <p className="mt-3 text-sm text-[#93a6bc]">Aucun dossier soumis.</p>
                  )}

                  {application && (
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            APPLICATION_STATUS_STYLES[application.status],
                          )}
                        >
                          {APPLICATION_STATUS_LABELS[application.status]}
                        </span>
                        <p className="text-sm font-medium text-[#f2f6fb]">
                          {application.salonName}
                        </p>
                      </div>

                      <p className="text-sm text-[#93a6bc]">
                        {application.description || "Aucune description fournie."}
                      </p>

                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#93a6bc]">
                        <span>Téléphone : {application.phone}</span>
                        <span>
                          {application.practiceZone === "salon"
                            ? `${application.addressLine ?? ""}, ${application.postalCode ?? ""} ${application.city ?? ""}`
                            : `Domicile · rayon ${application.travelRadiusKm} km`}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[#f2f6fb]">Documents</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {(Object.keys(DOCUMENT_LABELS) as Array<keyof DocumentUrls>).map(
                            (key) => {
                              const url = documentUrls?.[key];
                              return (
                                <li key={key}>
                                  {url ? (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1.5 rounded-full bg-[#1e2e45] px-3 py-1.5 text-xs text-[#2a93d5] hover:text-white"
                                    >
                                      <FileText className="size-3" aria-hidden="true" />
                                      {DOCUMENT_LABELS[key]}
                                    </a>
                                  ) : (
                                    <span className="flex items-center gap-1.5 rounded-full bg-[#1e2e45] px-3 py-1.5 text-xs text-[#5b7186]">
                                      <FileText className="size-3" aria-hidden="true" />
                                      {DOCUMENT_LABELS[key]} — indisponible
                                    </span>
                                  )}
                                </li>
                              );
                            },
                          )}
                        </ul>
                      </div>

                      {application.reviewMessage && (
                        <p className="text-xs text-[#e4b980]">
                          Message de refus : {application.reviewMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
