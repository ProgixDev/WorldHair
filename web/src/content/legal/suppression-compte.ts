import { COMPANY } from "./company";
import type { LegalDocument } from "./types";

/**
 * How to delete a WorldHair account, or some of its data, without the app
 * at hand: the page Google Play's Data safety form links to (« Delete
 * account URL », and « Delete data URL » at #donnees). What it says is what
 * the server does (server/src/account/account-deletion.service.ts) and what
 * the app's confirmation sheet shows (mobile/src/components/account/MyDataGroups.tsx).
 */
export const ACCOUNT_DELETION: LegalDocument = {
  title: "Supprimer votre compte WorldHair",
  intro:
    "Vous pouvez supprimer à tout moment votre compte WorldHair et les données qui y sont liées, depuis l'application ou par e-mail. Vous pouvez aussi effacer une partie de vos données en gardant votre compte.",
  sections: [
    {
      id: "compte",
      title: "1. Depuis l'application",
      blocks: [
        [
          "Ouvrez l'application WorldHair et connectez-vous.",
          "Allez dans l'onglet Profil si vous êtes client, dans l'onglet Compte si vous êtes coiffeur, ou sur l'écran Compte depuis Mon agenda si vous êtes membre de l'équipe d'un salon.",
          "En bas de l'écran, dans « Mes données », touchez « Supprimer mon compte ».",
          "Lisez ce qui va être supprimé, puis touchez « Supprimer définitivement ».",
        ],
        "La suppression est immédiate et ne peut pas être annulée. Avant, vous pouvez récupérer une copie de vos données avec « Exporter mes données », juste au-dessus.",
      ],
    },
    {
      title: "2. Sans l'application",
      blocks: [
        `Écrivez à ${COMPANY.email} depuis l'adresse e-mail de votre compte WorldHair, en demandant la suppression de votre compte. Nous vous confirmons la suppression dans un délai d'un mois au plus.`,
      ],
    },
    {
      title: "3. Ce qui est supprimé",
      blocks: [
        [
          "Votre compte : adresse e-mail, mot de passe, prénom, nom et photo de profil.",
          "Vos favoris, vos préférences de rappel et l'identifiant de notification de votre téléphone.",
          "Les messages que vous avez laissés aux salons.",
          "Si vous êtes coiffeur : la fiche de votre salon, ses photos, vos prestations et horaires, et vos justificatifs (pièce d'identité, diplôme, Kbis, justificatif du local). Votre abonnement prend fin, sans remboursement de la période en cours.",
        ],
        "Vos rendez-vous à venir sont annulés et intégralement remboursés, et l'autre partie est prévenue — sauf, pour un client, ceux dont le délai d'annulation est passé, qui restent dus au salon. Un membre de l'équipe d'un salon ne peut supprimer son compte qu'une fois ses rendez-vous à venir réattribués par le salon.",
      ],
    },
    {
      title: "4. Ce qui est conservé, et combien de temps",
      blocks: [
        [
          "Vos rendez-vous et paiements passés, sans vos nom, coordonnées ni messages : dix ans, pour les obligations comptables, puis supprimés.",
          "Vos avis restent publiés, sous la mention « Ancien client ».",
          "Stripe conserve de son côté les données de vos paiements et de vos versements, pour ses propres obligations légales.",
          "Les journaux techniques du serveur sont conservés pour la durée limitée nécessaire à la sécurité du Service.",
        ],
        "Le détail est dans notre [politique de confidentialité](/confidentialite).",
      ],
    },
    {
      id: "donnees",
      title: "5. Supprimer une partie de vos données, sans supprimer votre compte",
      blocks: [
        "Dans l'application, vous pouvez à tout moment :",
        [
          "retirer votre photo de profil, et modifier vos prénom et nom (onglet Profil ou Compte) ;",
          "retirer un salon de vos favoris ;",
          "désactiver les rappels de rendez-vous dans votre profil, et les notifications et la localisation dans les réglages de votre téléphone ;",
          "si vous êtes coiffeur, supprimer les photos de votre salon et de vos réalisations, et modifier vos prestations et vos horaires (onglet Mon salon).",
        ],
        `Pour effacer d'autres données, un avis par exemple, écrivez à ${COMPANY.email} depuis l'adresse e-mail de votre compte, en précisant lesquelles. Nous les supprimons dans un délai d'un mois au plus, sauf celles que la loi nous oblige à conserver (pièces comptables, voir ci-dessus), et nous vous le confirmons.`,
      ],
    },
  ],
};
