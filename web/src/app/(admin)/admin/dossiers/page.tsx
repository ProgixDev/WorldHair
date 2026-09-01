"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pagination, pageSlice } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils";
import {
  type CoiffeurApplication,
  type DocumentUrls,
  decideCoiffeurApplication,
  getApplicationDocumentUrls,
  listCoiffeurApplications,
} from "@/services/adminApi";
import { ChevronDown, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const STATUS_TABS = [
  { value: "pending", label: "En attente" },
  { value: "validated", label: "Validés" },
  { value: "rejected", label: "Refusés" },
] as const;

const DOCUMENT_LABELS: Record<keyof DocumentUrls, string> = {
  identity: "Pièce d'identité",
  diploma: "Diplôme",
  kbis: "KBIS / extrait RNE",
  invoice: "Facture du local",
};

export default function AdminDossiersPage() {
  const [status, setStatus] = useState<CoiffeurApplication["status"]>("pending");
  const [applications, setApplications] = useState<CoiffeurApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, DocumentUrls>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback((nextStatus: CoiffeurApplication["status"]) => {
    listCoiffeurApplications(nextStatus)
      .then((data) => {
        setApplications(data);
        setError(null);
      })
      .catch(() => setError("Impossible de charger les dossiers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  const handleStatusChange = (next: CoiffeurApplication["status"]) => {
    setLoading(true);
    setPage(1);
    setStatus(next);
  };

  const toggleExpand = async (application: CoiffeurApplication) => {
    const next = expandedId === application.id ? null : application.id;
    setExpandedId(next);
    setRejectingId(null);

    if (next && !documentUrls[application.id]) {
      const urls = await getApplicationDocumentUrls(application.id);
      setDocumentUrls((prev) => ({ ...prev, [application.id]: urls }));
    }
  };

  const handleValidate = async (id: string) => {
    setActioningId(id);
    try {
      await decideCoiffeurApplication(id, "validated");
      await load(status);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    try {
      await decideCoiffeurApplication(id, "rejected", rejectMessage.trim() || undefined);
      setRejectingId(null);
      setRejectMessage("");
      await load(status);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <AdminTopBar title="Dossiers coiffeurs" />

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          <div className="flex items-center gap-6">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleStatusChange(tab.value)}
                className={cn(
                  "text-sm transition-colors",
                  status === tab.value
                    ? "border-b-2 border-[#2a93d5] pb-1 font-medium text-[#f2f6fb]"
                    : "text-[#93a6bc] hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {loading && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
            )}
            {error && (
              <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>
            )}
            {!loading && !error && applications.length === 0 && (
              <p className="py-8 text-center text-sm text-[#93a6bc]">
                Aucun dossier dans cette catégorie.
              </p>
            )}

            {!loading &&
              !error &&
              pageSlice(applications, page).map((application) => {
              const expanded = expandedId === application.id;
              const urls = documentUrls[application.id];

              return (
                <div key={application.id} className="rounded-2xl bg-[#111c2e]">
                  <button
                    type="button"
                    onClick={() => void toggleExpand(application)}
                    className="flex w-full flex-wrap items-center gap-4 p-4 text-left"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1e2e45] text-xs font-bold text-[#f2f6fb]">
                      {application.firstName[0]}
                      {application.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#f2f6fb]">
                        {application.salonName}
                      </p>
                      <p className="truncate text-xs text-[#93a6bc]">
                        {application.firstName} {application.lastName} ·{" "}
                        {application.practiceZone === "salon"
                          ? application.city
                          : `Domicile · rayon ${application.travelRadiusKm} km`}
                      </p>
                    </div>
                    <span className="text-xs text-[#93a6bc]">
                      {new Date(application.submittedAt).toLocaleDateString("fr-FR")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-[#5b7186] transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {expanded && (
                    <div className="flex flex-col gap-4 border-t border-white/5 p-4">
                      <p className="text-sm text-[#93a6bc]">
                        {application.description || "Aucune description fournie."}
                      </p>
                      <p className="text-xs text-[#93a6bc]">
                        Téléphone : {application.phone}
                      </p>

                      <div>
                        <p className="text-xs font-medium text-[#f2f6fb]">Documents</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {(Object.keys(DOCUMENT_LABELS) as Array<keyof DocumentUrls>).map(
                            (key) => {
                              const url = urls?.[key];
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
                          Message précédent : {application.reviewMessage}
                        </p>
                      )}

                      {status === "pending" && (
                        <div className="flex flex-col gap-3">
                          {rejectingId === application.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={rejectMessage}
                                onChange={(event) => setRejectMessage(event.target.value)}
                                placeholder="Motif du refus (visible par le coiffeur)"
                                rows={2}
                                className="rounded-xl bg-[#080f1a] p-3 text-xs text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={actioningId === application.id}
                                  onClick={() => void handleReject(application.id)}
                                  className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                                >
                                  Confirmer le refus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectingId(null)}
                                  className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#93a6bc] hover:text-white"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actioningId === application.id}
                                onClick={() => void handleValidate(application.id)}
                                className="rounded-full bg-[#1f9d55] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                disabled={actioningId === application.id}
                                onClick={() => setRejectingId(application.id)}
                                className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#93a6bc] hover:text-white"
                              >
                                Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!loading && !error && (
              <Pagination page={page} total={applications.length} onPageChange={setPage} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
