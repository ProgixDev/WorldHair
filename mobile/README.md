# Expo App Template

This repository is an Expo app template that provides a starting point for building React Native applications with Expo, including setup scripts for NativeWind, Git hooks, and project management.

## Scripts

- **clean-keep.ts**: Removes all .keep placeholder files from the project directories (self-deleting script).
- **generate-adaptive-icon.ts**: Generates `assets/images/adaptive-icon.png` from `Logo.png` by centering the logo on a 1024×1024 transparent canvas. Android adaptive icons require the logo to stay within the inner 66% "safe zone" to avoid clipping.
- **rename-project.ts**: Updates package.json, app.json, and other files to use the current folder name as the project name.
- **reset-git.ts**: Resets the Git repository by removing .git, reinitializing, and creating a fresh initial commit (self-deleting script).
- **setup-git-hooks.ts**: Sets up Husky for pre-commit linting and Commitlint for commit message validation.
- **setup-nativewind.ts**: Automates the setup of NativeWind, a utility-first CSS library for React Native, by installing dependencies and configuring the project.
- **update-dependencies.ts**: Updates all project dependencies and ensures Expo package compatibility.

## Carte

Trois moteurs coexistent, choisis au runtime par `src/features/salons/mapProvider.ts` :

| Moteur | Quand | Jeton |
|---|---|---|
| **Mapbox** (`@rnmapbox/maps`) | `EXPO_PUBLIC_MAPBOX_PK` défini **et** build natif | `pk.*` runtime + `sk.*` au build |
| **Google Maps / Apple Plans** (`react-native-maps`) | par défaut | clé Google sur Android uniquement |
| **OpenStreetMap** (tuiles brutes) | build Android sans clé Google | aucun |

L'onglet Profil affiche le moteur actif (ligne « Moteur de carte »).

### Mapbox

`.env` (déjà ignoré par git) :

```
EXPO_PUBLIC_MAPBOX_PK=pk.xxxxx
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=sk.xxxxx
```

Les deux jetons viennent de https://account.mapbox.com/access-tokens ; le
`sk.*` doit porter le scope `DOWNLOADS:READ`. Le plugin `@rnmapbox/maps` lit
lui-même `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` dans l'environnement — ne pas repasser
l'ancienne option `RNMapboxMapsDownloadToken`, dépréciée.

Puis regénérer le natif :

```
bunx expo prebuild --clean
bun expo run:android   # ou run:ios
```

Sur EAS, déclarer les deux variables au niveau du projet (le `.env` local n'y
est pas lu). Mapbox ne fonctionne pas dans Expo Go : l'app y bascule
automatiquement sur `react-native-maps`.

### Google Maps (optionnel, Android)

`GOOGLE_MAPS_API_KEY=...` dans `.env`, puis `prebuild` + rebuild. Sans clé,
l'app dessine des tuiles OpenStreetMap au lieu d'une carte grise.
