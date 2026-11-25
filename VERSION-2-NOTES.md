# ARS VESTIS — version 0.2.0

## Nouveautés
- Installation PWA depuis Paramètres, avec bouton d’installation natif lorsqu’il est proposé par le navigateur et instructions Android en solution de secours.
- Préférences d’apparence : thème clair, sombre ou automatique ; styles Éditorial, Liquid Glass et Minimal.
- Ajout d’une seconde photo facultative par vêtement (dos ou détail), avec sélection depuis la galerie ou capture caméra.
- Nouveau Studio d’essayage : assemblage des pièces du dressing par catégories et aperçu visuel sur une silhouette de mannequin avec trois styles d’affichage.
- Conservation des données existantes : les nouveaux champs sont facultatifs et les préférences manquantes des anciennes sauvegardes reprennent les valeurs par défaut.

## Limite importante sur l’IA et la gratuité
Le Studio actuel est un compositeur visuel local : il superpose les photos de vêtements sur une silhouette. Il ne réalise pas encore de détourage automatique, de reconstruction 3D du vêtement, ni d’essayage photoréaliste piloté par IA. Ces fonctions nécessitent un modèle de vision/essayage spécialisé et des ressources de calcul. Il n’existe pas de garantie réaliste d’un service IA de qualité, illimité et gratuit. Cette version n’envoie donc pas les photos vers un service tiers et ne crée aucun coût d’API.

## Installation / lancement
Conserver la procédure habituelle du projet : `pnpm install`, puis `pnpm dev` pour le développement ou `pnpm build` pour la production. Le PWA doit être servi en HTTPS (ou localhost en développement) pour l’installation et le fonctionnement du service worker.
