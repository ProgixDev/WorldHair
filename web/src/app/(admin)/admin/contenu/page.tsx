"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  type AppContent,
  getAppContent,
  updateAppContent,
  uploadAdminMedia,
} from "@/services/adminApi";
import { useCallback, useEffect, useState } from "react";

const CONTENT_KEY = "onboarding_products_slide";

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
            <div className="flex max-w-xl flex-col gap-4 rounded-2xl bg-[#111c2e] p-5">
              <p className="text-sm font-medium text-[#f2f6fb]">
                4e slide onboarding — &laquo;&nbsp;Des produits de qualité&nbsp;&raquo;
              </p>

              <div className="flex flex-wrap items-start gap-3">
                {content.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local asset
                  <img
                    src={content.imageUrl}
                    alt=""
                    className="h-20 w-32 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-20 w-32 shrink-0 place-items-center rounded-lg bg-[#1e2e45] text-[10px] text-[#5b7186]">
                    Aucune image
                  </div>
                )}
                <label className="rounded-full bg-white/10 px-3 py-2 text-xs text-[#93a6bc] hover:text-white">
                  {uploading ? "Envoi…" : "Changer l'image"}
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
                rows={4}
                className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
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
          )}
        </div>
      </div>
    </>
  );
}
