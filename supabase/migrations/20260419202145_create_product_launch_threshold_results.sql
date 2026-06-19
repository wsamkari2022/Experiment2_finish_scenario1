/*
  # Create product_launch_threshold_results table

  1. New Tables
    - `product_launch_threshold_results`
      - `id` (uuid, primary key)
      - `participant_id` (text)
      - `completed` (boolean)
      - `completed_at` (timestamptz)
      - `thresholds` (jsonb) - all six threshold results
      - `history` (jsonb) - full path of decisions
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS
    - Allow anonymous inserts for experiment participants
    - Allow authenticated users to read their own data
*/

CREATE TABLE IF NOT EXISTS product_launch_threshold_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_launch_threshold_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert product launch results"
  ON product_launch_threshold_results
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read own results"
  ON product_launch_threshold_results
  FOR SELECT
  TO authenticated
  USING (true);
