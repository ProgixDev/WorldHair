import type { OpeningDay, Salon } from "./types";

/**
 * Demo catalogue. No backend exists yet (see TODO.md), so the app reads salons
 * from here; swapping in an API means replacing this module and `geo` stays.
 * Coordinates are real Paris locations so the map and the distances behave.
 */

const HOURS_STANDARD = hours({ open: 9 * 60, close: 19 * 60, closed: [0] });
const HOURS_LATE = hours({ open: 10 * 60, close: 21 * 60, closed: [0, 1] });
const HOURS_EARLY = hours({ open: 8 * 60, close: 18 * 60, closed: [0] });

function hours(config: {
  open: number;
  close: number;
  closed: number[];
}): OpeningDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    config.closed.includes(weekday)
      ? { weekday, opens: null, closes: null }
      : { weekday, opens: config.open, closes: config.close },
  );
}

export const SALONS: Salon[] = [
  {
    id: "studio-w",
    name: "Studio W",
    stylist: "Sofia Benali",
    tagline: "Coupe sur-mesure & couleur douce",
    description:
      "Un atelier lumineux de deux fauteuils, pensé pour prendre le temps. Diagnostic complet avant chaque couleur, produits sans ammoniaque.",
    cover: "storefront",
    addressLine: "12 rue des Lilas",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8619,
    longitude: 2.3765,
    rating: 4.9,
    reviewCount: 128,
    priceFrom: 35,
    specialties: ["coupe", "coloration", "soins"],
    services: [
      {
        id: "studio-w-coupe",
        name: "Coupe & brushing",
        price: 45,
        durationMin: 45,
        specialty: "coupe",
        description: "Diagnostic, shampooing, coupe et coiffage.",
      },
      {
        id: "studio-w-balayage",
        name: "Balayage lumière",
        price: 120,
        durationMin: 150,
        specialty: "coloration",
      },
      {
        id: "studio-w-soin",
        name: "Soin profond kératine",
        price: 35,
        durationMin: 30,
        specialty: "soins",
      },
    ],
    reviews: [
      {
        id: "studio-w-r1",
        author: "Camille D.",
        rating: 5,
        date: "2026-08-02",
        comment:
          "Premier balayage réussi du premier coup, et zéro casse. Sofia explique tout ce qu'elle fait.",
        reply: "Merci Camille, à très vite pour le rafraîchissement !",
      },
      {
        id: "studio-w-r2",
        author: "Inès B.",
        rating: 5,
        date: "2026-07-21",
        comment:
          "Salon calme, on ne se sent pas pressée. La coupe tombe seule.",
      },
      {
        id: "studio-w-r3",
        author: "Thomas L.",
        rating: 4,
        date: "2026-07-04",
        comment: "Très bon travail, petit retard de dix minutes sur le RDV.",
      },
    ],
    hours: HOURS_STANDARD,
  },
  {
    id: "maison-tresse",
    name: "Maison Tresse",
    stylist: "Awa Diallo",
    tagline: "Tresses, locks et protective styles",
    description:
      "Spécialiste des cheveux texturés depuis douze ans. Tresses sans tension, locks entretenues, conseils routine offerts.",
    cover: "styles",
    addressLine: "48 boulevard de Belleville",
    postalCode: "75020",
    city: "Paris",
    latitude: 48.8687,
    longitude: 2.3805,
    rating: 4.8,
    reviewCount: 214,
    priceFrom: 40,
    specialties: ["afro", "tresses", "soins"],
    services: [
      {
        id: "maison-tresse-box",
        name: "Box braids longueur épaules",
        price: 110,
        durationMin: 240,
        specialty: "tresses",
      },
      {
        id: "maison-tresse-locks",
        name: "Reprise de locks",
        price: 70,
        durationMin: 120,
        specialty: "tresses",
      },
      {
        id: "maison-tresse-wash",
        name: "Wash & go définition",
        price: 40,
        durationMin: 60,
        specialty: "afro",
      },
    ],
    reviews: [
      {
        id: "maison-tresse-r1",
        author: "Fatou S.",
        rating: 5,
        date: "2026-08-10",
        comment:
          "Aucune tension, aucune douleur, et les tresses tiennent six semaines.",
      },
      {
        id: "maison-tresse-r2",
        author: "Lina M.",
        rating: 5,
        date: "2026-06-28",
        comment:
          "Awa prend soin du cuir chevelu avant tout. Je ne vais plus ailleurs.",
        reply: "Merci Lina, pense au soin hydratant entre deux poses.",
      },
    ],
    hours: HOURS_LATE,
  },
  {
    id: "le-comptoir-barbier",
    name: "Le Comptoir Barbier",
    stylist: "Yanis Kaced",
    tagline: "Barbe travaillée, serviette chaude",
    description:
      "Barbier traditionnel avec rasage au coupe-chou, dégradés américains et entretien de barbe à l'huile chaude.",
    cover: "portrait",
    addressLine: "7 rue Oberkampf",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8649,
    longitude: 2.3689,
    rating: 4.7,
    reviewCount: 96,
    priceFrom: 22,
    specialties: ["barbier", "coupe"],
    services: [
      {
        id: "comptoir-degrade",
        name: "Dégradé + contours",
        price: 28,
        durationMin: 40,
        specialty: "coupe",
      },
      {
        id: "comptoir-barbe",
        name: "Taille de barbe serviette chaude",
        price: 22,
        durationMin: 30,
        specialty: "barbier",
      },
      {
        id: "comptoir-combo",
        name: "Combo coupe + barbe",
        price: 45,
        durationMin: 60,
        specialty: "barbier",
      },
    ],
    reviews: [
      {
        id: "comptoir-r1",
        author: "Malik R.",
        rating: 5,
        date: "2026-08-14",
        comment: "Dégradé net, bonne ambiance, café offert.",
      },
      {
        id: "comptoir-r2",
        author: "Hugo P.",
        rating: 4,
        date: "2026-07-30",
        comment: "Très bon rasage. Salon un peu bruyant le samedi.",
      },
    ],
    hours: HOURS_EARLY,
  },
  {
    id: "atelier-nuance",
    name: "Atelier Nuance",
    stylist: "Claire Fontaine",
    tagline: "Colorations végétales & blond froid",
    description:
      "Coloriste exclusive. Blonds polaires, patines sur-mesure et couleurs végétales pour les cuirs chevelus sensibles.",
    cover: "styles",
    addressLine: "23 rue de Turenne",
    postalCode: "75003",
    city: "Paris",
    latitude: 48.8595,
    longitude: 2.3629,
    rating: 4.6,
    reviewCount: 74,
    priceFrom: 55,
    specialties: ["coloration", "soins"],
    services: [
      {
        id: "nuance-patine",
        name: "Patine + soin",
        price: 55,
        durationMin: 60,
        specialty: "coloration",
      },
      {
        id: "nuance-vegetale",
        name: "Coloration végétale",
        price: 90,
        durationMin: 120,
        specialty: "coloration",
      },
      {
        id: "nuance-blond",
        name: "Passage au blond",
        price: 180,
        durationMin: 210,
        specialty: "coloration",
      },
    ],
    reviews: [
      {
        id: "nuance-r1",
        author: "Élodie V.",
        rating: 5,
        date: "2026-08-05",
        comment: "Enfin un blond sans reflets jaunes. Claire est méticuleuse.",
      },
      {
        id: "nuance-r2",
        author: "Sarah K.",
        rating: 4,
        date: "2026-05-18",
        comment: "Résultat superbe, prévoir la demi-journée quand même.",
      },
    ],
    hours: HOURS_STANDARD,
  },
  {
    id: "racines",
    name: "Racines",
    stylist: "Nadia Oumar",
    tagline: "Cheveux texturés, coupe à sec",
    description:
      "Coupe à sec boucle par boucle, diagnostic de porosité et routine personnalisée. Produits sans silicone.",
    cover: "portrait",
    addressLine: "5 rue du Faubourg Saint-Denis",
    postalCode: "75010",
    city: "Paris",
    latitude: 48.8705,
    longitude: 2.3538,
    rating: 4.9,
    reviewCount: 158,
    priceFrom: 45,
    specialties: ["afro", "coupe", "soins"],
    services: [
      {
        id: "racines-coupe",
        name: "Coupe boucles à sec",
        price: 65,
        durationMin: 75,
        specialty: "coupe",
      },
      {
        id: "racines-diagnostic",
        name: "Diagnostic + routine",
        price: 45,
        durationMin: 45,
        specialty: "soins",
      },
      {
        id: "racines-defrisage",
        name: "Soin réparateur intense",
        price: 60,
        durationMin: 90,
        specialty: "afro",
      },
    ],
    reviews: [
      {
        id: "racines-r1",
        author: "Aïcha T.",
        rating: 5,
        date: "2026-08-12",
        comment:
          "Première fois qu'on m'explique ma porosité. Mes boucles revivent.",
        reply: "Merci Aïcha ! Pense au masque toutes les deux semaines.",
      },
      {
        id: "racines-r2",
        author: "Manon G.",
        rating: 5,
        date: "2026-07-15",
        comment: "Coupe à sec impeccable, aucune longueur perdue.",
      },
    ],
    hours: HOURS_STANDARD,
  },
  {
    id: "salon-celeste",
    name: "Salon Céleste",
    stylist: "Marie Lambert",
    tagline: "Chignons et coiffures de mariage",
    description:
      "Essais mariage, chignons tressés et coiffures d'invitées. Déplacement possible le jour J.",
    cover: "storefront",
    addressLine: "31 avenue Victor Hugo",
    postalCode: "75116",
    city: "Paris",
    latitude: 48.8709,
    longitude: 2.2861,
    rating: 4.8,
    reviewCount: 62,
    priceFrom: 60,
    specialties: ["mariage", "coupe"],
    services: [
      {
        id: "celeste-essai",
        name: "Essai coiffure mariage",
        price: 90,
        durationMin: 90,
        specialty: "mariage",
      },
      {
        id: "celeste-jour-j",
        name: "Coiffure jour J",
        price: 180,
        durationMin: 120,
        specialty: "mariage",
      },
      {
        id: "celeste-invitee",
        name: "Chignon invitée",
        price: 60,
        durationMin: 45,
        specialty: "mariage",
      },
    ],
    reviews: [
      {
        id: "celeste-r1",
        author: "Julie A.",
        rating: 5,
        date: "2026-06-20",
        comment: "Chignon tenu toute la nuit, sous la pluie en plus.",
      },
    ],
    hours: HOURS_STANDARD,
  },
  {
    id: "coupe-carre",
    name: "Coupe Carré",
    stylist: "Léo Mercier",
    tagline: "Coupes graphiques, sans chichi",
    description:
      "Coupe franche, carré court, mulet moderne. Trente minutes chrono, tarif unique.",
    cover: "styles",
    addressLine: "88 rue de Charonne",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8541,
    longitude: 2.3835,
    rating: 4.5,
    reviewCount: 187,
    priceFrom: 30,
    specialties: ["coupe"],
    services: [
      {
        id: "carre-coupe",
        name: "Coupe signature",
        price: 30,
        durationMin: 30,
        specialty: "coupe",
      },
      {
        id: "carre-frange",
        name: "Retouche frange",
        price: 12,
        durationMin: 15,
        specialty: "coupe",
      },
    ],
    reviews: [
      {
        id: "carre-r1",
        author: "Noor H.",
        rating: 5,
        date: "2026-08-08",
        comment: "Rapide et précis, exactement la coupe demandée.",
      },
      {
        id: "carre-r2",
        author: "Paul E.",
        rating: 4,
        date: "2026-07-02",
        comment: "Bon rapport qualité prix, salon minimaliste.",
      },
    ],
    hours: HOURS_LATE,
  },
  {
    id: "onde",
    name: "Onde",
    stylist: "Chloé Rivière",
    tagline: "Ondulations douces & soins bio",
    description:
      "Permanentes modernes, brushings texturés et soins à base d'huiles froides pressées.",
    cover: "portrait",
    addressLine: "14 rue Daguerre",
    postalCode: "75014",
    city: "Paris",
    latitude: 48.8339,
    longitude: 2.3271,
    rating: 4.7,
    reviewCount: 91,
    priceFrom: 38,
    specialties: ["coupe", "soins", "coloration"],
    services: [
      {
        id: "onde-brushing",
        name: "Brushing texturé",
        price: 38,
        durationMin: 40,
        specialty: "coupe",
      },
      {
        id: "onde-permanente",
        name: "Permanente douce",
        price: 135,
        durationMin: 180,
        specialty: "soins",
      },
      {
        id: "onde-gloss",
        name: "Gloss brillance",
        price: 48,
        durationMin: 45,
        specialty: "coloration",
      },
    ],
    reviews: [
      {
        id: "onde-r1",
        author: "Emma C.",
        rating: 5,
        date: "2026-07-27",
        comment: "Ondulations naturelles, pas l'effet mouton redouté.",
      },
    ],
    hours: HOURS_STANDARD,
  },
];

export function getSalonById(id: string): Salon | undefined {
  return SALONS.find((salon) => salon.id === id);
}

export function getServiceById(
  salonId: string,
  serviceId: string,
): Salon["services"][number] | undefined {
  return getSalonById(salonId)?.services.find((s) => s.id === serviceId);
}
