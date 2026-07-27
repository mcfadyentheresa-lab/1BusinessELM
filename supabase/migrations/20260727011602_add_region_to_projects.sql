/*
# Add region column to projects

## Purpose
The estimate-auditor edge function needs to know a project's region to look up
applicable regional_modifiers (e.g. boat-access premium, winter premium).
Previously projects had no region field — only free-text address/city.

## Changes
1. New column: projects.region (text, nullable, default null)
   - Nullable so existing rows are unaffected
   - When null, the estimate-auditor skips the regional modifier check
   - Set to e.g. 'muskoka' to activate regional pricing modifiers

## Security
- No RLS policy changes (projects already has RLS enabled with existing policies)
*/