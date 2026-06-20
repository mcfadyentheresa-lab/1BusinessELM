-- Seed paint_colors with a curated library of popular paint colors
-- Benjamin Moore, Sherwin-Williams, and Farrow & Ball

INSERT INTO paint_colors (brand, name, code, hex, color_family, collection, lrv, is_popular) VALUES
-- Benjamin Moore Whites & Off-Whites
('Benjamin Moore', 'Chantilly Lace', 'OC-65', '#F5F4F0', 'White', 'Off-White Collection', 92, true),
('Benjamin Moore', 'White Dove', 'OC-17', '#F4F2EC', 'White', 'Off-White Collection', 85, true),
('Benjamin Moore', 'Simply White', 'OC-117', '#F5F2E8', 'White', 'Off-White Collection', 91, true),
('Benjamin Moore', 'Decorators White', 'OC-149', '#F2F0EB', 'White', 'Off-White Collection', 84, true),
('Benjamin Moore', 'Cloud White', 'OC-130', '#EDE9DF', 'White', 'Off-White Collection', 83, true),
('Benjamin Moore', 'Snowfall White', 'OC-118', '#F0EEE9', 'White', 'Off-White Collection', 88, false),
('Benjamin Moore', 'Super White', 'PM-1', '#F7F6F2', 'White', 'Personal Colors', 93, true),
('Benjamin Moore', 'Linen White', 'OC-146', '#EDE5D5', 'Off-White', 'Off-White Collection', 78, true),
('Benjamin Moore', 'White Wisp', 'OC-54', '#EAE8DF', 'White', 'Off-White Collection', 82, false),
('Benjamin Moore', 'Brilliant White', '2020-70', '#F6F5F2', 'White', 'Classic Colors', 93, false),

-- Benjamin Moore Grays & Greiges
('Benjamin Moore', 'Pale Oak', 'OC-20', '#CBBFA9', 'Neutral', 'Off-White Collection', 60, true),
('Benjamin Moore', 'Revere Pewter', 'HC-172', '#C2BAA6', 'Gray', 'Historical Collection', 55, true),
('Benjamin Moore', 'Edgecomb Gray', 'HC-173', '#CAC2B1', 'Gray', 'Historical Collection', 61, true),
('Benjamin Moore', 'Sea Salt', 'CSP-95', '#B8C4BE', 'Gray', 'Color Stories', 54, false),
('Benjamin Moore', 'Stonington Gray', 'HC-170', '#A8ADB4', 'Gray', 'Historical Collection', 46, true),
('Benjamin Moore', 'Balboa Mist', 'OC-27', '#CBC5BA', 'Gray', 'Off-White Collection', 62, true),
('Benjamin Moore', 'Collingwood', 'OC-28', '#C4BEAF', 'Gray', 'Off-White Collection', 59, true),
('Benjamin Moore', 'Silver Chain', '1472', '#B2B0AB', 'Gray', 'Classic Colors', 50, false),
('Benjamin Moore', 'Gettysburg Gray', 'HC-107', '#8C9197', 'Gray', 'Historical Collection', 36, false),
('Benjamin Moore', 'Kendall Charcoal', 'HC-166', '#6A6D6F', 'Gray', 'Historical Collection', 18, true),

-- Benjamin Moore Blues
('Benjamin Moore', 'Hale Navy', 'HC-154', '#445A6E', 'Blue', 'Historical Collection', 10, true),
('Benjamin Moore', 'Van Deusen Blue', 'HC-156', '#415F73', 'Blue', 'Historical Collection', 11, true),
('Benjamin Moore', 'Blue Note', '2129-30', '#5B7A8A', 'Blue', 'Classic Colors', 18, false),
('Benjamin Moore', 'Newburyport Blue', 'HC-155', '#6382A2', 'Blue', 'Historical Collection', 22, false),
('Benjamin Moore', 'Old Navy', '2064-10', '#2D3A47', 'Blue', 'Classic Colors', 5, false),
('Benjamin Moore', 'Windy Sky', '2059-60', '#A9C3D4', 'Blue', 'Classic Colors', 54, false),
('Benjamin Moore', 'Breath of Fresh Air', '806', '#D6E8EB', 'Blue', 'Classic Colors', 72, false),
('Benjamin Moore', 'Buxton Blue', 'HC-149', '#8DA3AD', 'Blue', 'Historical Collection', 34, false),

