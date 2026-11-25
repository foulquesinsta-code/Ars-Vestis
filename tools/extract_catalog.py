#!/usr/bin/env python3
"""Extract a small, attributable clothing subset from the official OPF JSONL dump.

No live API or scraping: read one local gzip file, optionally downloading the
single official bulk export when explicitly requested. See public/data/README.md.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DUMP_URL = 'https://static.openproductsfacts.org/data/openproductsfacts-products.jsonl.gz'
SOURCE_PAGE = 'https://world.openproductsfacts.org/data'
DEFAULT_DUMP = ROOT / 'tools/.cache/openproductsfacts-products.jsonl.gz'
DEFAULT_OUTPUT = ROOT / 'public/data/open-products-fashion.json'
# Last-Modified of the downloaded dump, UTC; pinned to the exact compressed bytes.
DEFAULT_SNAPSHOT = '2026-11-24'
DEFAULT_SHA256 = '5509ab8d43c3a8bf5978e94e7b78b986154aba627dbe3d03c1a5234cddc5659b'
MAX_PRODUCTS = 1000

# Exact tags from categories_tags only. Broad clothing, footwear and headwear
# are allowed; unrelated broader taxonomy parents (e.g. textiles) are not.
INCLUDED_TAGS = frozenset({
    'en:clothing', 'en:shoes', 'en:t-shirts', 'en:pants', 'en:underwear',
    'en:underwear-socks', 'en:socks', 'en:dresses', 'en:shorts',
    'en:shirts-tops', 'en:vests', 'en:coats-and-jackets', 'en:coats-jackets',
    'en:polo-shirt', 'en:pull-over', 'en:hats', 'en:apparel', 'en:active wear',
    'fr:veste', 'fr:chaussettes-de-compression', 'en:long sleeve t-shirts',
    'en:active pants', 'en:running shoes',
})
# If any category signals an unrelated or ambiguous subject, it wins over an
# allowed tag. Match components anywhere so en:infant-diapers is also blocked.
BLOCKED_CATEGORY_PARTS = (
    'diaper', 'napp', 'couche', 'panal', 'pana', 'luiers', 'windel',
    'absorbent-hygiene', 'diapering', 'shoe-care', 'shoe-clean',
    'shoelace', 'shoe-polish', 'pet-suppl', 'cat-apparel', 'dog-apparel',
    'laundry', 'cleaning', 'household', 'stain-remov', 'sewing-machine',
)
# Obvious non-clothes or disposable hygiene products occasionally receive
# clothing tags upstream. This is a defensive filter, not verification.
BLOCKED_NAME = re.compile(
    r'\b(?:diapers?|napp(?:y|ies)|couches?|pañales?|panales?|windeln?|'
    r'zwemluiers?|luiers?|shoe\s*horns?|schuhanzieher|'
    r'insoles?|einlegesohlen?|gelsohle|semelles?|'
    r'shoe\s*(?:care|cream|polish)|cirage|d[ée]tergent)\b', re.I
)
PLACEHOLDER_NAMES = frozenset({'loading', 'loading...', 'chargement', 'chargement...', 'chargement…', 'boîte', 'boite', 'box', 'n/a', 'null', 'unknown'})


def clean_text(value: object, maximum: int) -> str:
    """Return a readable source string, or nothing when malformed/too long."""
    if not isinstance(value, str):
        return ''
    text = html.unescape(value).strip()
    if len(text) > maximum or any(unicodedata.category(ch).startswith('C') for ch in text):
        return ''
    return text


def valid_gtin(code: object) -> bool:
    if not isinstance(code, str) or len(code) not in (8, 12, 13, 14) or not re.fullmatch(r'[0-9]+', code):
        return False
    digits = [int(c) for c in code]
    weighted = sum(number * (3 if position % 2 == 0 else 1)
                   for position, number in enumerate(reversed(digits[:-1])))
    return (10 - weighted % 10) % 10 == digits[-1]


def extract_product(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    code = raw.get('code')
    if not valid_gtin(code):
        return None
    tags = raw.get('categories_tags')
    if not isinstance(tags, list) or not tags or len(tags) > 100:
        return None
    # Do not invent or infer categories; retain the valid exact source tags.
    cleaned_tags = [clean_text(tag, 120) for tag in tags]
    if any(not tag for tag in cleaned_tags):
        return None
    normalized = [tag.casefold() for tag in cleaned_tags]
    if not INCLUDED_TAGS.intersection(normalized):
        return None
    if any(part in tag for part in BLOCKED_CATEGORY_PARTS for tag in normalized):
        return None
    raw_categories = clean_text(raw.get('categories'), 2000)
    lower_categories = unicodedata.normalize('NFKD', raw_categories.casefold())
    lower_categories = ''.join(c for c in lower_categories if not unicodedata.combining(c))
    if any(part in lower_categories for part in BLOCKED_CATEGORY_PARTS):
        return None
    name = clean_text(raw.get('product_name_fr'), 250) or clean_text(raw.get('product_name'), 250)
    if not name or name.casefold() in PLACEHOLDER_NAMES or BLOCKED_NAME.search(name):
        return None
    # Avoid displaying a stale price hidden inside a contributed product name.
    if re.search(r'(?:\d\s*€|€\s*\d|\d\s*\$|\$\s*\d)', name):
        return None
    brand = clean_text(raw.get('brands'), 250)
    return {
        'code': code,
        'name': name,
        'brand': brand,
        'category_text': raw_categories,
        'category_tags': cleaned_tags,
        'source_url': f'https://world.openproductsfacts.org/product/{code}',
    }


def sort_key(product: dict[str, object]) -> tuple[str, str]:
    text = unicodedata.normalize('NFKD', str(product['name']).casefold())
    return ''.join(c for c in text if not unicodedata.combining(c)), str(product['code'])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def run(dump: Path, output: Path, snapshot: str, expected_sha256: str) -> int:
    from datetime import date
    try:
        date.fromisoformat(snapshot)
    except ValueError as exc:
        raise ValueError('La date du snapshot doit être au format AAAA-MM-JJ.') from exc
    if not re.fullmatch(r'[0-9a-f]{64}', expected_sha256):
        raise ValueError('Le SHA-256 attendu doit contenir 64 caractères hexadécimaux minuscules.')
    actual_hash = sha256(dump)
    if actual_hash != expected_sha256:
        raise ValueError(f'SHA-256 inattendu : {actual_hash}. Aucun fichier produit. Vérifiez le snapshot avant de préciser --sha256 et --snapshot.')
    products = []
    seen = set()
    with gzip.open(dump, 'rt', encoding='utf-8', errors='strict') as source:
        for number, line in enumerate(source, 1):
            try:
                raw = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f'JSON invalide ligne {number}') from exc
            product = extract_product(raw)
            if product and product['code'] not in seen:
                products.append(product)
                seen.add(product['code'])
    products.sort(key=sort_key)
    total_matches = len(products)
    products = products[:MAX_PRODUCTS]
    result = {
        'metadata': {
            'title': 'Extrait de vêtements Open Products Facts',
            'source': SOURCE_PAGE,
            'source_dump': DUMP_URL,
            'source_snapshot_last_modified_utc': snapshot,
            'source_dump_sha256': actual_hash,
            'database_license': 'ODbL 1.0',
            'database_license_url': 'https://opendatacommons.org/licenses/odbl/1-0/',
            'contents_license': 'DbCL 1.0',
            'contents_license_url': 'https://opendatacommons.org/licenses/dbcl/1-0/',
            'attribution': 'Contient des données d’Open Products Facts, disponibles sous licence Open Database License (ODbL).',
            'changes': 'Extraction par catégories explicites de vêtements ; exclusion de catégories ambiguës et des fiches sans nom ou code GTIN valide ; sélection et tri déterministes ; seules certaines propriétés sont conservées ; aucune photo.',
            'candidate_count_before_limit': total_matches,
            'product_count': len(products),
            'limit': MAX_PRODUCTS,
        },
        'products': products,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(products)} fiches extraites ({total_matches} candidates avant limite) ; snapshot {snapshot} ; SHA-256 {actual_hash}')
    return len(products)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dump', type=Path, default=DEFAULT_DUMP, help='Chemin du dump officiel mis en cache local')
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--snapshot', default=DEFAULT_SNAPSHOT, help='Date UTC Last-Modified du dump')
    parser.add_argument('--sha256', default=DEFAULT_SHA256, help='SHA-256 du fichier compressé')
    parser.add_argument('--download', action='store_true', help='Télécharger le seul dump officiel si le cache est absent')
    args = parser.parse_args()
    try:
        if not args.dump.exists() and args.download:
            args.dump.parent.mkdir(parents=True, exist_ok=True)
            request = urllib.request.Request(DUMP_URL, headers={'User-Agent': 'ArsVestis-OpenProductsFacts-extract/1.0 (offline cache)'})
            with urllib.request.urlopen(request, timeout=120) as response, args.dump.open('wb') as target:
                print('Last-Modified du serveur :', response.headers.get('Last-Modified', 'inconnu'))
                while block := response.read(1024 * 1024):
                    target.write(block)
        run(args.dump, args.output, args.snapshot, args.sha256)
    except (OSError, ValueError) as exc:
        print(f'Extraction impossible : {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
