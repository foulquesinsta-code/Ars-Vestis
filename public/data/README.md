# Notice du jeu dérivé Open Products Facts

Le fichier [open-products-fashion.json](./open-products-fashion.json) contient **214 fiches** de vêtements ou de chaussures sélectionnées depuis le dump officiel d’[Open Products Facts](https://world.openproductsfacts.org/). Le référentiel est collaboratif et **non vérifié** : noms, marques et catégories peuvent être inexacts, incomplets ou obsolètes. Le catalogue ne comporte **ni prix, ni stock, ni disponibilité, ni photo**. Il ne couvre qu’une partie de la base ; l’absence d’un produit ne signifie rien sur son existence ou sa disponibilité.

## Provenance et licences

- Source : [conditions officielles et exports Open Products Facts](https://world.openproductsfacts.org/data).
- Export d’origine : [openproductsfacts-products.jsonl.gz](https://static.openproductsfacts.org/data/openproductsfacts-products.jsonl.gz), fichier JSONL gzip officiel, téléchargé le **24 novembre 2026 en UTC**. L’en-tête `Last-Modified` indique **24 novembre 2026 à 04:02:27 UTC** ; c’est la date du snapshot, et non une garantie de fraîcheur des fiches.
- SHA-256 de l’export compressé : `5509ab8d43c3a8bf5978e94e7b78b986154aba627dbe3d03c1a5234cddc5659b`.
- **Attribution :** « Contient des données d’Open Products Facts, disponibles sous licence Open Database License (ODbL). » Les contributeurs d’Open Products Facts sont à l’origine des données.
- Base et base dérivée : [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). La base dérivée est ici distribuée sous ODbL 1.0, sans restriction technique. Conserver l’attribution, les notices et les conditions de partage à l’identique lors de sa réutilisation.
- Contenu individuel : [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/), sous réserve du respect de l’ODbL. L’usage commercial est autorisé sous réserve de respecter ces licences.
- Les photos ne sont pas extraites ni distribuées. Les droits sur les images peuvent être distincts et ne sont pas validés ici. Le pictogramme affiché est neutre.

Le JSON embarque les notices, les liens de licence, la date et le SHA-256 du dump, ainsi que le lien de chaque fiche source. Les ajouts d’un utilisateur ne modifient pas Open Products Facts : ils créent uniquement des pièces dans son dressing personnel, via le stockage de l’application.

## Modifications et critères

L’extracteur conserve les fiches dont `categories_tags` comprend au moins une catégorie explicite de vêtement, de chaussure ou de couvre-chef ; il n’utilise pas les catégories génériques de textile, maison ou entretien. Il exclut toute fiche portant une catégorie évoquant notamment les couches, nappies, articles d’hygiène absorbante, l’entretien, le ménage, la lessive ou les animaux, même si elle possède aussi une catégorie de vêtement. Il écarte aussi quelques mots de produit manifestement incompatibles, comme couches, chausse-pieds, semelles et cirage. Ces exclusions sont prudentes mais ne peuvent pas supprimer toutes les erreurs contributives.

Seules les fiches avec un nom source non vide (`product_name_fr` puis `product_name`), et un code GTIN de 8, 12, 13 ou 14 chiffres avec clé de contrôle valide, sont retenues. Les noms explicitement temporaires ou manifestement non descriptifs et ceux comportant un prix monétaire sont écartés. Les entités HTML des libellés sont décodées et les espaces périphériques retirés ; les valeurs trop longues ou contenant des caractères de contrôle sont rejetées. Les marques manquantes restent vides. Le texte et les étiquettes de catégories viennent de la source ; aucun type local n’est déduit automatiquement. Les doublons sont supprimés par code, puis les produits sont triés par nom normalisé et par code avant une limite de 1 000 fiches. Le snapshot présent comprend 214 fiches avant et après limitation.

Seuls le code, le nom, la marque, le texte et les étiquettes de catégories et l’URL de la fiche source sont conservés. Ni appel à l’API en direct, ni scraping, ni extraction de photos ou de prix n’est effectué. Le composant charge un petit fichier statique et affiche au maximum 12 fiches par page. La catégorie du dressing est choisie explicitement par l’utilisateur ; les autres détails restent vides.

## Reproduire localement

Depuis la racine du projet, avec Python 3 et le dump compressé d’origine en cache :

```sh
python3 tools/extract_catalog.py
python3 -m unittest discover -s tools -p 'test_*.py'
```

Le chemin par défaut est `tools/.cache/openproductsfacts-products.jsonl.gz`. S’il n’y est pas, `python3 tools/extract_catalog.py --download` télécharge uniquement l’export officiel. Le dump étant renouvelé, un téléchargement ultérieur peut ne plus avoir le même SHA-256 : l’extraction s’arrête alors sans écrire de JSON. Pour créer un nouveau snapshot, relevez et vérifiez l’en-tête HTTP `Last-Modified` et le SHA-256 du fichier téléchargé, puis lancez `python3 tools/extract_catalog.py --snapshot AAAA-MM-JJ --sha256 SHA256` et mettez à jour cette notice et le nombre de fiches. Un autre chemin de cache peut être indiqué avec `--dump`, et le fichier de sortie avec `--output`. À octets et paramètres identiques, le résultat est déterministe. Le cache n’est pas servi publiquement.
