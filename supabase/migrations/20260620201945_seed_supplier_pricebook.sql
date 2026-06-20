
-- ============================================================
-- 1. Material categories (supplier price book)
-- ============================================================
INSERT INTO cost_categories (name)
SELECT v FROM (VALUES
  ('Lumber & Framing'),
  ('Doors, Windows & Hardware'),
  ('Exterior & Decking'),
  ('Demolition & Disposal')
) t(v)
WHERE NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = t.v);

-- ============================================================
-- 2. Suppliers
-- ============================================================
INSERT INTO suppliers (name, phone, email, address, website, is_preferred, is_active, notes)
SELECT * FROM (VALUES
  ('Muskoka Lumber',                               '(705) 645-2231', 'sales@muskokalumber.com', 'Bracebridge, ON', 'https://www.muskokalumber.com', true,  true, 'Primary material supplier. Full lumber yard, hardware, plumbing, electrical supplies. Contractor pricing available.'),
  ('Benjamin Moore Canada',                         null::text,       null::text,                null::text,        null::text,                      false, true, null::text),
  ('Canadian Tire',                                 null::text,       null::text,                null::text,        null::text,                      false, true, null::text),
  ('Chamberlain Timber Mart (Muskoka-Gravenhurst)', null::text,       null::text,                null::text,        null::text,                      false, true, null::text),
  ('Home Depot Canada',                             null::text,       null::text,                null::text,        null::text,                      false, true, null::text),
  ('RONA Canada',                                   null::text,       null::text,                null::text,        null::text,                      false, true, null::text)
) t(name, phone, email, address, website, is_preferred, is_active, notes)
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE suppliers.name = t.name);

-- ============================================================
-- 3. Price entries (all from Muskoka Lumber)
-- ============================================================
DO $$
DECLARE
  v_supplier_id  int;
  v_cat_lumber   int;
  v_cat_hardware int;
  v_cat_exterior int;
  v_cat_demo     int;
