/*
  # Fix all RLS policies - replace recursive profiles subqueries with get_my_role()

  Every policy in the database used EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ...)
  which causes recursive RLS evaluation since profiles itself has RLS enabled. This migration
  replaces all such checks with public.get_my_role() which is a SECURITY DEFINER function
  that bypasses RLS when reading the role.
*/

-- activity_log
DROP POLICY IF EXISTS "Admins and crew can insert activity log" ON activity_log;
DROP POLICY IF EXISTS "Admins and crew can view activity log" ON activity_log;
CREATE POLICY "Admins and crew can insert activity log" ON activity_log FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view activity log" ON activity_log FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- board_items
DROP POLICY IF EXISTS "Admins and crew can manage board items" ON board_items;
DROP POLICY IF EXISTS "Admins and crew can update board items" ON board_items;
DROP POLICY IF EXISTS "Admins and crew can view board items" ON board_items;
CREATE POLICY "Admins and crew can manage board items" ON board_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update board items" ON board_items FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view board items" ON board_items FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- board_presentation_tokens
DROP POLICY IF EXISTS "Admins and crew can manage presentation tokens" ON board_presentation_tokens;
DROP POLICY IF EXISTS "Admins and crew can insert presentation tokens" ON board_presentation_tokens;
CREATE POLICY "Admins and crew can manage presentation tokens" ON board_presentation_tokens FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can insert presentation tokens" ON board_presentation_tokens FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- board_snapshots
DROP POLICY IF EXISTS "Admins and crew can manage board snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "Admins and crew can view board snapshots" ON board_snapshots;
DROP POLICY IF EXISTS "Admins can delete board snapshots" ON board_snapshots;
CREATE POLICY "Admins and crew can manage board snapshots" ON board_snapshots FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view board snapshots" ON board_snapshots FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete board snapshots" ON board_snapshots FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- board_templates
DROP POLICY IF EXISTS "Admins and crew can manage board templates" ON board_templates;
DROP POLICY IF EXISTS "Admins and crew can view board templates" ON board_templates;
DROP POLICY IF EXISTS "Admins can delete board templates" ON board_templates;
CREATE POLICY "Admins and crew can manage board templates" ON board_templates FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view board templates" ON board_templates FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete board templates" ON board_templates FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- calendar_events
DROP POLICY IF EXISTS "Admins and crew can manage calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Admins and crew can update calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Admins and crew can view calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Admins can delete calendar events" ON calendar_events;
CREATE POLICY "Admins and crew can manage calendar events" ON calendar_events FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update calendar events" ON calendar_events FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view calendar events" ON calendar_events FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete calendar events" ON calendar_events FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- canvas_elements
DROP POLICY IF EXISTS "Admins and crew can delete canvas elements" ON canvas_elements;
DROP POLICY IF EXISTS "Admins and crew can manage canvas elements" ON canvas_elements;
DROP POLICY IF EXISTS "Admins and crew can update canvas elements" ON canvas_elements;
DROP POLICY IF EXISTS "Admins and crew can view canvas elements" ON canvas_elements;
CREATE POLICY "Admins and crew can delete canvas elements" ON canvas_elements FOR DELETE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can manage canvas elements" ON canvas_elements FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update canvas elements" ON canvas_elements FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view canvas elements" ON canvas_elements FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- change_orders
DROP POLICY IF EXISTS "Admins and crew can view change orders" ON change_orders;
DROP POLICY IF EXISTS "Admins can manage change orders" ON change_orders;
DROP POLICY IF EXISTS "Admins can update change orders" ON change_orders;
CREATE POLICY "Admins and crew can view change orders" ON change_orders FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage change orders" ON change_orders FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update change orders" ON change_orders FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- checklist_items
DROP POLICY IF EXISTS "Admins and crew can manage checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins and crew can update checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins and crew can view checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins can delete checklist items" ON checklist_items;
CREATE POLICY "Admins and crew can manage checklist items" ON checklist_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update checklist items" ON checklist_items FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view checklist items" ON checklist_items FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete checklist items" ON checklist_items FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- cinematic_reviews
DROP POLICY IF EXISTS "Admins and crew can manage cinematic reviews" ON cinematic_reviews;
DROP POLICY IF EXISTS "Admins and crew can update cinematic reviews" ON cinematic_reviews;
DROP POLICY IF EXISTS "Admins and crew can view cinematic reviews" ON cinematic_reviews;
CREATE POLICY "Admins and crew can manage cinematic reviews" ON cinematic_reviews FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update cinematic reviews" ON cinematic_reviews FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view cinematic reviews" ON cinematic_reviews FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- client_invites
DROP POLICY IF EXISTS "Admins can manage client invites" ON client_invites;
DROP POLICY IF EXISTS "Admins can update client invites" ON client_invites;
DROP POLICY IF EXISTS "Admins can view client invites" ON client_invites;
CREATE POLICY "Admins can manage client invites" ON client_invites FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update client invites" ON client_invites FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view client invites" ON client_invites FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- cost_categories
DROP POLICY IF EXISTS "Admins and crew can view cost categories" ON cost_categories;
DROP POLICY IF EXISTS "Admins can manage cost categories" ON cost_categories;
DROP POLICY IF EXISTS "Admins can update cost categories" ON cost_categories;
CREATE POLICY "Admins and crew can view cost categories" ON cost_categories FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage cost categories" ON cost_categories FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update cost categories" ON cost_categories FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- crew_rates
DROP POLICY IF EXISTS "Admins can manage crew rates" ON crew_rates;
DROP POLICY IF EXISTS "Admins can update crew rates" ON crew_rates;
DROP POLICY IF EXISTS "Admins can view crew rates" ON crew_rates;
CREATE POLICY "Admins can manage crew rates" ON crew_rates FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update crew rates" ON crew_rates FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view crew rates" ON crew_rates FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- decisions
DROP POLICY IF EXISTS "Admins and crew can manage decisions" ON decisions;
DROP POLICY IF EXISTS "Admins and crew can update decisions" ON decisions;
DROP POLICY IF EXISTS "Admins and crew can view decisions" ON decisions;
DROP POLICY IF EXISTS "Admins can delete decisions" ON decisions;
CREATE POLICY "Admins and crew can manage decisions" ON decisions FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update decisions" ON decisions FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view decisions" ON decisions FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete decisions" ON decisions FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- documents
DROP POLICY IF EXISTS "Admins and crew can insert documents" ON documents;
DROP POLICY IF EXISTS "Admins and crew can view documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins and crew can insert documents" ON documents FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view documents" ON documents FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete documents" ON documents FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- estimate_items
DROP POLICY IF EXISTS "Admins can delete estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Admins can manage estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Admins can update estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Admins can view estimate items" ON estimate_items;
CREATE POLICY "Admins can delete estimate items" ON estimate_items FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can manage estimate items" ON estimate_items FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update estimate items" ON estimate_items FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view estimate items" ON estimate_items FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- estimate_warnings
DROP POLICY IF EXISTS "Admins can manage estimate warnings" ON estimate_warnings;
DROP POLICY IF EXISTS "Admins can update estimate warnings" ON estimate_warnings;
DROP POLICY IF EXISTS "Admins can view estimate warnings" ON estimate_warnings;
CREATE POLICY "Admins can manage estimate warnings" ON estimate_warnings FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update estimate warnings" ON estimate_warnings FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view estimate warnings" ON estimate_warnings FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- feature_flags
DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;
DROP POLICY IF EXISTS "Admins can update feature flags" ON feature_flags;
CREATE POLICY "Admins can manage feature flags" ON feature_flags FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update feature flags" ON feature_flags FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- market_rates
DROP POLICY IF EXISTS "Admins and crew can view market rates" ON market_rates;
DROP POLICY IF EXISTS "Admins can manage market rates" ON market_rates;
DROP POLICY IF EXISTS "Admins can update market rates" ON market_rates;
CREATE POLICY "Admins and crew can view market rates" ON market_rates FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage market rates" ON market_rates FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update market rates" ON market_rates FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- messages
DROP POLICY IF EXISTS "Project members can send messages" ON messages;
DROP POLICY IF EXISTS "Project members can view messages" ON messages;
CREATE POLICY "Project members can send messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND (public.get_my_role() = ANY (ARRAY['admin','crew']) OR EXISTS (SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.client_id = auth.uid())));
CREATE POLICY "Project members can view messages" ON messages FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin','crew']) OR EXISTS (SELECT 1 FROM projects WHERE projects.id = messages.project_id AND projects.client_id = auth.uid()));

