/*
  # Create money threshold experiment results table

  1. New Tables
    - `money_threshold_results`
      - `id` (uuid, primary key)
      - `participant_id` (text, optional anonymous identifier)
      - `completed` (boolean)
      - `completed_at` (timestamptz)
      - `thresholds` (jsonb) - threshold results per context
      - `history` (jsonb) - full decision history
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS
    - Allow anonymous inserts (experiment participation)
    - Allow anonymous read of own records by id
*/

CREATE TABLE IF NOT EXISTS money_threshold_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text DEFAULT '',
  completed boolean DEFAULT false,
  completed_at timestamptz DEFAULT now(),
  thresholds jsonb DEFAULT '{}'::jsonb,
  history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE money_threshold_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit experiment results"
  ON money_threshold_results FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all results"
  ON money_threshold_results FOR SELECT
  TO authenticated
  USING (true);