-- Benjamin Moore Greens
('Benjamin Moore', 'Sage Mountain', '2143-40', '#7B8F7B', 'Green', 'Classic Colors', 27, false),
('Benjamin Moore', 'Aganthus Green', 'HC-120', '#697A67', 'Green', 'Historical Collection', 21, false),
('Benjamin Moore', 'Nile Green', '471', '#7D9981', 'Green', 'Classic Colors', 30, false),
('Benjamin Moore', 'Stem Green', '2029-40', '#859575', 'Green', 'Classic Colors', 32, false),
('Benjamin Moore', 'October Mist', '1495', '#BBBFAC', 'Green', 'Classic Colors', 52, true),
('Benjamin Moore', 'Forest Green', '2047-10', '#2D4A35', 'Green', 'Classic Colors', 6, false),
('Benjamin Moore', 'Prescott Green', 'HC-140', '#5E7060', 'Green', 'Historical Collection', 17, false),

-- Benjamin Moore Warm Tones
('Benjamin Moore', 'Tucson Tan', 'CC-120', '#B49A7E', 'Brown', 'Cozy Colors', 42, false),
('Benjamin Moore', 'Spanish Tan', 'HC-91', '#C3A882', 'Brown', 'Historical Collection', 49, false),
('Benjamin Moore', 'Warm Caramel', '2165-30', '#B58B5B', 'Brown', 'Classic Colors', 30, false),
('Benjamin Moore', 'Jute', '2161-40', '#BCA98A', 'Neutral', 'Classic Colors', 47, true),
('Benjamin Moore', 'Camouflage', '2143-30', '#7D7659', 'Brown', 'Classic Colors', 24, false),
('Benjamin Moore', 'Brick Red', '2175-20', '#8E3D33', 'Red', 'Classic Colors', 9, false),
('Benjamin Moore', 'Heritage Red', 'HC-181', '#8B3433', 'Red', 'Historical Collection', 9, false),

-- Benjamin Moore Darks
('Benjamin Moore', 'Black Beauty', '2128-10', '#1C1C1E', 'Black', 'Classic Colors', 2, true),
('Benjamin Moore', 'Onyx', '2133-10', '#272725', 'Black', 'Classic Colors', 2, false),
('Benjamin Moore', 'Carbon Copy', '2117-10', '#2A2B29', 'Black', 'Classic Colors', 2, false),
('Benjamin Moore', 'Wrought Iron', '2124-10', '#3C3F42', 'Black', 'Classic Colors', 5, true),

-- Sherwin-Williams Whites
('Sherwin-Williams', 'Alabaster', 'SW 7008', '#EDEADF', 'White', 'Timeless White', 82, true),
('Sherwin-Williams', 'Pure White', 'SW 7005', '#F2EFE7', 'White', 'Timeless White', 87, true),
('Sherwin-Williams', 'High Reflective White', 'SW 7757', '#F5F5F3', 'White', 'Core Colors', 94, false),
('Sherwin-Williams', 'Shoji White', 'SW 7042', '#E3DFCF', 'Off-White', 'Timeless White', 73, true),
('Sherwin-Williams', 'Dover White', 'SW 6385', '#EFE9DA', 'White', 'Whites & Pastels', 82, true),
('Sherwin-Williams', 'Creamy', 'SW 7012', '#EEE5D0', 'Off-White', 'Timeless White', 77, true),
('Sherwin-Williams', 'White Duck', 'SW 7010', '#E3DFCF', 'White', 'Timeless White', 74, false),
('Sherwin-Williams', 'Eider White', 'SW 7014', '#DDD9CC', 'White', 'Timeless White', 71, false),

