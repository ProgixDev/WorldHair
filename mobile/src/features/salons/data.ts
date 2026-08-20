import type { OpeningDay, Review, Salon, Service, SpecialtyId } from "./types";

/**
 * Demo catalogue. No backend exists yet (see TODO.md), so the app reads salons
 * from here. Each salon is a short seed expanded by `buildSalon`: services come
 * from a per-specialty catalogue, reviews from a phrase bank. Everything is
 * derived deterministically from the salon id, so prices, opening hours and
 * reviews never reshuffle between launches.
 */

// ─── Opening hours ───────────────────────────────────────────────────────────

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

const HOUR_PRESETS: OpeningDay[][] = [
  hours({ open: 9 * 60, close: 19 * 60, closed: [0] }),
  hours({ open: 10 * 60, close: 21 * 60, closed: [0, 1] }),
  hours({ open: 8 * 60, close: 18 * 60, closed: [0] }),
  hours({ open: 9 * 60 + 30, close: 20 * 60, closed: [0, 3] }),
];

// ─── Service catalogue ───────────────────────────────────────────────────────

interface ServiceTemplate {
  key: string;
  name: string;
  price: number;
  durationMin: number;
  description?: string;
}

const SERVICE_CATALOG: Record<SpecialtyId, ServiceTemplate[]> = {
  coupe: [
    {
      key: "coupe-brushing",
      name: "Coupe & brushing",
      price: 45,
      durationMin: 45,
      description: "Diagnostic, shampooing, coupe et coiffage.",
    },
    { key: "coupe-homme", name: "Coupe homme", price: 28, durationMin: 30 },
    {
      key: "coupe-frange",
      name: "Retouche frange",
      price: 14,
      durationMin: 15,
    },
    {
      key: "coupe-enfant",
      name: "Coupe enfant (-12 ans)",
      price: 22,
      durationMin: 30,
    },
  ],
  coloration: [
    {
      key: "coloration-racines",
      name: "Retouche racines",
      price: 58,
      durationMin: 75,
    },
    {
      key: "coloration-balayage",
      name: "Balayage lumière",
      price: 120,
      durationMin: 150,
      description: "Éclaircissement progressif, patine incluse.",
    },
    {
      key: "coloration-gloss",
      name: "Gloss brillance",
      price: 48,
      durationMin: 45,
    },
    {
      key: "coloration-vegetale",
      name: "Coloration végétale",
      price: 90,
      durationMin: 120,
    },
  ],
  afro: [
    {
      key: "afro-wash",
      name: "Wash & go définition",
      price: 42,
      durationMin: 60,
    },
    {
      key: "afro-coupe",
      name: "Coupe boucles à sec",
      price: 65,
      durationMin: 75,
      description: "Boucle par boucle, sans perte de longueur.",
    },
    {
      key: "afro-soin",
      name: "Soin réparateur intense",
      price: 60,
      durationMin: 90,
    },
  ],
  tresses: [
    {
      key: "tresses-box",
      name: "Box braids épaules",
      price: 110,
      durationMin: 240,
    },
    {
      key: "tresses-locks",
      name: "Reprise de locks",
      price: 70,
      durationMin: 120,
    },
    {
      key: "tresses-cornrows",
      name: "Cornrows créatives",
      price: 65,
      durationMin: 150,
    },
    {
      key: "tresses-twists",
      name: "Twists longue durée",
      price: 95,
      durationMin: 210,
    },
  ],
  barbier: [
    {
      key: "barbier-barbe",
      name: "Taille de barbe serviette chaude",
      price: 24,
      durationMin: 30,
    },
    {
      key: "barbier-rasage",
      name: "Rasage traditionnel",
      price: 32,
      durationMin: 45,
    },
    {
      key: "barbier-combo",
      name: "Combo coupe + barbe",
      price: 48,
      durationMin: 60,
    },
  ],
  soins: [
    {
      key: "soins-keratine",
      name: "Soin profond kératine",
      price: 38,
      durationMin: 30,
    },
    {
      key: "soins-cuir",
      name: "Rituel cuir chevelu",
      price: 52,
      durationMin: 45,
      description: "Gommage, massage et huiles froides pressées.",
    },
    {
      key: "soins-lissage",
      name: "Lissage soin longue durée",
      price: 140,
      durationMin: 180,
    },
  ],
  mariage: [
    {
      key: "mariage-essai",
      name: "Essai coiffure mariage",
      price: 90,
      durationMin: 90,
    },
    {
      key: "mariage-jour-j",
      name: "Coiffure jour J",
      price: 180,
      durationMin: 120,
    },
    {
      key: "mariage-invitee",
      name: "Chignon invitée",
      price: 60,
      durationMin: 45,
    },
  ],
};

