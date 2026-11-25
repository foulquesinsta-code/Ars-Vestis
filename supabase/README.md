# Compte cloud Supabase

L’application utilise le projet Supabase gratuit `ars-vestis` (région `eu-west-3`). La migration `migrations/202611250001_app.sql` a été appliquée à ce projet : elle crée une ligne de données par compte avec des politiques RLS limitées au propriétaire. La vérification anonyme de lecture a renvoyé une erreur d’accès, mais les parcours d’inscription et de synchronisation n’ont pas encore été validés de bout en bout entre deux comptes.

## Configuration et ouverture des inscriptions

Le client utilise l’URL du projet et une **clé publiable**, non une clé privilégiée. Des valeurs `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` peuvent les remplacer au moment de la compilation. Ces variables sont visibles dans le navigateur : ne jamais y mettre de clé `service_role`, `sb_secret_`, de mot de passe de base ou tout autre secret. La protection des données dépend de la RLS.

Le service d’envoi d’e-mails par défaut de Supabase ne livre les messages d’authentification qu’aux adresses autorisées de l’équipe et présente des limites de débit. Pour ouvrir les inscriptions au public, configurer un SMTP adapté, vérifier ses tarifs et quotas, définir l’URL du site et les URL de retour autorisées, puis tester la confirmation et la connexion réelles. Documentation : [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp) et [URL de redirection](https://supabase.com/docs/guides/auth/redirect-urls). Aucune validation de compte ni test public n’est simulé.

## Synchronisation et limites

`CloudSync` prend les `SharedProps` et utilise l’état `AppData` partagé par l’application. Les changements sont enregistrés localement ; l’envoi et la récupération du compte restent des actions manuelles. La récupération valide les données et demande une confirmation distincte avant de remplacer la copie locale, sans fusion.

Les photos sont incluses en data URL dans le JSON : elles augmentent la taille des requêtes et de la base. Un avertissement apparaît avant un envoi dépassant 5 Mo, mais les requêtes plus petites peuvent aussi échouer. Pour un volume important, prévoir une migration vers un stockage d’images privé dédié et des règles d’accès adaptées. L’utilisateur peut exporter une sauvegarde locale.

La RLS isole les lignes pour les clients ordinaires ; elle ne fournit pas de chiffrement de bout en bout et ne protège pas un appareil compromis ou une clé privilégiée divulguée. Avant lancement public, tester création et confirmation de compte, connexion, transferts, erreurs réseau, limites de taille et séparation d’accès entre deux comptes.
