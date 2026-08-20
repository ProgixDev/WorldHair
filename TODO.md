# WorldHair — TODO

Source: cahier des charges (App mobile iOS & Android — mise en relation particuliers / coiffeurs pros).

## Backend

### Auth & comptes
- [ ] Inscription particulier (email + mdp, ou social login)
- [ ] Vérification email
- [ ] Inscription coiffeur (infos perso, salon, adresse)
- [ ] Upload pièce d'identité + diplôme (stockage sécurisé)
- [ ] Statut compte coiffeur: en attente / validé / rejeté
- [ ] Rôles & permissions: particulier / coiffeur / admin

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

### Back-office admin
- [ ] Auth sécurisée back-office
- [ ] Liste + validation/rejet dossiers coiffeurs (pièce ID + diplôme) avec message
- [ ] Suspension / bannissement compte (particulier ou coiffeur)
- [ ] Messagerie interne admin ↔ coiffeur (litige avant bannissement)
- [ ] Gestion de contenu / pages
- [ ] Modération avis signalés

### Divers / infra
- [ ] Choix stack backend + DB
- [ ] Stockage fichiers (pièce ID, diplômes, photos)
- [ ] RGPD / conformité données (France)

## Frontend (mobile — iOS & Android)

### Onboarding & auth
- [ ] Écran d'accueil
- [ ] Inscription / connexion (email+mdp, social login)
- [ ] Écran vérification email
- [ ] Setup profil particulier (prénom, nom, photo optionnelle)
- [ ] Inscription coiffeur (infos perso, salon, adresse)
- [ ] Upload pièce d'identité + diplôme
- [ ] Écran "compte en attente de validation"

### Particulier
- [ ] Écran accueil: carte/liste coiffeurs à proximité
- [ ] Activation géolocalisation
- [ ] Recherche + filtres (localisation, prestation)
- [ ] Fiche coiffeur (présentation, avis étoiapprolés, prestations, bouton réservation)
- [ ] Flow prise de RDV (prestation → créneau → confirmation)
- [ ] Gestion RDV (modifier / annuler)
- [ ] Écran laisser avis + note après prestation

### Coiffeur
- [ ] Config page présentation (photo, description, adresse, horaires)
- [ ] Gestion prestations (liste, tarifs, durées)
- [ ] Agenda: disponibilités + créneaux
- [ ] Gestion RDV entrants (accepter/refuser/annuler)
- [ ] Écran statistiques réservations
- [ ] Gestion avis (consulter + répondre)
- [ ] Écran abonnement (choix mensuel/annuel, statut essai gratuit)

### Notifications (in-app)
- [ ] Réglages notifications (désactiver rappels J-1 / H-1)
- [ ] Réception push (RDV, annulation, validation compte)

### Design system
- [ ] Intégration logo client
- [ ] Palette couleurs (#0c2340 bleu profond, #38b6ff bleu lumineux, #F5F8FB fond, #FFFFFF surface) + tons chauds accent
- [ ] Composants UI style Doctolib (clarté, agenda lisible)
- [ ] Carte interactive géoloc
- [ ] Composant carte coiffeur (photo, avis, prestations, CTA réserva­tion)

## À définir (bloquant pour specs finales)
- [ ] Prix abonnements mensuel / annuel
- [ ] Politique d'annulation RDV
- [ ] Politique de modération des avis
