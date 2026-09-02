import {
  CreditCard,
  FileCheck2,
  Flag,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra terms the page is found by in the top bar search, beyond its label. */
  keywords: string[];
}

/**
 * One list, three consumers — the desktop rail, the mobile drawer and the top
 * bar's search index. It used to be written out twice (AdminSidebar's
 * NAV_ITEMS and AdminTopBar's FUNCTIONALITIES, the latter carrying a comment
 * saying it mirrored the former); the drawer would have made a third copy.
 * Every entry maps to a line under TODO.md's "## Admin".
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    keywords: ["statistiques", "réservations", "vue d'ensemble", "dashboard"],
  },
  {
    href: "/admin/dossiers",
    label: "Dossiers coiffeurs",
    icon: FileCheck2,
    keywords: ["kbis", "rne", "diplôme", "pièce d'identité", "validation", "inscription"],
  },
  {
    href: "/admin/avis",
    label: "Avis signalés",
    icon: Flag,
    keywords: ["modération", "masquer un avis", "signalement", "commentaires"],
  },
  {
    href: "/admin/comptes",
    label: "Comptes",
    icon: Users,
    keywords: ["utilisateurs", "suspendre", "bannir", "profils", "particuliers"],
  },
  {
    href: "/admin/publicites",
    label: "Publicités",
    icon: Megaphone,
    keywords: ["bandeau", "bannière", "pop-up", "zones publicitaires", "ads"],
  },
  {
    href: "/admin/contenu",
    label: "Contenu",
    icon: Newspaper,
    keywords: ["onboarding", "slides", "textes", "application mobile"],
  },
  {
    href: "/admin/abonnements",
    label: "Abonnements",
    icon: CreditCard,
    keywords: ["coiffeur pro", "facturation", "plan", "essai"],
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    icon: Settings,
    keywords: ["mot de passe", "email", "administrateurs", "créer un admin"],
  },
];