// ─── Review bank ─────────────────────────────────────────────────────────────

const AUTHORS = [
  "Camille D.",
  "Inès B.",
  "Thomas L.",
  "Fatou S.",
  "Lina M.",
  "Malik R.",
  "Hugo P.",
  "Élodie V.",
  "Sarah K.",
  "Aïcha T.",
  "Manon G.",
  "Julie A.",
  "Noor H.",
  "Paul E.",
  "Emma C.",
  "Rachid B.",
  "Chloé N.",
  "Yasmine O.",
  "Antoine F.",
  "Leïla Z.",
  "Marine T.",
  "Kevin S.",
];

interface ReviewTemplate {
  rating: number;
  comment: string;
  reply?: string;
}

const REVIEW_BANK: ReviewTemplate[] = [
  {
    rating: 5,
    comment:
      "Résultat exactement comme sur la photo que j'avais apportée. On sent le métier.",
    reply: "Merci beaucoup ! À très vite pour l'entretien.",
  },
  {
    rating: 5,
    comment:
      "Salon calme, on ne se sent jamais pressée. La coupe retombe toute seule au réveil.",
  },
  {
    rating: 5,
    comment:
      "Premier passage et je reviens déjà le mois prochain. Diagnostic très précis avant de commencer.",
  },
  {
    rating: 4,
    comment:
      "Très bon travail, petit retard de dix minutes sur l'heure du rendez-vous.",
  },
  {
    rating: 5,
    comment:
      "Aucune tension, aucune douleur, et la coiffure tient depuis six semaines.",
    reply: "Ravie que ça tienne aussi bien, pensez au spray hydratant.",
  },
  {
    rating: 4,
    comment:
      "Résultat superbe mais prévoyez large sur la durée, c'est plus long qu'annoncé.",
  },
  {
    rating: 5,
    comment:
      "Enfin quelqu'un qui écoute avant de couper. Conseils routine offerts en prime.",
  },
  {
    rating: 5,
    comment: "Ambiance chaleureuse, café offert, et un dégradé impeccable.",
  },
  {
    rating: 4,
    comment: "Bon rapport qualité-prix. Le salon est petit, réservez tôt.",
  },
  {
    rating: 5,
    comment:
      "Couleur parfaite du premier coup, zéro casse sur des cheveux pourtant fragiles.",
    reply: "Merci ! On garde ce protocole la prochaine fois.",
  },
  {
    rating: 3,
    comment:
      "Coupe correcte mais je m'attendais à un peu plus de conseils sur l'entretien.",
    reply: "Merci du retour, on prendra le temps d'en parler au prochain RDV.",
  },
  {
    rating: 5,
    comment: "Rapide, précis, et le prix annoncé est le prix payé.",
  },
  {
    rating: 4,
    comment: "Très à l'écoute. Le résultat a un peu bougé après trois lavages.",
  },
  {
    rating: 5,
    comment:
      "Je viens de l'autre bout de la ville pour ce salon, ça vaut le trajet.",
  },
  {
    rating: 5,
    comment: "Mon cuir chevelu est sensible, aucune irritation cette fois.",
  },
  {
    rating: 4,
    comment: "Accueil impeccable, résultat conforme, je recommande.",
  },
];

// ─── Salon seeds ─────────────────────────────────────────────────────────────

interface SalonSeed {
  id: string;
  name: string;
  stylist: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  specialties: SpecialtyId[];
  badges?: string[];
}