-- Sherwin-Williams Grays
('Sherwin-Williams', 'Agreeable Gray', 'SW 7029', '#D0C9BB', 'Gray', 'Naturals', 60, true),
('Sherwin-Williams', 'Accessible Beige', 'SW 7036', '#CFC2AE', 'Neutral', 'Naturals', 58, true),
('Sherwin-Williams', 'Repose Gray', 'SW 7015', '#C2BDB5', 'Gray', 'Timeless White', 58, true),
('Sherwin-Williams', 'Mindful Gray', 'SW 7016', '#BCBAB1', 'Gray', 'Timeless White', 55, false),
('Sherwin-Williams', 'Worldly Gray', 'SW 7043', '#C5BFAF', 'Gray', 'Timeless White', 57, false),
('Sherwin-Williams', 'Colonnade Gray', 'SW 7641', '#A9A49C', 'Gray', 'Classics', 43, false),
('Sherwin-Williams', 'Dorian Gray', 'SW 7017', '#AAAAA0', 'Gray', 'Timeless White', 40, false),
('Sherwin-Williams', 'Andiron', 'SW 0050', '#6B6B65', 'Gray', 'Classics', 16, false),
('Sherwin-Williams', 'Peppercorn', 'SW 7674', '#595651', 'Gray', 'Classics', 10, true),
('Sherwin-Williams', 'Iron Ore', 'SW 7069', '#3D3C39', 'Black', 'Classics', 5, true),

-- Sherwin-Williams Blues & Greens
('Sherwin-Williams', 'Naval', 'SW 6244', '#3F4E60', 'Blue', 'Classics', 7, true),
('Sherwin-Williams', 'Anchors Aweigh', 'SW 6217', '#8098A8', 'Blue', 'Classics', 30, false),
('Sherwin-Williams', 'Jasper Stone', 'SW 0017', '#607A88', 'Blue', 'Classics', 20, false),
('Sherwin-Williams', 'Rainwashed', 'SW 6211', '#A9BEB9', 'Blue', 'Classics', 50, false),
('Sherwin-Williams', 'Sage', 'SW 0050', '#8D9B85', 'Green', 'Classics', 31, false),
('Sherwin-Williams', 'Retreat', 'SW 6207', '#A2B5AA', 'Green', 'Classics', 44, false),
('Sherwin-Williams', 'Pewter Green', 'SW 6208', '#738E7E', 'Green', 'Classics', 22, true),
('Sherwin-Williams', 'Romaine', 'SW 6730', '#7A8E6E', 'Green', 'Classics', 25, false),
('Sherwin-Williams', 'Basil', 'SW 6194', '#4E6350', 'Green', 'Classics', 11, false),
('Sherwin-Williams', 'Rookwood Dark Green', 'SW 2809', '#2F4034', 'Green', 'Classics', 5, false),

-- Sherwin-Williams Warm & Earth
('Sherwin-Williams', 'Nomadic Desert', 'SW 6107', '#CDB99A', 'Neutral', 'Naturals', 57, false),
('Sherwin-Williams', 'Sand Dollar', 'SW 7604', '#D8CFBB', 'Neutral', 'Naturals', 66, false),
('Sherwin-Williams', 'Antique White', 'SW 6119', '#EAE0C8', 'Off-White', 'Whites & Pastels', 78, false),
('Sherwin-Williams', 'Rookwood Brown', 'SW 2808', '#7A5C42', 'Brown', 'Classics', 16, false),
('Sherwin-Williams', 'Cavern Clay', 'SW 7701', '#C17655', 'Red', 'Living Well', 24, true),
('Sherwin-Williams', 'Rojo Dust', 'SW 7600', '#9D5641', 'Red', 'Naturals', 16, false),

