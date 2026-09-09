-- BDOS · 010 seed
-- Platform chart of accounts, categories, couriers, gift catalogue.

INSERT INTO ledger.account (kind, owner_kind) VALUES
  ('cash_mfs','platform'), ('cod_receivable','platform'), ('escrow','platform'),
  ('commission_held','platform'), ('gift_liability','platform'),
  ('coin_liability','platform'), ('tax_withheld','platform'),
  ('platform_revenue','platform'), ('refund_expense','platform'),
  ('rto_expense','platform');

-- Commission in basis points. Beauty high, electronics low (docs/06 §3).
INSERT INTO commerce.category (id, slug, name_en, name_bn, commission_bp) VALUES
  (1,'beauty',      'Beauty & Personal Care', 'বিউটি ও পার্সোনাল কেয়ার', 900),
  (2,'fashion-women','Women''s Fashion',      'মেয়েদের ফ্যাশন',          700),
  (3,'fashion-men',  'Men''s Fashion',         'ছেলেদের ফ্যাশন',           650),
  (4,'electronics',  'Electronics',            'ইলেকট্রনিকস',              300),
  (5,'mobile',       'Mobile & Accessories',   'মোবাইল ও এক্সেসরিজ',      250),
  (6,'home',         'Home & Living',          'হোম ও লিভিং',              600),
  (7,'grocery',      'Grocery',                'গ্রোসারি',                  400),
  (8,'baby',         'Baby & Kids',            'বেবি ও কিডস',              700),
  (9,'books',        'Books & Stationery',     'বই ও স্টেশনারি',           500),
  (10,'handicraft',  'Handicraft & Jamdani',   'হস্তশিল্প ও জামদানি',      800);

INSERT INTO commerce.courier (id, slug, name) VALUES
  (1,'pathao',    'Pathao Courier'),
  (2,'steadfast', 'Steadfast Courier'),
  (3,'redx',      'RedX'),
  (4,'paperfly',  'Paperfly'),
  (5,'ecourier',  'eCourier'),
  (6,'sundarban', 'Sundarban Courier');

-- Prices in paisa. Creator keeps 60%, published on the gift sheet.
INSERT INTO live.gift_catalog (id, slug, name_en, name_bn, price_paisa) VALUES
  (1,'shapla',      'Shapla',       'শাপলা',           1000),
  (2,'rickshaw',    'Rickshaw',     'রিকশা',           5000),
  (3,'nauka',       'Nauka',        'নৌকা',           10000),
  (4,'ilish',       'Ilish',        'ইলিশ',           50000),
  (5,'kacchi',      'Kacchi',       'কাচ্চি',        100000),
  (6,'royal-bengal','Royal Bengal', 'রয়েল বেঙ্গল',   500000),
  (7,'padma-setu',  'Padma Setu',   'পদ্মা সেতু',   2000000);