const SEEDS: SalonSeed[] = [
  // ── Paris ──────────────────────────────────────────────────────────────
  {
    id: "studio-w",
    name: "Studio W",
    stylist: "Sofia Benali",
    tagline: "Coupe sur-mesure & couleur douce",
    description:
      "Un atelier lumineux de deux fauteuils, pensé pour prendre le temps. Diagnostic complet avant chaque couleur, produits sans ammoniaque.",
    addressLine: "12 rue des Lilas",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8619,
    longitude: 2.3765,
    rating: 4.9,
    reviewCount: 128,
    specialties: ["coupe", "coloration", "soins"],
    badges: ["Coup de cœur"],
  },
  {
    id: "maison-tresse",
    name: "Maison Tresse",
    stylist: "Awa Diallo",
    tagline: "Tresses, locks et protective styles",
    description:
      "Spécialiste des cheveux texturés depuis douze ans. Tresses sans tension, locks entretenues, conseils routine offerts.",
    addressLine: "48 boulevard de Belleville",
    postalCode: "75020",
    city: "Paris",
    latitude: 48.8687,
    longitude: 2.3805,
    rating: 4.8,
    reviewCount: 214,
    specialties: ["afro", "tresses", "soins"],
    badges: ["Expert cheveux texturés"],
  },
  {
    id: "le-comptoir-barbier",
    name: "Le Comptoir Barbier",
    stylist: "Yanis Kaced",
    tagline: "Barbe travaillée, serviette chaude",
    description:
      "Barbier traditionnel : rasage au coupe-chou, dégradés américains et entretien de barbe à l'huile chaude.",
    addressLine: "7 rue Oberkampf",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8649,
    longitude: 2.3689,
    rating: 4.7,
    reviewCount: 96,
    specialties: ["barbier", "coupe"],
  },
  {
    id: "atelier-nuance",
    name: "Atelier Nuance",
    stylist: "Claire Fontaine",
    tagline: "Colorations végétales & blond froid",
    description:
      "Coloriste exclusive. Blonds polaires, patines sur-mesure et couleurs végétales pour les cuirs chevelus sensibles.",
    addressLine: "23 rue de Turenne",
    postalCode: "75003",
    city: "Paris",
    latitude: 48.8595,
    longitude: 2.3629,
    rating: 4.6,
    reviewCount: 74,
    specialties: ["coloration", "soins"],
  },
  {
    id: "racines",
    name: "Racines",
    stylist: "Nadia Oumar",
    tagline: "Cheveux texturés, coupe à sec",
    description:
      "Coupe à sec boucle par boucle, diagnostic de porosité et routine personnalisée. Produits sans silicone.",
    addressLine: "5 rue du Faubourg Saint-Denis",
    postalCode: "75010",
    city: "Paris",
    latitude: 48.8705,
    longitude: 2.3538,
    rating: 4.9,
    reviewCount: 158,
    specialties: ["afro", "coupe", "soins"],
    badges: ["Coup de cœur"],
  },
  {
    id: "salon-celeste",
    name: "Salon Céleste",
    stylist: "Marie Lambert",
    tagline: "Chignons et coiffures de mariage",
    description:
      "Essais mariage, chignons tressés et coiffures d'invitées. Déplacement possible le jour J.",
    addressLine: "31 avenue Victor Hugo",
    postalCode: "75116",
    city: "Paris",
    latitude: 48.8709,
    longitude: 2.2861,
    rating: 4.8,
    reviewCount: 62,
    specialties: ["mariage", "coupe"],
  },
  {
    id: "coupe-carre",
    name: "Coupe Carré",
    stylist: "Léo Mercier",
    tagline: "Coupes graphiques, sans chichi",
    description:
      "Coupe franche, carré court, mulet moderne. Trente minutes chrono, tarif unique.",
    addressLine: "88 rue de Charonne",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8541,
    longitude: 2.3835,
    rating: 4.5,
    reviewCount: 187,
    specialties: ["coupe"],
  },
  {
    id: "onde",
    name: "Onde",
    stylist: "Chloé Rivière",
    tagline: "Ondulations douces & soins bio",
    description:
      "Permanentes modernes, brushings texturés et soins à base d'huiles froides pressées.",
    addressLine: "14 rue Daguerre",
    postalCode: "75014",
    city: "Paris",
    latitude: 48.8339,
    longitude: 2.3271,
    rating: 4.7,
    reviewCount: 91,
    specialties: ["coupe", "soins", "coloration"],
  },
  {
    id: "atelier-montmartre",
    name: "Atelier Montmartre",
    stylist: "Julien Roche",
    tagline: "Coiffeur de quartier, esprit atelier",
    description:
      "Un fauteuil, un client à la fois. Coupes classiques revisitées et conseils sans jargon.",
    addressLine: "3 rue des Abbesses",
    postalCode: "75018",
    city: "Paris",
    latitude: 48.8845,
    longitude: 2.3383,
    rating: 4.6,
    reviewCount: 143,
    specialties: ["coupe", "barbier"],
  },
  {
    id: "eclat-marais",
    name: "Éclat Marais",
    stylist: "Salomé Petit",
    tagline: "Brillance, gloss et couleurs vives",
    description:
      "Le salon des couleurs assumées : pastel, cuivré profond, gloss miroir. Test de mèche systématique.",
    addressLine: "17 rue des Rosiers",
    postalCode: "75004",
    city: "Paris",
    latitude: 48.8571,
    longitude: 2.3596,
    rating: 4.4,
    reviewCount: 208,
    specialties: ["coloration", "coupe"],
    badges: ["Nouveau"],
  },
  {
    id: "barbe-noire",
    name: "Barbe Noire",
    stylist: "Idriss Amrani",
    tagline: "Barbershop tard le soir",
    description:
      "Ouvert jusqu'à 21 h. Dégradés nets, tracé au rasoir et soin de barbe complet.",
    addressLine: "62 rue du Faubourg Saint-Martin",
    postalCode: "75010",
    city: "Paris",
    latitude: 48.8721,
    longitude: 2.3576,
    rating: 4.7,
    reviewCount: 176,
    specialties: ["barbier", "coupe"],
  },
  {
    id: "boucles-libres",
    name: "Boucles Libres",
    stylist: "Estelle Nguyen",
    tagline: "Méthode curly, zéro sulfate",
    description:
      "Formation curly method, définition des boucles et transition sans coupe brutale.",
    addressLine: "9 rue de la Roquette",
    postalCode: "75011",
    city: "Paris",
    latitude: 48.8542,
    longitude: 2.3721,
    rating: 4.8,
    reviewCount: 119,
    specialties: ["afro", "soins"],
  },

  // ── Lyon ───────────────────────────────────────────────────────────────
  {
    id: "atelier-croix-rousse",
    name: "Atelier Croix-Rousse",
    stylist: "Baptiste Colin",
    tagline: "Coupe artisanale sur la colline",
    description:
      "Salon d'angle sur les pentes. Coupes travaillées au rasoir et couleurs naturelles.",
    addressLine: "12 rue Burdeau",
    postalCode: "69001",
    city: "Lyon",
    latitude: 45.7716,
    longitude: 4.8331,
    rating: 4.7,
    reviewCount: 132,
    specialties: ["coupe", "coloration"],
  },
  {
    id: "presquile-hair",
    name: "Presqu'île Hair",
    stylist: "Camille Berger",
    tagline: "Blond, balayage et brushing",
    description:
      "Spécialiste du blond lyonnais depuis 2014. Patines froides et soins profonds.",
    addressLine: "24 rue de Brest",
    postalCode: "69002",
    city: "Lyon",
    latitude: 45.7614,
    longitude: 4.8339,
    rating: 4.6,
    reviewCount: 205,
    specialties: ["coloration", "soins", "coupe"],
  },
  {
    id: "tresses-guillotiere",
    name: "Tresses Guillotière",
    stylist: "Mariam Sy",
    tagline: "Tresses, twists et perruques",
    description:
      "Poses longues sans tension, entretien de perruques et closures sur mesure.",
    addressLine: "5 rue Paul Bert",
    postalCode: "69003",
    city: "Lyon",
    latitude: 45.7592,
    longitude: 4.8492,
    rating: 4.8,
    reviewCount: 167,
    specialties: ["tresses", "afro"],
    badges: ["Expert cheveux texturés"],
  },

  // ── Marseille ──────────────────────────────────────────────────────────
  {
    id: "vieux-port-coiffure",
    name: "Vieux-Port Coiffure",
    stylist: "Nina Ferrari",
    tagline: "Coupes solaires, cheveux de mer",
    description:
      "Réparation post-soleil et sel, coupes longues aérées, soins hydratants intenses.",
    addressLine: "18 quai de Rive Neuve",
    postalCode: "13007",
    city: "Marseille",
    latitude: 43.2919,
    longitude: 5.3706,
    rating: 4.5,
    reviewCount: 154,
    specialties: ["coupe", "soins"],
  },
  {
    id: "cours-julien-studio",
    name: "Cours Julien Studio",
    stylist: "Tarek Bouzid",
    tagline: "Barbier & coupes urbaines",
    description:
      "Dégradés, tracés nets et barbes sculptées au cœur du quartier des artistes.",
    addressLine: "40 cours Julien",
    postalCode: "13006",
    city: "Marseille",
    latitude: 43.2933,
    longitude: 5.3841,
    rating: 4.7,
    reviewCount: 221,
    specialties: ["barbier", "coupe"],
  },
  {
    id: "azur-mariage",
    name: "Azur Mariage",
    stylist: "Laura Sabbah",
    tagline: "Coiffures d'événement en Provence",
    description:
      "Chignons bohèmes, tresses couronne et essais à domicile dans tout le département.",
    addressLine: "7 rue Sainte",
    postalCode: "13001",
    city: "Marseille",
    latitude: 43.2932,
    longitude: 5.3721,
    rating: 4.9,
    reviewCount: 58,
    specialties: ["mariage", "coupe"],
    badges: ["Coup de cœur"],
  },

  // ── Bordeaux ───────────────────────────────────────────────────────────
  {
    id: "chartrons-atelier",
    name: "Chartrons Atelier",
    stylist: "Hélène Duval",
    tagline: "Couleur naturelle & coupe fluide",
    description:
      "Salon éco-responsable : colorations végétales, eau filtrée et produits rechargeables.",
    addressLine: "56 rue Notre-Dame",
    postalCode: "33000",
    city: "Bordeaux",
    latitude: 44.8514,
    longitude: -0.5729,
    rating: 4.8,
    reviewCount: 112,
    specialties: ["coloration", "coupe", "soins"],
    badges: ["Éco-responsable"],
  },
  {
    id: "saint-michel-barber",
    name: "Saint-Michel Barber",
    stylist: "Ryan Costa",
    tagline: "Barbier rapide, finition nette",
    description:
      "Coupes rapides et barbes précises, deux fauteuils, playlist assumée.",
    addressLine: "11 place Canteloup",
    postalCode: "33800",
    city: "Bordeaux",
    latitude: 44.8339,
    longitude: -0.5646,
    rating: 4.4,
    reviewCount: 189,
    specialties: ["barbier", "coupe"],
  },

  // ── Lille ──────────────────────────────────────────────────────────────
  {
    id: "vieux-lille-coiffure",
    name: "Vieux-Lille Coiffure",
    stylist: "Manon Delattre",
    tagline: "Coupe classique, finition parfaite",
    description:
      "Maison de quartier depuis 1998, reprise par la nouvelle génération. Brushings tenue longue durée.",
    addressLine: "22 rue Basse",
    postalCode: "59800",
    city: "Lille",
    latitude: 50.6414,
    longitude: 3.0631,
    rating: 4.6,
    reviewCount: 146,
    specialties: ["coupe", "coloration"],
  },
  {
    id: "wazemmes-curls",
    name: "Wazemmes Curls",
    stylist: "Sonia Kaba",
    tagline: "Boucles, tresses et soins profonds",
    description:
      "Diagnostic capillaire complet, tresses protectrices et rituels cuir chevelu.",
    addressLine: "3 rue des Sarrazins",
    postalCode: "59000",
    city: "Lille",
    latitude: 50.6259,
    longitude: 3.0537,
    rating: 4.7,
    reviewCount: 98,
    specialties: ["afro", "tresses", "soins"],
  },

  // ── Toulouse ───────────────────────────────────────────────────────────
  {
    id: "capitole-hair",
    name: "Capitole Hair",
    stylist: "Adrien Fabre",
    tagline: "Coupe & couleur en plein centre",
    description:
      "Équipe de cinq coiffeurs, ouvert en continu, réservation la veille possible.",
    addressLine: "8 rue du Taur",
    postalCode: "31000",
    city: "Toulouse",
    latitude: 43.6055,
    longitude: 1.4437,
    rating: 4.5,
    reviewCount: 243,
    specialties: ["coupe", "coloration", "soins"],
  },
  {
    id: "saint-cyprien-tresses",
    name: "Saint-Cyprien Tresses",
    stylist: "Bintou Traoré",
    tagline: "Poses longues et coiffures d'enfants",
    description:
      "Atelier familial : tresses, vanilles et coiffures enfants dans une ambiance calme.",
    addressLine: "15 rue de la République",
    postalCode: "31300",
    city: "Toulouse",
    latitude: 43.5972,
    longitude: 1.4306,
    rating: 4.8,
    reviewCount: 87,
    specialties: ["tresses", "afro"],
  },

  // ── Nantes & Strasbourg ────────────────────────────────────────────────
  {
    id: "bouffay-studio",
    name: "Bouffay Studio",
    stylist: "Alice Renard",
    tagline: "Coupe minimaliste, couleur nude",
    description:
      "Studio épuré au cœur du Bouffay. Coupes nettes et nuances beige signature.",
    addressLine: "6 rue de la Juiverie",
    postalCode: "44000",
    city: "Nantes",
    latitude: 47.2159,
    longitude: -1.5537,
    rating: 4.7,
    reviewCount: 104,
    specialties: ["coupe", "coloration"],
    badges: ["Nouveau"],
  },
  {
    id: "petite-france-coiffure",
    name: "Petite France Coiffure",
    stylist: "Élise Weber",
    tagline: "Soins capillaires et coupes douces",
    description:
      "Rituels cuir chevelu, soins réparateurs et coupes respectueuses de la longueur.",
    addressLine: "4 rue des Dentelles",
    postalCode: "67000",
    city: "Strasbourg",
    latitude: 48.5808,
    longitude: 7.7414,
    rating: 4.9,
    reviewCount: 76,
    specialties: ["soins", "coupe", "mariage"],
    badges: ["Coup de cœur"],
  },
];

