# WorldHair — TODO

Source: cahier des charges (App mobile iOS & Android — mise en relation particuliers / coiffeurs pros).

## Backend

### Auth & comptes
- [x] Inscription particulier (email + mdp — mobile now calls Supabase Auth directly, see mobile/src/services/auth.ts; social login stays mocked, no OAuth app registered yet)
- [x] Vérification email (real 6-digit OTP via supabase.auth.verifyOtp)
- [x] Inscription coiffeur (infos perso, salon, adresse)
- [x] Upload pièce d'identité + diplôme (stockage sécurisé)
- [x] Upload KBIS ou extrait d'immatriculation RNE, obligatoire (issue #6 — preuve d'activité déclarée)
- [x] Choix zone de pratique coiffeur: salon (adresse exacte + facture société prouvant le local) ou domicile (rayon de déplacement en km) (issue #6)
- [x] Statut compte coiffeur: en attente / validé / rejeté
- [x] Flag "profil boutique incomplet" après validation admin, tant que les infos boutique (horaires, photos...) ne sont pas remplies (issue #7)
- [x] Rôles & permissions: particulier / coiffeur / admin

### Profils
- [ ] CRUD profil particulier (prénom, nom, photo)
- [ ] CRUD profil coiffeur (photo, description salon, adresse, horaires)
- [ ] CRUD prestations coiffeur (nom, tarif, durée)

### Recherche & géolocalisation
- [ ] Endpoint recherche coiffeurs par géoloc (rayon, position)
- [ ] Recherche par localisation manuelle
- [ ] Filtres (type de prestation, localisation)

### Rendez-vous / Agenda
- [ ] Modèle agenda coiffeur (disponibilités, créneaux)
- [ ] Prise de RDV (sélection prestation + créneau)
- [ ] Modification / annulation RDV (particulier)
- [ ] Acceptation / refus / annulation RDV (coiffeur)
- [ ] Statistiques de réservations (coiffeur)

### Paiement prestation (particulier)
- [ ] Prélèvement du montant de la prestation avant l'envoi de la demande de réservation au coiffeur (issue #2 — pas au moment de l'acceptation)
- [ ] Choix provider paiement (voir "À définir")
- [ ] Remboursement si le coiffeur refuse la demande

### Avis
- [ ] Création avis + note après prestation
- [ ] Réponse coiffeur à un avis
- [ ] Signalement / modération avis (admin)

### Notifications
- [ ] Infra push (FCM/APNs) + email (transactionnel)
- [ ] Rappel RDV J-1 (désactivable)
- [ ] Rappel RDV H-1 (désactivable)
- [ ] Nouveau RDV → coiffeur (non désactivable)
- [ ] Annulation RDV → coiffeur (non désactivable)
- [ ] Confirmation RDV → particulier (non désactivable)
- [ ] Validation/refus compte coiffeur → coiffeur (non désactivable)

### Paiements / Abonnements (coiffeurs)
- [ ] Intégration Apple In-App Purchase
- [ ] Intégration Google Play Billing
- [ ] Gestion abonnement mensuel / annuel
- [ ] 1er mois gratuit (essai)
- [ ] Renouvellement automatique
- [ ] Restriction accès si abonnement inactif
- [ ] Notification/flag J-7 avant fin d'abonnement, pour déclencher le bandeau de rappel côté app (issue #8)

### Back-office admin
- [ ] Auth sécurisée back-office
- [ ] Liste + validation/rejet dossiers coiffeurs (pièce ID + diplôme) avec message
- [ ] Suspension / bannissement compte (particulier ou coiffeur)
- [ ] Messagerie interne admin ↔ coiffeur (litige avant bannissement)
- [ ] Gestion de contenu / pages
- [ ] Modération avis signalés
- [ ] CRUD zones publicitaires: image, lien, période d'activation, par emplacement (issue #5 — voir "## Admin" et propositions d'emplacements sous "Particulier")

### Divers / infra
- [ ] Choix stack backend + DB
- [ ] Stockage fichiers (pièce ID, diplômes, photos)
- [ ] RGPD / conformité données (France)

## Frontend (mobile — iOS & Android)

