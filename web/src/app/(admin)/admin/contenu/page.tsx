"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";
import {
  type AppContent,
  getAppContent,
  updateAppContent,
  uploadAdminMedia,
} from "@/services/adminApi";
import { useCallback, useEffect, useState } from "react";

const CONTENT_KEY = "onboarding_products_slide";

/** Real values from mobile/src/features/onboarding/slides.ts's "products" slide — this preview must match what actually renders on the phone, not an invented look. */
const SLIDE_PALETTE = {
  surface: "#f7f4f1",
  onSurface: "#0c2340",
  muted: "#5b7186",
  rule: "#b9855a",
};
const SLIDE_CTA_LABEL = "Découvrir WorldHair";
const SLIDE_INDEX = 3;
const SLIDE_COUNT = 4;

export default function AdminContenuPage() {
  const [content, setContent] = useState<AppContent | null>(null);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    getAppContent(CONTENT_KEY)
      .then((data) => {
        setContent(data);
        setHeading(data.heading);
        setBody(data.body);
        setError(null);
      })
      .catch(() => setError("Impossible de charger ce contenu."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAppContent(CONTENT_KEY, { heading, body });
      setContent(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAdminMedia(file);
      const updated = await updateAppContent(CONTENT_KEY, { imageUrl: url });
      setContent(updated);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <AdminTopBar title="Contenu" />

      <div className="min-w-0 flex-1 px-6 pt-4 pb-8 sm:px-8">
        <div className="rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
          {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}

          {!loading && !error && content && (
            <div className="grid max-w-5xl gap-5 lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-4 rounded-2xl bg-[#111c2e] p-6">
                <div>
                  <p className="text-sm font-medium text-[#f2f6fb]">4e slide onboarding</p>
                  <p className="text-xs text-[#5b7186]">
                    &laquo;&nbsp;Des produits de qualité&nbsp;&raquo;
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="group relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#1e2e45]">
                    {content.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local asset
                      <img src={content.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <p className="grid size-full place-items-center text-center text-[9px] text-[#5b7186]">
                        Aucune image
                      </p>
                    )}
                    <label
                      className={cn(
                        "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100",
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
                          if (file) void handleImageChange(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-[#5b7186]">
                    Visible en haut de la 4e slide de l&apos;onboarding mobile.
                  </p>
                </div>

                <input
                  type="text"
                  value={heading}
                  onChange={(event) => setHeading(event.target.value)}
                  placeholder="Titre"
                  className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                />
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Texte descriptif"
                  className="min-h-40 flex-1 resize-none rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                />

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="self-start rounded-full bg-[#2a93d5] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#111c2e] p-6">
                <p className="text-xs font-medium text-[#93a6bc]">Aperçu — écran d&apos;accueil</p>

                <div
                  className="flex w-full max-w-[280px] flex-1 flex-col overflow-hidden rounded-[2rem] border-4 border-[#1e2e45]"
                  style={{ backgroundColor: SLIDE_PALETTE.surface, aspectRatio: "9 / 19.5" }}
                >
                  <div className="relative flex-[0_0_55%]">
                    {content.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local asset
                      <img
                        src={content.imageUrl}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: `${SLIDE_PALETTE.rule}1a` }}
                      />
                    )}
                    <div
                      className="absolute right-0 bottom-0 left-0 h-1/2"
                      style={{
                        background: `linear-gradient(to bottom, transparent, ${SLIDE_PALETTE.surface})`,
                      }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-end gap-3 p-5">
                    <span
                      className="h-0.5 w-11 rounded-full"
                      style={{ backgroundColor: SLIDE_PALETTE.rule }}
                    />
                    <p
                      className="text-lg leading-snug font-bold"
                      style={{ color: SLIDE_PALETTE.onSurface }}
                    >
                      {heading || "Titre"}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: SLIDE_PALETTE.muted }}>
                      {body || "Texte descriptif"}
                    </p>

                    <p
                      className="mt-2 rounded-full py-2.5 text-center text-xs font-semibold"
                      style={{ backgroundColor: "#38b6ff", color: SLIDE_PALETTE.onSurface }}
                    >
                      {SLIDE_CTA_LABEL}
                    </p>

                    <div className="flex justify-center gap-1.5 pt-1">
                      {Array.from({ length: SLIDE_COUNT }, (_, dotIndex) => (
                        <span
                          key={dotIndex}
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              dotIndex === SLIDE_INDEX ? "#38b6ff" : SLIDE_PALETTE.muted,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
