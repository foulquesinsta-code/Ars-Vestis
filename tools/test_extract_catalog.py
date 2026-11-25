import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from extract_catalog import extract_product, run, valid_gtin


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.product = {
            'code': '7613361635625',
            'product_name_fr': ' Veste &amp; manteau ',
            'product_name': 'Jacket',
            'brands': ' Odlo ',
            'categories': 'Veste',
            'categories_tags': ['fr:veste'],
        }

    def test_real_gtin_and_control_digit(self):
        self.assertTrue(valid_gtin('7613361635625'))
        self.assertTrue(valid_gtin('05870134'))
        for bad in ('7613361635624', '', '01234', 'abcdefgh', 7613361635625):
            self.assertFalse(valid_gtin(bad))

    def test_no_fabricated_fields_and_source(self):
        result = extract_product(self.product)
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], 'Veste & manteau')
        self.assertEqual(result['brand'], 'Odlo')
        self.assertEqual(result['category_text'], 'Veste')
        self.assertEqual(result['category_tags'], ['fr:veste'])
        self.assertEqual(result['source_url'], 'https://world.openproductsfacts.org/product/7613361635625')
        self.assertEqual(set(result), {'code', 'name', 'brand', 'category_text', 'category_tags', 'source_url'})
        self.assertEqual(extract_product({**self.product, 'brands': None})['brand'], '')

    def test_exclusions_win_over_clothing_tag(self):
        for tag in ('en:infant-diapers', 'en:nappies', 'fr:couches', 'en:diapering', 'en:shoe-care-kits', 'en:laundry-supplies'):
            self.assertIsNone(extract_product({**self.product, 'categories_tags': ['en:clothing', tag]}), tag)
        self.assertIsNone(extract_product({**self.product, 'categories': 'Vêtements, Couches'}))
        self.assertIsNone(extract_product({**self.product, 'product_name_fr': 'Couches bébé'}))
        self.assertIsNone(extract_product({**self.product, 'categories_tags': ['en:textiles']}))

    def test_no_empty_placeholder_or_price_name(self):
        self.assertIsNone(extract_product({**self.product, 'product_name_fr': ' ', 'product_name': ''}))
        self.assertIsNone(extract_product({**self.product, 'product_name_fr': 'Chargement…'}))
        self.assertIsNone(extract_product({**self.product, 'product_name_fr': 'Nike 30€'}))
        self.assertEqual(extract_product({**self.product, 'product_name_fr': '', 'product_name': 'Jacket'})['name'], 'Jacket')

    def test_pinned_deterministic_extract_and_hash_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            dump = root / 'input.gz'
            # mtime=0 makes the test fixture itself deterministic.
            with dump.open('wb') as out, gzip.GzipFile(fileobj=out, mode='wb', mtime=0) as zipped:
                for product in [self.product, self.product, {**self.product, 'code': '05870134', 'product_name_fr': 'A'}]:
                    zipped.write((json.dumps(product) + '\n').encode())
            checksum = hashlib.sha256(dump.read_bytes()).hexdigest()
            first, second = root / 'one.json', root / 'two.json'
            self.assertEqual(run(dump, first, '2026-11-24', checksum), 2)
            self.assertEqual(run(dump, second, '2026-11-24', checksum), 2)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual([p['name'] for p in json.loads(first.read_text())['products']], ['A', 'Veste & manteau'])
            no_output = root / 'never.json'
            with self.assertRaises(ValueError):
                run(dump, no_output, '2026-11-24', '0' * 64)
            self.assertFalse(no_output.exists())


if __name__ == '__main__':
    unittest.main()
