import { COMPANY, HOSTING } from "./company";
import type { LegalDocument } from "./types";

/** Mentions légales (TODO.md Phase 8 — loi pour la confiance dans l'économie numérique, article 6). */
export const LEGAL_NOTICE: LegalDocument = {
  title: "Mentions légales",
  sections: [
    {
      title: "Éditeur",
      blocks: [
        `L'application WorldHair et le site WorldHair sont édités par ${COMPANY.name}, ${COMPANY.legalForm} au capital de ${COMPANY.capital}, dont le siège est situé ${COMPANY.address}.`,
        [
          `Immatriculation : ${COMPANY.registration}`,
          `TVA intracommunautaire : ${COMPANY.vatNumber}`,
          `E-mail : ${COMPANY.email}`,
          `Téléphone : ${COMPANY.phone}`,
        ],
      ],
    },
    {
      title: "Directeur de la publication",
      blocks: [COMPANY.publicationDirector],
    },
    {
      title: "Hébergement",
      blocks: [[`Site et serveur : ${HOSTING.web}.`, `Données : ${HOSTING.data}.`]],
    },
    {
      title: "Propriété intellectuelle",
      blocks: [
        "La marque WorldHair, l'application, le site, leur charte graphique et leurs contenus sont protégés par le droit de la propriété intellectuelle. Toute reproduction ou représentation, totale ou partielle, sans autorisation écrite de l'éditeur est interdite. Les photos et textes publiés par les coiffeurs et les clients restent leur propriété.",
      ],
    },
    {
      title: "Signaler un contenu",
      blocks: [
        `Un avis peut être signalé directement depuis l'application (« Signaler »). Pour tout autre contenu que vous estimez illicite, écrivez à ${COMPANY.email} en précisant le contenu, son emplacement et les raisons de votre demande.`,
      ],
    },
    {
      title: "Données personnelles",
      blocks: [
        "Le traitement de vos données est décrit dans la [politique de confidentialité](/confidentialite). L'utilisation du Service est régie par les [conditions générales d'utilisation](/cgu).",
      ],
    },
  ],
};
