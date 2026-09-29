import { COMPANY, TERMS_DATE } from "./company";
import type { LegalDocument } from "./types";

/**
 * Conditions générales d'utilisation (TODO.md Phase 8). The booking,
 * payment and refund rules below are the ones the server enforces
 * (server/src/appointments/, server/src/payments/): change them together.
 */
export const CGU: LegalDocument = {
  title: "Conditions générales d'utilisation",
  version: `Version du ${TERMS_DATE}`,
  intro:
    "WorldHair permet de trouver un coiffeur, en salon ou à domicile, de réserver et de payer une prestation de coiffure en ligne, et aux coiffeurs de gérer leurs rendez-vous. Les présentes conditions générales d'utilisation (les « CGU ») s'appliquent à l'application mobile WorldHair et au site WorldHair (ensemble, le « Service »). Elles sont acceptées lors de la création du compte.",
  sections: [
    {
      title: "1. Éditeur du Service",
      blocks: [
        `Le Service est édité par ${COMPANY.name}, ${COMPANY.legalForm} au capital de ${COMPANY.capital}, dont le siège est situé ${COMPANY.address}, immatriculée sous le numéro ${COMPANY.registration} (« WorldHair »). Contact : ${COMPANY.email}.`,
      ],
    },
    {
      title: "2. Définitions",
      blocks: [
        [
          "Utilisateur : toute personne titulaire d'un compte WorldHair.",
          "Client : l'Utilisateur qui réserve une prestation.",
          "Coiffeur : le professionnel de la coiffure, exerçant en salon ou à domicile, dont le compte a été validé par WorldHair ; sa fiche sur le Service est appelée « salon ».",
          "Prestation : le service de coiffure proposé par un Coiffeur.",
          "Réservation : le rendez-vous d'un Client pour une ou plusieurs Prestations, à une date et une heure données.",
          "Délai d'annulation : le délai, fixé par chaque Coiffeur et affiché avant la réservation, jusqu'auquel le Client peut annuler ou déplacer une Réservation acceptée.",
        ],
      ],
    },
    {
      title: "3. Compte",
      blocks: [
        "La création d'un compte est gratuite. Elle nécessite une adresse e-mail valide, confirmée par un code envoyé à cette adresse, et un mot de passe. L'Utilisateur fournit des informations exactes et les tient à jour.",
        "L'Utilisateur doit être majeur. Un mineur ne peut réserver que par l'intermédiaire de son représentant légal, depuis le compte de celui-ci.",
        "Les identifiants sont personnels et confidentiels : toute action effectuée depuis un compte est réputée faite par son titulaire. En cas d'utilisation frauduleuse, l'Utilisateur prévient WorldHair sans délai.",
        "L'Utilisateur peut supprimer son compte à tout moment depuis l'application (voir l'article 13).",
      ],
    },
    {
      title: "4. Rôle de WorldHair",
      blocks: [
        "WorldHair met en relation les Clients et les Coiffeurs et fournit les outils de réservation, de paiement, de notification et d'avis. Les Prestations sont réalisées par les Coiffeurs, en toute indépendance et sous leur seule responsabilité : le contrat de prestation est conclu entre le Client et le Coiffeur.",
        "WorldHair vérifie les justificatifs fournis par les Coiffeurs lors de leur inscription, mais ne garantit ni la qualité ni le résultat des Prestations.",
      ],
    },
    {
      title: "5. Coiffeurs",
      blocks: [
        "Inscription. Le Coiffeur crée un compte et dépose un dossier comprenant une pièce d'identité, un diplôme de coiffure, un extrait Kbis ou un extrait du Registre national des entreprises et, pour une activité en salon, un justificatif du local. WorldHair examine le dossier et peut le refuser en indiquant le motif ; le Coiffeur peut alors le corriger et le déposer de nouveau.",
        "Fiche salon. Une fois validé, le Coiffeur complète sa fiche (photo, horaires, prestations, prix, zone d'intervention). Il garantit l'exactitude de ces informations, notamment des prix, affichés toutes taxes comprises, et de ses disponibilités.",
        "Obligations. Le Coiffeur exerce dans le respect de la réglementation applicable à la coiffure (qualification professionnelle, immatriculation, obligations fiscales et sociales, hygiène), est assuré en responsabilité civile professionnelle, honore les Réservations qu'il a acceptées et répond aux demandes dans les meilleurs délais. Il s'interdit de faire payer hors du Service un rendez-vous réservé par son intermédiaire.",
        "Encaissements. Pour recevoir les paiements de ses Clients, le Coiffeur ouvre un compte auprès de Stripe (Stripe Connect) en acceptant le contrat de compte connecté de Stripe ; Stripe vérifie son identité et ses coordonnées bancaires, que WorldHair ne conserve pas. Tant que ce compte n'est pas actif, son salon n'accepte pas de réservation en ligne.",
      ],
    },
    {
      title: "6. Abonnement des Coiffeurs",
      blocks: [
        // The pro app links to this page: nothing here says where or how the subscription is paid (App Store rule 3.1.3).
        "La présence d'un salon sur le Service est subordonnée à un abonnement, mensuel ou annuel. Ses prix sont indiqués avant la souscription. Le premier abonnement peut commencer par une période d'essai gratuite, dont la durée est indiquée au moment de la souscription.",
        "L'abonnement se renouvelle automatiquement à chaque échéance, jusqu'à sa résiliation. Le Coiffeur peut le résilier à tout moment ; la résiliation prend effet à la fin de la période en cours, qui n'est pas remboursée. Si un paiement échoue et n'aboutit pas après de nouvelles tentatives, l'abonnement prend fin et le salon n'est plus visible.",
        "WorldHair peut offrir une période d'abonnement ; elle prend fin à la date indiquée dans l'espace Coiffeur.",
      ],
    },
    {
      title: "7. Réservation",
      blocks: [
        "Le Client choisit une ou plusieurs Prestations et un créneau parmi ceux proposés, qui tiennent compte des horaires du salon, de ses fermetures, de ses autres rendez-vous et du délai de prévenance qu'il a fixé.",
        "La Réservation est payée en ligne au moment de la demande (article 8). Le créneau est retenu pendant le paiement, pendant quinze minutes au plus. Selon le choix du salon, la Réservation est confirmée immédiatement ou soumise à son acceptation ; le Client est informé de la réponse. Une demande que le salon n'a pas acceptée à l'heure prévue du rendez-vous est annulée et intégralement remboursée.",
      ],
    },
    {
      title: "8. Prix et paiement",
      blocks: [
        "Les prix des Prestations sont fixés librement par chaque Coiffeur et affichés en euros, toutes taxes comprises. L'utilisation du Service est gratuite pour les Clients : aucun frais de réservation n'est ajouté au prix.",
        "Le Client paie le prix total de sa Réservation par carte bancaire, sur la page de paiement sécurisée de Stripe, prestataire de services de paiement agréé. Les données de carte sont traitées par Stripe ; WorldHair n'y a pas accès.",
        "Commission. Pour chaque Prestation payée sur le Service, WorldHair perçoit une commission sur le montant conservé par le Client, après remboursements éventuels, prélevée sur la somme reversée au Coiffeur. Son taux est de 10 % à la date des présentes CGU et peut évoluer ; le taux applicable à une Prestation est celui en vigueur le jour où le Client la paie. Le Client ne paie aucune commission.",
        "Versement. La part du Coiffeur lui est versée sur son compte Stripe 24 heures environ après la fin du rendez-vous, puis sur son compte bancaire selon le calendrier de Stripe.",
      ],
    },
    {
      title: "9. Annulation, modification et remboursement",
      blocks: [
        [
          "Une demande que le salon n'a pas encore acceptée peut être retirée par le Client jusqu'à l'heure du rendez-vous : il est intégralement remboursé.",
          "Une Réservation acceptée peut être annulée ou déplacée par le Client jusqu'au Délai d'annulation du salon, tel qu'affiché lors de la réservation (un changement ultérieur de ce délai ne s'applique pas aux réservations déjà faites). En cas d'annulation, le Client est intégralement remboursé.",
          "Passé ce délai, la Réservation ne peut plus être annulée ni déplacée depuis l'application, et son prix reste dû au Coiffeur, qui peut toutefois consentir un remboursement.",
          "Le refus d'une demande ou l'annulation d'une Réservation par le salon entraîne le remboursement intégral du Client. Si le salon déplace un rendez-vous, le Client peut le déplacer de nouveau ou l'annuler, avec remboursement intégral, jusqu'à l'heure du rendez-vous.",
          "Si le Client ne se présente pas, le Coiffeur peut le signaler dans l'application : le prix n'est pas remboursé.",
          "Jusqu'au versement de sa part, le Coiffeur peut rembourser tout ou partie d'une Prestation depuis son espace.",
        ],
        `Litiges. En cas de différend sur une Réservation, le Client ou le Coiffeur peut contacter WorldHair (${COMPANY.email}). WorldHair peut alors annuler la Réservation en indiquant son motif aux deux parties et rembourser au Client ce qui lui reste dû ; si la part du Coiffeur lui a déjà été versée, elle lui est reprise à due concurrence.`,
        "Les remboursements sont effectués sur la carte utilisée pour le paiement ; leur délai d'apparition dépend de la banque, généralement quelques jours.",
        "Ces règles s'appliquent sans préjudice des droits que le Client tient de la loi, notamment du Code de la consommation.",
      ],
    },
    {
      title: "10. Avis",
      blocks: [
        "Seul un Client ayant réservé et payé une Prestation sur le Service, et dont le rendez-vous a eu lieu, peut publier un avis sur ce salon, une seule fois par rendez-vous. Aucun avis n'est possible sur un rendez-vous que le salon a signalé comme non honoré.",
        "L'avis comprend une note de 1 à 5, des qualités à cocher et, s'il le souhaite, un commentaire. Il est publié sous le prénom de son auteur et l'initiale de son nom, avec sa date ; les avis sont présentés du plus récent au plus ancien. Le Coiffeur peut y répondre publiquement.",
        "Les avis ne donnent lieu à aucune contrepartie et ne sont pas modifiés par WorldHair. La note d'un salon est la moyenne des avis publiés.",
        "Tout Utilisateur peut signaler un avis qu'il estime illicite ou contraire aux présentes CGU (propos injurieux, faux avis, informations personnelles, publicité). WorldHair examine les signalements et peut masquer l'avis ; un avis masqué n'est plus visible et ne compte plus dans la note du salon.",
        "Un avis reste publié tant que le salon est présent sur le Service ; si son auteur supprime son compte, il est conservé sans son nom, sous la mention « Ancien client ».",
      ],
    },
    {
      title: "11. Règles de conduite",
      blocks: [
        "L'Utilisateur s'interdit notamment :",
        [
          "de fournir de fausses informations ou d'usurper l'identité d'un tiers ;",
          "de publier des contenus illicites, injurieux, diffamatoires ou portant atteinte aux droits de tiers ;",
          "de réserver sans intention d'honorer le rendez-vous ;",
          "de perturber le fonctionnement du Service ou d'en extraire des données de façon automatisée.",
        ],
      ],
    },
    {
      title: "12. Suspension",
      blocks: [
        "En cas de manquement aux présentes CGU, de fraude ou de risque pour les Utilisateurs, WorldHair peut suspendre ou fermer un compte, le cas échéant sans préavis. Le salon d'un Coiffeur suspendu n'est plus visible et son abonnement est suspendu ou résilié.",
      ],
    },
    {
      title: "13. Suppression du compte",
      blocks: [
        `L'Utilisateur peut supprimer son compte à tout moment depuis l'application, ou en écrivant à ${COMPANY.email}. La suppression est définitive.`,
        "Pour un Client, les Réservations qu'il pouvait encore annuler sont annulées et intégralement remboursées, et le salon en est informé ; celles dont le Délai d'annulation est passé restent dues au Coiffeur, comme si le Client avait conservé son compte.",
        "Pour un Coiffeur, toutes ses Réservations à venir sont annulées, ses Clients intégralement remboursés et informés, les sommes qui lui sont dues pour des rendez-vous passés lui sont versées, et son abonnement prend fin sans remboursement de la période en cours. Si des sommes lui sont dues alors que ses encaissements ne sont pas actifs, il doit d'abord les activer, ou contacter WorldHair.",
        "Les données du compte sont effacées. Les Réservations et paiements passés, que la loi impose de conserver pour la comptabilité, sont gardés sans le nom, les coordonnées ni les messages de l'Utilisateur (voir la [politique de confidentialité](/confidentialite)).",
      ],
    },
    {
      title: "14. Responsabilité",
      blocks: [
        "WorldHair s'efforce d'assurer l'accès au Service en continu mais ne peut le garantir ; des interruptions peuvent survenir, notamment pour maintenance.",
        "WorldHair n'est pas responsable de l'exécution des Prestations, qui relève du seul Coiffeur, ni des contenus publiés par les Utilisateurs. Sa responsabilité ne saurait être engagée en cas de force majeure ou du fait d'un tiers.",
      ],
    },
    {
      title: "15. Propriété intellectuelle",
      blocks: [
        "La marque WorldHair, l'application, le site et leurs contenus sont protégés ; toute reproduction non autorisée est interdite.",
        "En publiant des photos, des descriptions ou des avis, l'Utilisateur concède à WorldHair, pour la durée de leur publication, le droit non exclusif et gratuit de les reproduire et de les afficher sur le Service, et garantit détenir les droits nécessaires.",
      ],
    },
    {
      title: "16. Données personnelles",
      blocks: [
        "WorldHair traite les données personnelles des Utilisateurs conformément à sa [politique de confidentialité](/confidentialite).",
      ],
    },
    {
      title: "17. Modification des CGU",
      blocks: [
        "WorldHair peut modifier les présentes CGU. La nouvelle version est présentée dans l'application, où l'Utilisateur doit l'accepter pour continuer à utiliser le Service ; les Réservations déjà faites restent régies par la version en vigueur à leur date.",
      ],
    },
    {
      title: "18. Droit applicable et litiges",
      blocks: [
        `Les présentes CGU sont soumises au droit français. En cas de litige, le Client consommateur peut recourir gratuitement au médiateur de la consommation : ${COMPANY.mediator}. À défaut d'accord amiable, les tribunaux français sont compétents, dans les conditions prévues par la loi.`,
      ],
    },
    {
      title: "19. Contact",
      blocks: [`${COMPANY.name}, ${COMPANY.address} — ${COMPANY.email}.`],
    },
  ],
};
