"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { cn } from "@/lib/utils";
import {
  type CoiffeurMessage,
  type ThreadSummary,
  getMessageThread,
  listMessageThreads,
  sendAdminMessage,
} from "@/services/adminApi";
import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function AdminMessageriePage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoiffeurMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(() => {
    listMessageThreads()
      .then((data) => {
        setThreads(data);
        setThreadsError(null);
      })
      .catch(() => setThreadsError("Impossible de charger les conversations."))
      .finally(() => setThreadsLoading(false));
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const selectThread = async (coiffeurId: string) => {
    setSelectedId(coiffeurId);
    setMessagesLoading(true);
    try {
      const data = await getMessageThread(coiffeurId);
      setMessages(data);
    } finally {
      setMessagesLoading(false);
    }
    loadThreads();
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!selectedId || !body) return;

    setSending(true);
    try {
      const message = await sendAdminMessage(selectedId, body);
      setMessages((prev) => [...prev, message]);
      setDraft("");
      loadThreads();
    } finally {
      setSending(false);
    }
  };

  const selectedThread = threads.find((thread) => thread.coiffeurId === selectedId);

  return (
    <>
      <AdminTopBar title="Messagerie" />

      <div className="flex min-w-0 flex-1 gap-4 px-6 pt-4 pb-8 sm:px-8">
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto rounded-3xl bg-[#080f1a] p-3">
          {threadsLoading && (
            <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
          )}
          {threadsError && (
            <p className="py-8 text-center text-sm text-[#ff7a70]">{threadsError}</p>
          )}
          {!threadsLoading && !threadsError && threads.length === 0 && (
            <p className="py-8 text-center text-sm text-[#93a6bc]">Aucun coiffeur.</p>
          )}

          {threads.map((thread) => {
            const fullName = `${thread.firstName} ${thread.lastName}`.trim();
            return (
              <button
                key={thread.coiffeurId}
                type="button"
                onClick={() => void selectThread(thread.coiffeurId)}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl p-3 text-left transition-colors",
                  selectedId === thread.coiffeurId ? "bg-[#111c2e]" : "hover:bg-white/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[#f2f6fb]">
                    {fullName || thread.email}
                  </span>
                  {thread.unreadForAdmin > 0 && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#2a93d5] text-[10px] font-bold text-white">
                      {thread.unreadForAdmin}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs text-[#93a6bc]">
                  {thread.lastMessage ?? "Aucun message"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-col rounded-3xl bg-[#080f1a] p-5 sm:p-6">
          {!selectedId && (
            <p className="m-auto text-sm text-[#93a6bc]">
              Sélectionnez un coiffeur pour voir la conversation.
            </p>
          )}

          {selectedId && (
            <>
              <p className="border-b border-white/5 pb-4 text-sm font-medium text-[#f2f6fb]">
                {selectedThread
                  ? `${selectedThread.firstName} ${selectedThread.lastName}`.trim() || selectedThread.email
                  : ""}
              </p>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
                {messagesLoading && (
                  <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#93a6bc]">
                    Aucun message pour l&apos;instant.
                  </p>
                )}
                {!messagesLoading &&
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                        message.senderRole === "admin"
                          ? "self-end bg-[#2a93d5] text-white"
                          : "self-start bg-[#111c2e] text-[#f2f6fb]",
                      )}
                    >
                      <p>{message.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          message.senderRole === "admin" ? "text-white/70" : "text-[#93a6bc]",
                        )}
                      >
                        {new Date(message.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  ))}
              </div>

              <div className="flex gap-2 border-t border-white/5 pt-4">
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSend();
                  }}
                  placeholder="Écrire un message…"
                  className="flex-1 rounded-full bg-[#111c2e] px-4 py-2 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
                />
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void handleSend()}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2a93d5] text-white disabled:opacity-50"
                >
                  <Send className="size-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
