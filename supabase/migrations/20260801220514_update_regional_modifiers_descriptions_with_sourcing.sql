-- Update ONLY the description field on 4 regional_modifiers rows to add sourcing documentation.
-- No values, modifier_types, or any other columns are touched.
-- Rows 5-8 (permit formulas, CRA mileage, crew accommodation) are left untouched.

UPDATE regional_modifiers SET description = '25% surcharge. Consistent with documented Muskoka island-access premiums of 10%-25%, driven by barge mobilization, limited staging, and compressed seasonal timelines. Source: Muskoka builder markup research, 2026.' WHERE id = 1;

UPDATE regional_modifiers SET description = '15% surcharge. Consistent with documented remote-delivery cost uplifts of 15%-20% for nonstandard access/logistics in comparable remote-site construction. Source: Muskoka builder markup research, 2026.' WHERE id = 2;

UPDATE regional_modifiers SET description = '20% surcharge. Winter access, heat, and site clearing are confirmed as a standard Muskoka cost-plus line item in local builder practice, but no single published benchmark percentage exists — this figure is a working estimate pending further verification. Source: Muskoka builder markup research, 2026.' WHERE id = 3;

UPDATE regional_modifiers SET description = '30% surcharge. Broadly consistent with 25%-40% ranges cited for highly complex renovation scopes (structural rework, heritage conditions), though not Muskoka-specific. Source: Muskoka builder markup research, 2026.' WHERE id = 4;