### Onboarding & auth
- [x] Écran d'accueil (carrousel 3 slides)
- [x] Inscription / connexion (email+mdp, social login — provider mocké)
- [x] Écran vérification email (code 6 chiffres)
- [x] Setup profil particulier (prénom, nom, photo optionnelle)
- [x] Inscription coiffeur (infos perso, salon, adresse)
- [x] Upload pièce d'identité + diplôme
- [x] Upload KBIS / extrait RNE, obligatoire (issue #6)
- [x] Choix zone de pratique: salon (+ adresse exacte + facture société) ou domicile (+ rayon de déplacement) (issue #6)
- [x] Écran "compte en attente de validation"
- [x] 4e slide onboarding "Des produits de qualité" — texte descriptif (IA) + image gérée côté admin (issue #5)

### Particulier
- [x] Écran accueil: carte/liste coiffeurs à proximité (carte plein écran + carrousel)
- [x] Activation géolocalisation (expo-location + repli « choisir une ville »)
- [x] Recherche + filtres (localisation, prestation, distance, tri)
- [x] Fiche coiffeur (présentation, avis étoilés, prestations, bouton réservation)
- [x] Flow prise de RDV (prestation → créneau → confirmation)
- [x] Étape paiement de la prestation avant envoi de la demande au coiffeur (issue #2)
- [x] Gestion RDV (modifier / annuler)
- [x] Écran laisser avis + note après prestation
- [x] Emplacements publicitaires — propositions à valider avec le client (issue #5):
      1. Bandeau sur l'écran d'accueil (au-dessus/en dessous de la carte des coiffeurs à proximité)
      2. Bannière insérée dans les résultats de recherche (tous les N résultats) ou en bas de la fiche coiffeur
      3. Pop-up à l'ouverture de l'app (fréquence limitée) ou sur l'écran de confirmation de réservation


### Coiffeur
- [x] Config page présentation (photo, description, adresse, horaires)
- [x] Gestion prestations (liste, tarifs, durées)
- [x] Agenda: disponibilités + créneaux
- [x] Gestion RDV entrants (accepter/refuser/annuler)
- [x] Écran statistiques réservations
- [x] Gestion avis (consulter + répondre)
- [x] Écran abonnement (choix mensuel/annuel, statut essai gratuit)
- [x] Écran obligatoire de complétion profil boutique (horaires, photos...) à la 1ère connexion post-validation admin (issue #7)
- [x] Bandeau rouge J-7 avant fin d'abonnement: "Il vous reste x jours..." + CTA renouvellement (issue #8)
- [x] Écran flouté + message centré "abonnement terminé" + CTA "se réabonner" une fois l'abonnement expiré (issue #8)



### Notifications (in-app)
- [x] Réglages notifications (désactiver rappels J-1 / H-1) — switches dans
      l'onglet Profil, préférences stockées en local (pas encore d'infra push)
- [ ] Réception push (RDV, annulation, validation compte)

### Design system
- [ ] Intégration logo client
- [ ] Palette couleurs (#0c2340 bleu profond, #38b6ff bleu lumineux, #F5F8FB fond, #FFFFFF surface) + tons chauds accent
- [ ] Composants UI style Doctolib (clarté, agenda lisible)
- [ ] Carte interactive géoloc
- [ ] Composant carte coiffeur (photo, avis, prestations, CTA réserva­tion)

## Landing (dans web/ — issue #4)

Emplacement décidé: dossier `web/` du monorepo, partagé avec le futur admin
(groupe de routes `(marketing)` / `(admin)`). Spec: docs/superpowers/specs/
2026-08-27-landing-design.md

- [ ] Rebranding de `web/` (palette WorldHair, Playfair + Roboto, lang="fr")
- [ ] Pages: accueil, /particuliers, /coiffeurs
- [ ] Badges App Store / Play Store (inertes — "Bientôt disponible")
- [ ] Mentions légales / politique de confidentialité / CGU (structure)
- [ ] SEO de base (metadata par page, sitemap, robots)
- [ ] Fournir les informations légales manquantes: dénomination, forme
      juridique, capital, siège social, SIRET/RCS, TVA, responsable de
      publication, contact, hébergeur, sous-traitants, durées de conservation,
      juridiction compétente (marqueurs `[À COMPLÉTER]` dans les 3 pages)
- [ ] Remplacer les badges par les visuels officiels Apple / Google et les
      liens réels une fois les fiches store publiées
- [ ] Visuels de hero (récupérables depuis mobile/assets/images/OnBoarding/)

## Admin (dans web/ — issue #3)

Emplacement décidé: même appli Next.js que la landing (`web/`), dans un groupe
de routes `(admin)` séparé — il n'héritera donc pas du header/footer marketing.
À démarrer quand le backend sera prêt.

- [ ] Créer le groupe de routes `(admin)` avec son propre layout (sidebar)
- [ ] Auth admin sécurisée
- [ ] Liste + validation/rejet dossiers coiffeurs (pièce ID, diplôme, KBIS/RNE) avec message de refus
- [ ] Suspension / bannissement compte (particulier ou coiffeur)
- [ ] Messagerie interne admin ↔ coiffeur
- [ ] Modération avis signalés
- [ ] Gestion des zones publicitaires: upload image, lien, activation par emplacement, popups (issue #5)
- [ ] Gestion de contenu / pages (dont contenu de la 4e slide onboarding, issue #5)
- [ ] Vue abonnements coiffeurs (statut, échéance)

## À définir (bloquant pour specs finales)
- [ ] Prix abonnements mensuel / annuel
- [ ] Politique d'annulation RDV
- [ ] Politique de modération des avis
- [ ] Provider de paiement pour le prélèvement prestation (issue #2) — même provider que les abonnements coiffeurs (Apple IAP / Google Play Billing) ou un provider carte bancaire classique (Stripe...) puisque c'est le particulier qui paie ?
- [ ] Emplacements publicitaires retenus parmi les 3 propositions (issue #5, voir "Particulier" ci-dessus) — à valider avec le client