// ─── Builder ─────────────────────────────────────────────────────────────────

function hash(value: string): number {
  let out = 7;
  for (let i = 0; i < value.length; i++)
    out = (out * 31 + value.charCodeAt(i)) % 99991;
  return out;
}

/** ±15 % around the catalogue price, stable per salon and service. */
function priceFor(template: ServiceTemplate, salonId: string): number {
  const drift = (hash(salonId + template.key) % 7) - 3;
  return Math.max(10, Math.round((template.price * (100 + drift * 5)) / 100));
}

function servicesFor(seed: SalonSeed): Service[] {
  const services: Service[] = [];
  seed.specialties.forEach((specialty, index) => {
    const templates = SERVICE_CATALOG[specialty];
    const offset = hash(seed.id + specialty) % templates.length;
    // Two services for the leading specialties, one for the rest: a menu of
    // fifteen lines is as unusable as a menu of one.
    const count = index < 2 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const template = templates[(offset + i) % templates.length];
      const id = seed.id + "-" + template.key;
      if (services.some((service) => service.id === id)) continue;
      services.push({
        id,
        name: template.name,
        price: priceFor(template, seed.id),
        durationMin: template.durationMin,
        specialty,
        description: template.description,
      });
    }
  });
  return services;
}

/** Reviews are dated back from a fixed anchor so ordering stays stable. */
const REVIEW_ANCHOR = new Date("2026-08-18T12:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function reviewsFor(seed: SalonSeed): Review[] {
  const base = hash(seed.id);
  const count = 3 + (base % 4); // 3–6 reviews
  return Array.from({ length: count }, (_, index) => {
    const template = REVIEW_BANK[(base + index * 5) % REVIEW_BANK.length];
    const author = AUTHORS[(base + index * 3) % AUTHORS.length];
    const daysAgo = 3 + index * 11 + (base % 9);
    return {
      id: seed.id + "-r" + index,
      author,
      rating: template.rating,
      date: new Date(REVIEW_ANCHOR - daysAgo * DAY_MS).toISOString(),
      comment: template.comment,
      reply: index === 0 ? template.reply : undefined,
    };
  });
}

function buildSalon(seed: SalonSeed): Salon {
  const services = servicesFor(seed);
  return {
    ...seed,
    badges: seed.badges ?? [],
    services,
    reviews: reviewsFor(seed),
    priceFrom: Math.min(...services.map((service) => service.price)),
    hours: HOUR_PRESETS[hash(seed.id) % HOUR_PRESETS.length],
  };
}

export const SALONS: Salon[] = SEEDS.map(buildSalon);

export function getSalonById(id: string): Salon | undefined {
  return SALONS.find((salon) => salon.id === id);
}

export function getServiceById(
  salonId: string,
  serviceId: string,
): Service | undefined {
  return getSalonById(salonId)?.services.find(
    (service) => service.id === serviceId,
  );
}

/** Cities that actually have salons — drives the manual position picker. */
export const SALON_CITIES = Array.from(
  new Set(SALONS.map((salon) => salon.city)),
);
