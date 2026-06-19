/*
  # Create Block 4 system tables

  1. New Tables
    - `moral_profile_insights`
      - Stores derived moral profile computed from Blocks 1-3
      - participant_id, profile (jsonb), seed_case (jsonb), domain (text), created_at
    - `block4_reflection_results`
      - Stores the adaptive stakeholder reflection block results
      - participant_id, seed_case (jsonb), domain (text), steps (jsonb), initial_decision, mid_decision, final_decision, confidence, completed, completed_at
    - `final_moral_analysis`
      - Stores the final analysis output
      - participant_id, analysis (jsonb), tentative_style (text), completed_at
  2. Security
    - Enable RLS on all three tables
    - Allow anonymous inserts for experiment participants
    - Allow authenticated reads
*/

CREATE TABLE IF NOT EXISTS moral_profile_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL DEFAULT '',
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  seed_case jsonb NOT NULL DEFAULT '{}'::jsonb,
  domain text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moral_profile_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert moral profile insights"
  ON moral_profile_insights
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read moral profile insights"
  ON moral_profile_insights
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS block4_reflection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL DEFAULT '',
  seed_case jsonb NOT NULL DEFAULT '{}'::jsonb,
  domain text NOT NULL DEFAULT '',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  initial_decision text NOT NULL DEFAULT '',
  mid_decision text NOT NULL DEFAULT '',
  final_decision text NOT NULL DEFAULT '',
  confidence integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE block4_reflection_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert block4 reflection results"
  ON block4_reflection_results
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read block4 reflection results"
  ON block4_reflection_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS final_moral_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL DEFAULT '',
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  tentative_style text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE final_moral_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert final moral analysis"
  ON final_moral_analysis
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read final moral analysis"
  ON final_moral_analysis
  FOR SELECT
  TO authenticated
  USING (true);