-- Farrow & Ball
('Farrow & Ball', 'Pointing', 'No. 2003', '#EDE7D9', 'White', 'Neutrals', 78, true),
('Farrow & Ball', 'All White', 'No. 2005', '#F1EDE4', 'White', 'Whites', 89, true),
('Farrow & Ball', 'Wimborne White', 'No. 239', '#EEE8D8', 'White', 'Whites', 83, false),
('Farrow & Ball', 'Elephant''s Breath', 'No. 229', '#C0BAB2', 'Gray', 'Neutrals', 54, true),
('Farrow & Ball', 'Purbeck Stone', 'No. 275', '#BCBCB0', 'Gray', 'Neutrals', 52, false),
('Farrow & Ball', 'Mole''s Breath', 'No. 276', '#918D87', 'Gray', 'Neutrals', 35, false),
('Farrow & Ball', 'Hardwick White', 'No. 5', '#D5CFC0', 'Gray', 'Neutrals', 62, false),
('Farrow & Ball', 'Lamp Room Gray', 'No. 88', '#B5B4AB', 'Gray', 'Neutrals', 50, false),
('Farrow & Ball', 'Hague Blue', 'No. 30', '#374B5C', 'Blue', 'Blues', 8, true),
('Farrow & Ball', 'Inchyra Blue', 'No. 289', '#5A6F75', 'Blue', 'Blues', 16, false),
('Farrow & Ball', 'Stone Blue', 'No. 86', '#738B8E', 'Blue', 'Blues', 24, false),
('Farrow & Ball', 'Mizzle', 'No. 266', '#8A9B87', 'Green', 'Greens', 31, false),
('Farrow & Ball', 'Muted Sage', 'No. 270', '#BFBFAE', 'Green', 'Greens', 52, false),
('Farrow & Ball', 'Green Smoke', 'No. 47', '#7C8F7A', 'Green', 'Greens', 27, false),
('Farrow & Ball', 'Calke Green', 'No. 80', '#5A7164', 'Green', 'Greens', 14, true),
('Farrow & Ball', 'Dead Salmon', 'No. 28', '#C0A090', 'Neutral', 'Neutrals', 44, false),
('Farrow & Ball', 'Setting Plaster', 'No. 231', '#D4A898', 'Red', 'Reds & Pinks', 44, true),
('Farrow & Ball', 'Peignoir', 'No. 286', '#D8CFCC', 'Neutral', 'Pinks', 64, false),
('Farrow & Ball', 'Stony Ground', 'No. 211', '#C9C0A8', 'Neutral', 'Neutrals', 58, false),
('Farrow & Ball', 'Brinjal', 'No. 222', '#5A3A4A', 'Brown', 'Reds & Pinks', 8, false),
('Farrow & Ball', 'Off-Black', 'No. 57', '#3A3A38', 'Black', 'Neutrals', 4, true),
('Farrow & Ball', 'Railings', 'No. 31', '#3B3F46', 'Black', 'Blues', 4, true),
('Farrow & Ball', 'Pitch Black', 'No. 256', '#1C1D1E', 'Black', 'Neutrals', 2, false),
('Farrow & Ball', 'Dimpse', 'No. 277', '#97958D', 'Gray', 'Neutrals', 38, false),
('Farrow & Ball', 'Manor House Gray', 'No. 265', '#8D8C88', 'Gray', 'Neutrals', 35, false),
('Farrow & Ball', 'Charleston Gray', 'No. 243', '#B1AEA6', 'Gray', 'Neutrals', 48, false),
('Farrow & Ball', 'Strong White', 'No. 2001', '#E8E4DA', 'White', 'Whites', 79, false),
('Farrow & Ball', 'Blackened', 'No. 2011', '#D6D8D6', 'White', 'Whites', 72, false)

ON CONFLICT DO NOTHING;
