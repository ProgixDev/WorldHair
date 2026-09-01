import { Check, Flag, FileCheck2, Megaphone } from "lucide-react";

/** Mirrors the three capability groups under TODO.md's "## Admin". */
const GROUPS = [
  {
    icon: FileCheck2,
    title: "Dossiers coiffeurs",
    items: [
      "Vérifier pièce d'identité et diplôme",
      "Contrôler le KBIS ou l'extrait RNE",
      "Valider ou refuser avec message motivé",
    ],
  },
  {
    icon: Flag,
    title: "Modération",
    items: [
      "Consulter les avis signalés",
      "Masquer ou rétablir un avis",
      "Suspendre ou bannir un compte",
    ],
  },
  {
    icon: Megaphone,
    title: "Contenu & publicité",
    items: [
      "Gérer les zones publicitaires",
      "Définir les périodes d'activation",
      "Éditer le contenu onboarding",
    ],
  },
] as const;

export function AdminCapabilityCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl bg-[#111c2e] p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-white/10 text-[#f2f6fb]">
              <group.icon className="size-4" />
            </span>
            <h2 className="text-sm font-medium text-[#f2f6fb]">
              {group.title}
            </h2>
          </div>

          <ul className="mt-4 flex flex-col gap-2.5">
            {group.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-xs leading-5 text-[#93a6bc]"
              >
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-[#2a93d5]"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
