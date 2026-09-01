"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";
import { type AdSlot, listAdSlots, updateAdSlot, uploadAdminMedia } from "@/services/adminApi";
import { useCallback, useEffect, useState } from "react";

const PLACEMENT_LABELS: Record<AdSlot["id"], string> = {
  home_banner: "Bandeau écran d'accueil",
  search_results: "Bannière résultats de recherche",
  booking_confirmation: "Pop-up confirmation de réservation",
};

interface Draft {
  headline: string;
  linkUrl: string;
  active: boolean;
}

function toDraft(slot: AdSlot): Draft {
  return { headline: slot.headline, linkUrl: slot.linkUrl ?? "", active: slot.active };
}

export default function AdminPublicitesPage() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdSlots()
      .then((data) => {
        setSlots(data);
        setDrafts(Object.fromEntries(data.map((slot) => [slot.id, toDraft(slot)])));
        setError(null);
      })
      .catch(() => setError("Impossible de charger les zones publicitaires."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (id: AdSlot["id"]) => {
    const draft = drafts[id];
    setSavingId(id);
    try {
      const updated = await updateAdSlot(id, {
        headline: draft.headline,
        linkUrl: draft.linkUrl,
        active: draft.active,
      });
      setSlots((prev) => prev.map((slot) => (slot.id === id ? updated : slot)));
    } finally {
      setSavingId(null);
    }
  };

  const handleImageChange = async (id: AdSlot["id"], file: File) => {
    setUploadingId(id);
    try {
      const url = await uploadAdminMedia(file);
      const updated = await updateAdSlot(id, { imageUrl: url });
      setSlots((prev) => prev.map((slot) => (slot.id === id ? updated : slot)));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <>
      <AdminTopBar title="Publicités" />

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
          {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}

          {!loading && !error && (
            <div className="flex flex-col gap-4">
              {slots.map((slot) => {
                const draft = drafts[slot.id];
                if (!draft) return null;
                const busy = savingId === slot.id;
                const uploading = uploadingId === slot.id;

                return (
                  <div key={slot.id} className="flex flex-col gap-4 rounded-2xl bg-[#111c2e] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#f2f6fb]">
                        {PLACEMENT_LABELS[slot.id]}
                      </p>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-[#93a6bc]">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [slot.id]: { ...draft, active: event.target.checked },
                            }))
                          }
                          className="size-4 rounded accent-[#2a93d5]"
                        />
                        Actif
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="group relative h-20 w-36 shrink-0 overflow-hidden rounded-xl bg-[#1e2e45]">
                        {slot.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local asset
                          <img
                            src={slot.imageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <p className="grid size-full place-items-center text-[10px] text-[#5b7186]">
                            Aucune image
                          </p>
                        )}
                        <label
                          className={cn(
                            "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100",
                            uploading && "opacity-100",
                          )}
                        >
                          {uploading ? "Envoi…" : "Changer"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploading}
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void handleImageChange(slot.id, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      <input
                        type="text"
                        value={draft.headline}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [slot.id]: { ...draft, headline: event.target.value },
                          }))
                        }
                        placeholder="Titre affiché"
                        className="min-w-[160px] flex-1 rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                      />
                      <input
                        type="text"
                        value={draft.linkUrl}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [slot.id]: { ...draft, linkUrl: event.target.value },
                          }))
                        }
                        placeholder="Lien (https://…)"
                        className="min-w-[200px] flex-1 rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                      />

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSave(slot.id)}
                        className="shrink-0 rounded-full bg-[#2a93d5] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
                      >
                        {busy ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
