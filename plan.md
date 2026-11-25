# ARS VESTIS — architecture de l’application

ARS VESTIS est une application de dressing et de stylisme utilisable sur téléphone, tablette et ordinateur. La priorité est un produit fluide et fonctionnel plutôt qu’un site vitrine ou une maquette. Aucun paiement ou abonnement ne doit être déclenché, et une capacité indisponible ne doit pas être présentée comme fonctionnelle.

## Direction produit et design

Le style associe un **atelier éditorial** de maison de mode à une interface applicative contemporaine en **liquid glass** : surfaces translucides sur fond chaud, bordures lumineuses, contrastes lisibles, profondeur délicate et navigation compacte, avec un dégradé discret. La palette conserve noir encre, ivoire chaud, blanc cassé et bronze. Une typographie serif expressive met en valeur les titres ; une sans-serif lisible sert aux données et commandes. L’identité combine un monogramme AV distinctif et un wordmark espacé. La voix est précise, calme et personnelle : « Votre style, à votre façon » ; « Redécouvrez ce que vous possédez déjà ». L’atelier de tenues est la destination principale ; le dressing devient un inventaire rapide et le mobile conserve cinq destinations essentielles. Animations rapides et sobres, réduites pour les utilisateurs qui le demandent ; cibles tactiles confortables et bons contrastes.

## Fonctionnement et dépendances

Le dressing, les préférences, les tenues et le calendrier reposent sur des données réellement enregistrées. Quand Supabase n’est pas connecté, les données sont explicitement conservées uniquement sur l’appareil, sans simuler de compte ou de synchronisation. Les photos peuvent être fournies par l’utilisateur ; aucun produit inventé n’est présenté comme réel.

Les compositions locales sont fondées sur les pièces effectivement enregistrées et clairement décrites comme une aide basée sur des règles, non comme un modèle IA. Elles affichent maintenant un aperçu visuel à partir des photos disponibles, des occasions rapides, des actions de remplacement et un partage natif vers les applications du téléphone ou de l’ordinateur. Les services d’IA, d’essayage, de catalogue marchand et de communauté exigent des fournisseurs, ressources ou connexions fonctionnelles ; leur absence est expliquée et ne doit pas produire de résultats fictifs. Les options examinées — fournisseurs Hugging Face, allocation Workers AI et OOTDiffusion — demandent respectivement token/proxy, compte serveur ou GPU ; aucune n’est intégrée côté navigateur comme une fausse fonction gratuite. Des modèles d’accès FREE/PREMIUM/ULTRA devront être préparés sans paiement avec des droits sécurisés côté serveur ; ils ne sont pas encore implémentés et aucun quota non appliqué ne doit être affiché comme réel.

Le compte Webflow actuel ne contient aucun site accessible et la connexion au tableau de bord est nécessaire. Webflow pourra accueillir une vitrine ou une couche éditoriale lorsqu’un site sera disponible ; l’interface applicative s’exécute dans le projet actuel. Le projet Supabase gratuit choisi par l’utilisateur est créé, avec une table privée et des politiques RLS. Les inscriptions publiques nécessitent un SMTP et des URL de retour configurées ; les transferts manuels n’ont pas encore été testés de bout en bout. Mobbin exige un abonnement et n’est pas utilisé. Le catalogue intégré est un référentiel documentaire local de 214 fiches dérivées d’Open Products Facts, avec attribution, recherche et ajout privé au dressing ; il ne constitue pas une place de marché et ne fournit ni prix, stock, disponibilité, photographie ni vérification commerciale.

## Structure

- `src/App.tsx` : shell applicatif, navigation responsive, tableau de bord et état partagé.
- `src/types.ts` : structures communes des articles, tenues, calendrier et préférences.
- `src/storage.ts` : persistance locale, migrations et export/import.
- `src/Wardrobe.tsx` et sa feuille de style : gestion du dressing et import photo.
- `src/Looks.tsx` et sa feuille de style : composition, tenues enregistrées et calendrier.
- `src/Catalog.tsx` et `src/catalog.css` : référentiel documentaire local, recherche, pagination et ajout contrôlé d’une fiche au dressing.
- `src/Settings.tsx` et `src/CloudSync.tsx` : préférences, export/import et transfert manuel vers le compte.
- `src/styles.css` : identité visuelle, shell et composants partagés.
- `public/` : icônes, manifeste et service worker pour une expérience installable lorsque compatible.
- `supabase/` : migration de la table privée et documentation des limites de l’intégration.
- `server/health.cjs` et `Dockerfile` : point de santé minimal pour le déploiement, sans données métier ni stockage local du serveur.

## Livraison

La version est vérifiée par compilation et contrôles des parcours réellement implémentés, puis sauvegardée comme checkpoint. La publication reste distincte de l’aperçu. Les limites externes restantes sont indiquées précisément à l’utilisateur plutôt que dissimulées.