BEGIN
  SELECT id INTO v_supplier_id  FROM suppliers       WHERE name = 'Muskoka Lumber';
  SELECT id INTO v_cat_lumber   FROM cost_categories WHERE name = 'Lumber & Framing';
  SELECT id INTO v_cat_hardware FROM cost_categories WHERE name = 'Doors, Windows & Hardware';
  SELECT id INTO v_cat_exterior FROM cost_categories WHERE name = 'Exterior & Decking';
  SELECT id INTO v_cat_demo     FROM cost_categories WHERE name = 'Demolition & Disposal';

  INSERT INTO supplier_prices (supplier_id, product_name, product_code, category_id, unit_price, unit_type, last_updated, notes) VALUES
    -- Doors, Windows & Hardware
    (v_supplier_id, '10 X 4" BROWN DECK SCREW 150 JAR',                       '42901',         v_cat_hardware, '26.99',  'each',         '2026-05-03', 'Verified 2026-04-29. Source: Muskoka Lumber receipt 2026-04-29.'),
    (v_supplier_id, '1 1/2" STRUCTURAL SCREW (100PK)',                         'SD9112R100',    v_cat_hardware, '21.99',  'each',         '2026-05-03', 'Verified 2026-04-24. Source: Muskoka Lumber receipt 2026-04-24.'),
    (v_supplier_id, '12/14 X 5-5/8" R4 GRK FRAME SCREW BLACK 50PK',           '03173',         v_cat_hardware, '52.49',  'each',         '2026-05-03', 'Verified 2025-12-03. Source: Muskoka Lumber receipt 2025-12-03.'),
    (v_supplier_id, '2 X 8 LIGHT RAFTER HANGER',                               'LRU28Z',        v_cat_hardware, '9.99',   'each',         '2026-05-03', 'Verified 2026-04-22. Source: Muskoka Lumber receipt 2026-04-22.'),
    (v_supplier_id, '3/8 X 10" GRK RSS LTF FIR SCREW (10293)',                 '3810FS1',       v_cat_hardware, '5.85',   'each',         '2026-05-03', 'Verified 2026-04-29. Source: Muskoka Lumber receipt 2026-04-29.'),
    (v_supplier_id, '3/8 X 14-1/8" RSS TIMBER SCREW 50PK (12307)',             '3814FS',        v_cat_hardware, '460.99', 'each',         '2026-05-03', 'Verified 2025-12-03. Source: Muskoka Lumber receipt 2025-12-03. Confirmed across 2 invoices (2025-11-19 to 2025-12-03).'),
    (v_supplier_id, '3/8 X 5 1/8 RSS FIR SCREW 50PK (12278)',                  '38518FS',       v_cat_hardware, '113.79', 'each',         '2026-05-03', 'Verified 2025-11-19. Source: Muskoka Lumber receipt 2025-11-19.'),
    (v_supplier_id, '4" MICRO ROLLER, TRAY, FRAME SET',                        '4MP10SET',      v_cat_hardware, '6.29',   'each',         '2026-05-03', 'Verified 2026-03-09. Source: Muskoka Lumber receipt 2026-03-09.'),
    (v_supplier_id, '5/16" X 3 1/8" RSS BLACK SCREW 100PK (16221)',            '516318FSB',     v_cat_hardware, '93.79',  'each',         '2026-05-03', 'Verified 2026-04-21. Source: Muskoka Lumber receipt 2026-04-21.'),
    (v_supplier_id, 'ARDOX FINISHING GALV. 3"',                                '3ARDFG1',       v_cat_hardware, '3.38',   'per unit',     '2026-05-03', 'Verified 2026-03-03. Source: Muskoka Lumber receipt 2026-03-03.'),
    (v_supplier_id, 'DEWALT 12" BIT EXTENSION',                                'DW1589',        v_cat_hardware, '7.39',   'each',         '2026-05-03', 'Verified 2025-12-03. Source: Muskoka Lumber receipt 2025-12-03.'),
    (v_supplier_id, 'FLEXTORQ 2-1/4" BITS-T40 3PK',                            'DWAF2TX40IR3',  v_cat_hardware, '7.22',   'each',         '2026-05-03', 'Verified 2025-11-19. Source: Muskoka Lumber receipt 2025-11-19.'),
    (v_supplier_id, 'FREUD 12" THICK METAL 8/10T BLADE SAWZALL 5PK',           'DS1208BFD5C',   v_cat_hardware, '29.59',  'each',         '2026-05-03', 'Verified 2026-02-19. Source: Muskoka Lumber receipt 2026-02-19. Confirmed across 2 invoices (2025-11-13 to 2026-02-19).'),
    (v_supplier_id, 'FREUD 3/4" PRECISION FORSTNER BIT',                       'PB-005',        v_cat_hardware, '21.99',  'each',         '2026-05-03', 'Verified 2026-04-29. Source: Muskoka Lumber receipt 2026-04-29.'),
    (v_supplier_id, 'GRK Elite 10 x 3" Deck Screw Pail (1000)',                '20136',         v_cat_hardware, '193.09', 'each',         '2026-05-03', 'Verified 2026-04-15. Source: Muskoka Lumber receipt 2026-04-15. Confirmed across 2 invoices (2026-02-03 to 2026-04-15).'),
    (v_supplier_id, 'Milwaukee Sharpie Marker for wet surfaces',                '48-22-3100',    v_cat_hardware, '2.29',   'each',         '2026-05-03', 'Verified 2025-11-19. Source: Muskoka Lumber receipt 2025-11-19.'),
    (v_supplier_id, 'PASLODE 3 1/4 GALV STRIP NAIL 1.5M',                      '404858',        v_cat_hardware, '130.99', 'each',         '2026-05-03', 'Verified 2026-04-21. Source: Muskoka Lumber receipt 2026-04-21.'),
    (v_supplier_id, 'SDS SCREW 25 PCS 1/4" X 3"',                             'SDS25300R25',   v_cat_hardware, '26.79',  'each',         '2026-05-03', 'Verified 2026-04-24. Source: Muskoka Lumber receipt 2026-04-24.'),
    -- Lumber & Framing
    (v_supplier_id, '1 3/4" X 11 7/8" LVL 2.0E',                              '1341178LVL',    v_cat_lumber,   '11.20',  'per linear ft','2026-05-03', 'Verified 2026-04-21. Source: Muskoka Lumber receipt 2026-04-21.'),
    (v_supplier_id, '2 X 10 - 10 BROWN PRESSURE TREATED',                      '21010BPT',      v_cat_lumber,   '31.90',  'each',         '2026-05-03', 'Verified 2026-02-02. Source: Muskoka Lumber receipt 2026-02-02.'),
    (v_supplier_id, '2 X 10 - 12 BROWN PRESSURE TREATED',                      '21012BPT',      v_cat_lumber,   '38.28',  'each',         '2026-05-03', 'Verified 2026-02-02. Source: Muskoka Lumber receipt 2026-02-02.'),
    (v_supplier_id, '2 X 10 - 12 FT CEDAR DECK GRADE',                         '21012C',        v_cat_lumber,   '131.40', 'each',         '2026-05-03', 'Verified 2026-02-13. Source: Muskoka Lumber receipt 2026-02-13.'),
    (v_supplier_id, '2 X 10 - 14 FT CEDAR DECK GRADE',                         '21014C',        v_cat_lumber,   '153.30', 'each',         '2026-05-03', 'Verified 2026-02-13. Source: Muskoka Lumber receipt 2026-02-13.'),
    (v_supplier_id, '2 X 10 - 16 BROWN PRESSURE TREATED',                      '21016BPT',      v_cat_lumber,   '51.04',  'each',         '2026-05-03', 'Verified 2026-02-02. Source: Muskoka Lumber receipt 2026-02-02.'),
    (v_supplier_id, '2 X 10 - 8 BROWN PRESSURE TREATED',                       '21008BPT',      v_cat_lumber,   '25.52',  'each',         '2026-05-03', 'Verified 2026-02-02. Source: Muskoka Lumber receipt 2026-02-02.'),
    (v_supplier_id, '2 X 6 - 10 FT. SPRUCE',                                   '2610S',         v_cat_lumber,   '9.65',   'each',         '2026-05-03', 'Verified 2026-04-23. Source: Muskoka Lumber receipt 2026-04-23. Confirmed across 2 invoices (2026-04-22 to 2026-04-23).'),
    (v_supplier_id, '2 X 6 - 12 FT. SPRUCE',                                   '2612S',         v_cat_lumber,   '11.75',  'each',         '2026-05-03', 'Verified 2026-04-23. Source: Muskoka Lumber receipt 2026-04-23. Confirmed across 2 invoices (2026-04-22 to 2026-04-23).'),
    (v_supplier_id, '2 X 6 - 14 FT. SPRUCE',                                   '2614S',         v_cat_lumber,   '13.45',  'each',         '2026-05-03', 'Verified 2026-04-27. Source: Muskoka Lumber receipt 2026-04-27. Confirmed across 2 invoices (2026-04-22 to 2026-04-27).'),
    (v_supplier_id, '2 X 8 - 10 FT. SPRUCE',                                   '2810S',         v_cat_lumber,   '16.00',  'each',         '2026-05-03', 'Verified 2026-02-20. Source: Muskoka Lumber receipt 2026-02-20.'),
    (v_supplier_id, '2 X 8 - 12 BROWN PRESSURE TREATED',                       '2812BPT',       v_cat_lumber,   '31.08',  'each',         '2026-05-03', 'Verified 2026-02-10. Source: Muskoka Lumber receipt 2026-02-10. Confirmed across 2 invoices (2026-02-05 to 2026-02-10).'),
    (v_supplier_id, '2 X 8 - 14 FT. SPRUCE',                                   '2814S',         v_cat_lumber,   '22.40',  'each',         '2026-05-03', 'Verified 2026-04-27. Source: Muskoka Lumber receipt 2026-04-27.'),
    (v_supplier_id, '2 X 8 - 16 BROWN PRESSURE TREATED',                       '2816BPT',       v_cat_lumber,   '41.44',  'each',         '2026-05-03', 'Verified 2026-02-02. Source: Muskoka Lumber receipt 2026-02-02.'),
    (v_supplier_id, '3/4" X 7-1/2" X 16 ft CEDAR STK GRN S1S2E (Air Dried)',  '1816CS1S',      v_cat_lumber,   '85.60',  'each',         '2026-05-03', 'Verified 2026-03-09. Source: Muskoka Lumber receipt 2026-03-09.'),
    (v_supplier_id, '3/4" X 9-1/4" X 8 ft CEDAR STK GRN S1S2E (Air Dried)',   '1108CS1S',      v_cat_lumber,   '55.60',  'each',         '2026-05-03', 'Verified 2026-03-09. Source: Muskoka Lumber receipt 2026-03-09.'),
    (v_supplier_id, '6 X 8 - 20 ft FIR R/S',                                   '6820F',         v_cat_lumber,   '300.00', 'each',         '2026-05-03', 'Verified 2025-11-24. Source: Muskoka Lumber receipt 2025-11-24.'),
    (v_supplier_id, '6 X 8 - 22 ft FIR R/S',                                   '6822F',         v_cat_lumber,   '330.00', 'each',         '2026-05-03', 'Verified 2025-11-24. Source: Muskoka Lumber receipt 2025-11-24.'),
    (v_supplier_id, '6 X 8 - 24 ft FIR R/S',                                   '6824F',         v_cat_lumber,   '360.00', 'each',         '2026-05-03', 'Verified 2025-11-24. Source: Muskoka Lumber receipt 2025-11-24.'),
    (v_supplier_id, '8 X 8 - 20 ft FIR R/S',                                   '8820F',         v_cat_lumber,   '400.00', 'each',         '2026-05-03', 'Verified 2025-11-24. Source: Muskoka Lumber receipt 2025-11-24.'),
    (v_supplier_id, '8 X 8 - 22 ft FIR R/S',                                   '8822F',         v_cat_lumber,   '440.00', 'each',         '2026-05-03', 'Verified 2025-11-24. Source: Muskoka Lumber receipt 2025-11-24.'),
    (v_supplier_id, '8 X 8 - 8 ft FIR R/S',                                    '8808F',         v_cat_lumber,   '160.00', 'each',         '2026-05-03', 'Verified 2026-02-20. Source: Muskoka Lumber receipt 2026-02-20.'),
    (v_supplier_id, 'GALV. OVAL HEAD SID. 2 1/2"',                             '212OHSG1',      v_cat_lumber,   '3.85',   'per unit',     '2026-05-03', 'Verified 2026-02-10. Source: Muskoka Lumber receipt 2026-02-10.'),
    (v_supplier_id, 'GALV. OVAL HEAD SID. 3"',                                 '3OHSG1',        v_cat_lumber,   '3.85',   'per unit',     '2026-05-03', 'Verified 2026-04-29. Source: Muskoka Lumber receipt 2026-04-29.'),
    (v_supplier_id, 'L/F 1 X 4 PINE # 1 D4S KD',                               '14P',           v_cat_lumber,   '0.99',   'per linear ft','2026-05-03', 'Verified 2026-03-09. Source: Muskoka Lumber receipt 2026-03-09. Confirmed across 2 invoices (2026-02-13 to 2026-03-09).'),
    (v_supplier_id, 'L/F 1 X 6 PINE COVE #1 S/F',                              '16PC',          v_cat_lumber,   '1.39',   'per linear ft','2026-05-03', 'Verified 2026-02-24. Source: Muskoka Lumber receipt 2026-02-24.'),
    (v_supplier_id, 'L/F 1 X 8 PINE # 1 D4S',                                  '18P',           v_cat_lumber,   '2.79',   'per linear ft','2026-05-03', 'Verified 2026-04-20. Source: Muskoka Lumber receipt 2026-04-20.'),
    (v_supplier_id, 'L/F 2 X 6 #1 PINE 1 3/8"',                                '26P',           v_cat_lumber,   '1.99',   'per linear ft','2026-05-03', 'Verified 2026-02-13. Source: Muskoka Lumber receipt 2026-02-13.'),
    (v_supplier_id, 'L/F 2 X 8 #1 PINE 1 3/8"',                                '28P',           v_cat_lumber,   '2.99',   'per linear ft','2026-05-03', 'Verified 2026-02-13. Source: Muskoka Lumber receipt 2026-02-13.'),
    (v_supplier_id, 'RECIP. 12X1X18TPI HVY MTL LZ 5/PK',                       '2019012118R',   v_cat_lumber,   '53.63',  'each',         '2026-05-03', 'Verified 2025-11-27. Source: Muskoka Lumber receipt 2025-11-27.'),
    (v_supplier_id, 'SHT. 1/2" (12.5mm) STD SHEETING 4X8',                    '12STD',         v_cat_lumber,   '42.00',  'each',         '2026-05-03', 'Verified 2026-04-27. Source: Muskoka Lumber receipt 2026-04-27.'),
    -- Exterior & Decking
    (v_supplier_id, '24" ALUM Flat Stock Black/Commercial Brown (Low gloss)',   '24ARVBLBR',     v_cat_exterior, '459.99', 'roll',         '2026-05-03', 'Verified 2025-11-17. Source: Muskoka Lumber receipt 2025-11-17.'),
    (v_supplier_id, 'Alexandria 11/16" x 11/16" x 8 ft Quarter Round FJ Primed','00102-91096C', v_cat_exterior, '6.09',   'each',         '2026-05-03', 'Verified 2026-02-26. Source: Muskoka Lumber receipt 2026-02-26.'),
    (v_supplier_id, 'PC 12 ft WHITE ALUM WIN/DOOR CAP (118101)',                'ADCWH',         v_cat_exterior, '12.99',  'each',         '2026-05-03', 'Verified 2026-03-02. Source: Muskoka Lumber receipt 2026-03-02.'),
    (v_supplier_id, 'SELECT GRACE ICE & WATER SHIELD 3 X 65 ft',               'IWSGS',         v_cat_exterior, '169.99', 'roll',         '2026-05-03', 'Verified 2026-04-23. Source: Muskoka Lumber receipt 2026-04-23.'),
    (v_supplier_id, 'TYPAR 12" X 75 ft FLASHING BUTYL',                        'TYP1275',       v_cat_exterior, '107.89', 'each',         '2026-05-03', 'Verified 2026-02-03. Source: Muskoka Lumber receipt 2026-02-03.'),
    -- Demolition & Disposal
    (v_supplier_id, '18 X 18 COTTAGE PAD 13/SKID',                             'CP1818',        v_cat_demo,     '18.99',  'each',         '2026-05-03', 'Verified 2026-04-10. Source: Muskoka Lumber receipt 2026-04-10.'),
    (v_supplier_id, '33X44 2.5 MIL BL GARBAGE BAG 10',                         '93344',         v_cat_demo,     '13.99',  'each',         '2026-05-03', 'Verified 2025-11-14. Source: Muskoka Lumber receipt 2025-11-14.'),
    (v_supplier_id, '8 ft 6 in 6 MIL POLY 500 SQ.FT.RL. 67071',               '6MIL5',         v_cat_demo,     '38.49',  'roll',         '2026-05-03', 'Verified 2026-03-31. Source: Muskoka Lumber receipt 2026-03-31.'),
    (v_supplier_id, 'BULLS EYE 1-2-3 946ML',                                   'Z02014',        v_cat_demo,     '20.99',  'each',         '2026-05-03', 'Verified 2026-04-20. Source: Muskoka Lumber receipt 2026-04-20.');
END $$;
