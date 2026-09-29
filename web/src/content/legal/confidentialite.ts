import { COMPANY, HOSTING, TERMS_DATE } from "./company";
import type { LegalDocument } from "./types";

/**
 * Politique de confidentialité (TODO.md Phase 8). What it says about
 * retention and deletion is what the server does
 * (server/src/account/, server/src/coiffeur/document-retention.job.ts).
 */
export const PRIVACY_POLICY: LegalDocument = {
  title: "Politique de confidentialité",
  version: `Version du ${TERMS_DATE}`,
  intro:
    "Cette politique explique quelles données personnelles WorldHair traite lorsque vous utilisez l'application et le site, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer vos droits.",
  sections: [
    {
      title: "1. Responsable du traitement",
      blocks: [
        `${COMPANY.name}, ${COMPANY.legalForm}, ${COMPANY.address}. Pour toute question sur vos données : ${COMPANY.email}.`,
      ],
    },
    {
      title: "2. Les données que nous traitons",
      blocks: [
        [
          "Compte : adresse e-mail, mot de passe (conservé chiffré par notre prestataire d'authentification, jamais en clair), prénom, nom, photo de profil si vous en ajoutez une, date et version des conditions acceptées.",
          "Rendez-vous : salon, prestations, date et heure, statut, message laissé au salon, annulations et leur motif.",
          "Paiements : montants, remboursements, versements et références de paiement Stripe. Les données de votre carte sont collectées et traitées par Stripe ; WorldHair n'y a pas accès.",
          "Avis et signalements que vous publiez, salons mis en favoris, préférences de rappel, et l'identifiant de notification de votre téléphone.",
          "Localisation : si vous l'autorisez, la position de votre téléphone sert à afficher les salons autour de vous. Elle est transmise à notre serveur au moment de la recherche et n'est pas enregistrée dans votre compte. Vous pouvez la refuser et choisir une ville à la place.",
        ],
        "Si vous êtes coiffeur, également :",
        [
          "vos nom, prénom et téléphone, le nom et l'adresse de votre salon ou votre zone d'intervention ;",
          "les justificatifs de votre dossier : pièce d'identité, diplôme, extrait Kbis ou du Registre national des entreprises, justificatif du local ;",
          "les photos de votre salon et de vos réalisations, vos prestations, prix, horaires et fermetures ;",
          "votre abonnement (formule, statut, échéances). Les coordonnées bancaires et les pièces d'identité exigées pour vos encaissements sont collectées directement par Stripe.",
        ],
        "Enfin, notre serveur enregistre des journaux techniques (adresse IP, date, requête), nécessaires à la sécurité du Service.",
      ],
    },
    {
      title: "3. Pourquoi, et sur quelle base",
      blocks: [
        [
          "Créer et gérer votre compte, vous identifier : exécution des conditions générales d'utilisation (le contrat).",
          "Réserver, payer, rembourser, verser leur part aux coiffeurs et vous prévenir de ce qui arrive à vos rendez-vous : exécution du contrat.",
          "Vérifier l'identité et la qualification des coiffeurs avant de publier leur salon : intérêt légitime de WorldHair et de ses utilisateurs (sécurité et confiance).",
          "Publier et modérer les avis, traiter les signalements : intérêt légitime (fiabilité des avis) et obligations du Code de la consommation.",
          "Vous rappeler vos rendez-vous la veille et une heure avant : exécution du contrat ; vous pouvez désactiver ces rappels dans votre profil.",
          "Rechercher des salons autour de vous : votre consentement, donné par l'autorisation de localisation de votre téléphone et retirable à tout moment.",
          "Gérer les abonnements des coiffeurs et conserver les pièces comptables : exécution du contrat et obligation légale.",
          "Assurer la sécurité du Service, prévenir la fraude, établir des statistiques internes anonymes : intérêt légitime.",
        ],
        "WorldHair ne vend pas vos données et ne les utilise pas à des fins publicitaires.",
      ],
    },
    {
      title: "4. Qui y a accès",
      blocks: [
        [
          "Les autres utilisateurs, pour ce qui est nécessaire : un salon voit le nom de ses clients et leurs rendez-vous chez lui ; les avis sont publics, sous votre prénom et l'initiale de votre nom.",
          "Les membres habilités de l'équipe WorldHair, pour l'administration, la modération et le traitement des litiges.",
          "Nos prestataires, qui traitent les données pour notre compte : Supabase (base de données, authentification et fichiers, données hébergées " + HOSTING.dataRegion + "), Render (hébergement du serveur et du site), Stripe (paiements et versements), Resend (envoi des e-mails), Expo, Apple et Google (acheminement des notifications), Mapbox (affichage des cartes).",
          "Les autorités, sur demande légale.",
        ],
        "Certains de ces prestataires sont établis hors de l'Union européenne, notamment aux États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis.",
      ],
    },
    {
      title: "5. Combien de temps",
      blocks: [
        [
          "Votre compte et ses données sont conservés tant que le compte existe.",
          "Quand vous supprimez votre compte, ces données sont effacées sans délai. Vos rendez-vous et paiements passés sont conservés, sans vos nom, coordonnées ni messages, pendant dix ans pour les obligations comptables, puis supprimés ; vos avis restent publiés sous la mention « Ancien client ». Stripe conserve de son côté les données de vos paiements, pour ses propres obligations légales.",
          "Une copie de vos données préparée pour être téléchargée (« Exporter mes données ») est effacée au plus tard la nuit suivante.",
          "Les justificatifs d'un coiffeur sont conservés pendant l'examen de son dossier, puis tant que son compte existe. Si son dossier est refusé, ils sont supprimés 90 jours après la décision, le temps de le corriger et de le déposer de nouveau.",
          "Les journaux techniques sont conservés pour la durée limitée nécessaire à la sécurité du Service, et les sauvegardes de la base de données sont renouvelées au fil de l'eau.",
        ],
      ],
    },
    {
      title: "6. Vos droits",
      blocks: [
        "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir des directives sur leur sort après votre décès. Dans l'application, depuis l'onglet Profil (Compte, pour les coiffeurs) :",
        [
          "Exporter mes données : une copie de vos données, au format JSON ;",
          "Modifier mon profil (et, pour les coiffeurs, la fiche du salon) : pour les corriger ;",
          "Supprimer mon compte : pour les effacer.",
        ],
        `Vous pouvez aussi nous écrire à ${COMPANY.email} : nous répondons dans un délai d'un mois. Vous pouvez retirer à tout moment l'autorisation de localisation ou de notifications dans les réglages de votre téléphone. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).`,
      ],
    },
    {
      title: "7. Sécurité",
      blocks: [
        "Les échanges avec le Service sont chiffrés (HTTPS). Chaque utilisateur n'accède qu'à ses propres données ; les justificatifs des coiffeurs sont stockés dans un espace privé, consultable par l'équipe WorldHair seulement, par des liens valables quelques minutes.",
      ],
    },
    {
      title: "8. Cookies et traceurs",
      blocks: [
        "Le Service n'utilise aucun traceur publicitaire ni outil de mesure d'audience. Le site enregistre dans votre navigateur uniquement ce qui est nécessaire pour vous garder connecté, ce qui ne demande pas votre consentement. La page de paiement de Stripe dépose ses propres cookies, nécessaires à la sécurité des paiements.",
      ],
    },
    {
      title: "9. Mineurs",
      blocks: [
        "Le Service est réservé aux personnes majeures. Un mineur ne peut réserver que par l'intermédiaire de son représentant légal, depuis le compte de celui-ci.",
      ],
    },
    {
      title: "10. Modifications",
      blocks: [
        "Cette politique peut évoluer. La nouvelle version est présentée dans l'application, où il vous est demandé de l'accepter pour continuer à utiliser le Service. Voir aussi les [conditions générales d'utilisation](/cgu) et les [mentions légales](/mentions-legales).",
      ],
    },
  ],
};