-- milestones
DROP POLICY IF EXISTS "Admins and crew can view milestones" ON milestones;
DROP POLICY IF EXISTS "Admins can delete milestones" ON milestones;
DROP POLICY IF EXISTS "Admins can manage milestones" ON milestones;
DROP POLICY IF EXISTS "Admins can update milestones" ON milestones;
CREATE POLICY "Admins and crew can view milestones" ON milestones FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete milestones" ON milestones FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can manage milestones" ON milestones FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update milestones" ON milestones FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- paint_colors
DROP POLICY IF EXISTS "Admins and crew can view paint colors" ON paint_colors;
DROP POLICY IF EXISTS "Admins can manage paint colors" ON paint_colors;
CREATE POLICY "Admins and crew can view paint colors" ON paint_colors FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage paint colors" ON paint_colors FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');

-- photos
DROP POLICY IF EXISTS "Admins and crew can insert photos" ON photos;
DROP POLICY IF EXISTS "Admins and crew can update photos" ON photos;
DROP POLICY IF EXISTS "Admins and crew can view photos" ON photos;
DROP POLICY IF EXISTS "Admins can delete photos" ON photos;
CREATE POLICY "Admins and crew can insert photos" ON photos FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update photos" ON photos FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view photos" ON photos FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete photos" ON photos FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- planning_boards
DROP POLICY IF EXISTS "Admins and crew can manage planning boards" ON planning_boards;
DROP POLICY IF EXISTS "Admins and crew can update planning boards" ON planning_boards;
DROP POLICY IF EXISTS "Admins and crew can view planning boards" ON planning_boards;
DROP POLICY IF EXISTS "Admins can delete planning boards" ON planning_boards;
CREATE POLICY "Admins and crew can manage planning boards" ON planning_boards FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update planning boards" ON planning_boards FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view planning boards" ON planning_boards FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete planning boards" ON planning_boards FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- project_estimates
DROP POLICY IF EXISTS "Admins can manage estimates" ON project_estimates;
DROP POLICY IF EXISTS "Admins can update estimates" ON project_estimates;
DROP POLICY IF EXISTS "Admins can view all estimates" ON project_estimates;
CREATE POLICY "Admins can manage estimates" ON project_estimates FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update estimates" ON project_estimates FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view all estimates" ON project_estimates FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- queued_sms
DROP POLICY IF EXISTS "Admins can manage queued SMS" ON queued_sms;
DROP POLICY IF EXISTS "Admins can view queued SMS" ON queued_sms;
CREATE POLICY "Admins can manage queued SMS" ON queued_sms FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view queued SMS" ON queued_sms FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- receipts
DROP POLICY IF EXISTS "Admins can manage receipts" ON receipts;
DROP POLICY IF EXISTS "Admins can update receipts" ON receipts;
DROP POLICY IF EXISTS "Admins can view receipts" ON receipts;
CREATE POLICY "Admins can manage receipts" ON receipts FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update receipts" ON receipts FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view receipts" ON receipts FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- regional_modifiers
DROP POLICY IF EXISTS "Admins and crew can view regional modifiers" ON regional_modifiers;
DROP POLICY IF EXISTS "Admins can manage regional modifiers" ON regional_modifiers;
DROP POLICY IF EXISTS "Admins can update regional modifiers" ON regional_modifiers;
CREATE POLICY "Admins and crew can view regional modifiers" ON regional_modifiers FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage regional modifiers" ON regional_modifiers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update regional modifiers" ON regional_modifiers FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- room_renders
DROP POLICY IF EXISTS "Admins and crew can manage room renders" ON room_renders;
DROP POLICY IF EXISTS "Admins and crew can update room renders" ON room_renders;
DROP POLICY IF EXISTS "Admins and crew can view room renders" ON room_renders;
CREATE POLICY "Admins and crew can manage room renders" ON room_renders FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update room renders" ON room_renders FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view room renders" ON room_renders FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- sections
DROP POLICY IF EXISTS "Admins and crew can view sections" ON sections;
DROP POLICY IF EXISTS "Admins can delete sections" ON sections;
DROP POLICY IF EXISTS "Admins can manage sections" ON sections;
DROP POLICY IF EXISTS "Admins can update sections" ON sections;
CREATE POLICY "Admins and crew can view sections" ON sections FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete sections" ON sections FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can manage sections" ON sections FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update sections" ON sections FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- selections
DROP POLICY IF EXISTS "Admins and crew can manage selections" ON selections;
DROP POLICY IF EXISTS "Admins and crew can update selections" ON selections;
DROP POLICY IF EXISTS "Admins and crew can view selections" ON selections;
DROP POLICY IF EXISTS "Admins can delete selections" ON selections;
CREATE POLICY "Admins and crew can manage selections" ON selections FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update selections" ON selections FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view selections" ON selections FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete selections" ON selections FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- site_visits
DROP POLICY IF EXISTS "Admins and crew can manage site visits" ON site_visits;
DROP POLICY IF EXISTS "Admins and crew can update site visits" ON site_visits;
DROP POLICY IF EXISTS "Admins and crew can view site visits" ON site_visits;
CREATE POLICY "Admins and crew can manage site visits" ON site_visits FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can update site visits" ON site_visits FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view site visits" ON site_visits FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- sub_milestones
DROP POLICY IF EXISTS "Admins and crew can view sub_milestones" ON sub_milestones;
DROP POLICY IF EXISTS "Admins can delete sub_milestones" ON sub_milestones;
DROP POLICY IF EXISTS "Admins can manage sub_milestones" ON sub_milestones;
DROP POLICY IF EXISTS "Admins can update sub_milestones" ON sub_milestones;
CREATE POLICY "Admins and crew can view sub_milestones" ON sub_milestones FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete sub_milestones" ON sub_milestones FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can manage sub_milestones" ON sub_milestones FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update sub_milestones" ON sub_milestones FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- subcontractors
DROP POLICY IF EXISTS "Admins and crew can view subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Admins can manage subcontractors" ON subcontractors;
DROP POLICY IF EXISTS "Admins can update subcontractors" ON subcontractors;
CREATE POLICY "Admins and crew can view subcontractors" ON subcontractors FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage subcontractors" ON subcontractors FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update subcontractors" ON subcontractors FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- supplier_prices
DROP POLICY IF EXISTS "Admins and crew can view supplier prices" ON supplier_prices;
DROP POLICY IF EXISTS "Admins can manage supplier prices" ON supplier_prices;
DROP POLICY IF EXISTS "Admins can update supplier prices" ON supplier_prices;
CREATE POLICY "Admins and crew can view supplier prices" ON supplier_prices FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage supplier prices" ON supplier_prices FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update supplier prices" ON supplier_prices FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- suppliers
DROP POLICY IF EXISTS "Admins and crew can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
DROP POLICY IF EXISTS "Admins can update suppliers" ON suppliers;
CREATE POLICY "Admins and crew can view suppliers" ON suppliers FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can manage suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update suppliers" ON suppliers FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- table_redesign_materials
DROP POLICY IF EXISTS "Admins can manage table redesign materials" ON table_redesign_materials;
DROP POLICY IF EXISTS "Admins can update table redesign materials" ON table_redesign_materials;
DROP POLICY IF EXISTS "Admins can view table redesign materials" ON table_redesign_materials;
CREATE POLICY "Admins can manage table redesign materials" ON table_redesign_materials FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update table redesign materials" ON table_redesign_materials FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view table redesign materials" ON table_redesign_materials FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- table_redesign_plans
DROP POLICY IF EXISTS "Admins can manage table redesign plans" ON table_redesign_plans;
DROP POLICY IF EXISTS "Admins can update table redesign plans" ON table_redesign_plans;
DROP POLICY IF EXISTS "Admins can view table redesign plans" ON table_redesign_plans;
CREATE POLICY "Admins can manage table redesign plans" ON table_redesign_plans FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update table redesign plans" ON table_redesign_plans FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view table redesign plans" ON table_redesign_plans FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');

-- tasks
DROP POLICY IF EXISTS "Admins and crew can update tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and crew can view tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;
CREATE POLICY "Admins and crew can update tasks" ON tasks FOR UPDATE TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew'])) WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins and crew can view tasks" ON tasks FOR SELECT TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin','crew']));
CREATE POLICY "Admins can delete tasks" ON tasks FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can manage tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = ANY (ARRAY['admin','crew']));

-- tenant_settings
DROP POLICY IF EXISTS "Admins can update tenant settings" ON tenant_settings;
CREATE POLICY "Admins can update tenant settings" ON tenant_settings FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- time_entries
DROP POLICY IF EXISTS "Admins can update all time entries" ON time_entries;
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;
CREATE POLICY "Admins can update all time entries" ON time_entries FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can view all time entries" ON time_entries FOR SELECT TO authenticated USING (public.get_my_role() = 'admin');
