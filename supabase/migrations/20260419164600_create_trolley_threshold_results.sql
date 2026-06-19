/*
  # Create trolley_threshold_results table

  1. New Tables
    - `trolley_threshold_results`
      - `id` (uuid, primary key)
      - `participant_id` (text, optional participant identifier)
      - `completed` (boolean)
      - `completed_at` (timestamptz)
      - `lever_threshold` (jsonb) - the LeverThresholdResult
      - `bridge_threshold` (jsonb, nullable) - the BridgeThresholdResult or null
      - `summary` (jsonb) - convenience computed summary
      - `history` (jsonb) - array of TrolleyChoiceRecord
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `trolley_threshold_results`
    - Allow anonymous (anon) and authenticated users to INSERT their own rows
    - Allow authenticated users to SELECT only rows they own by participant_id

  3. Notes
    - This table mirrors the shape used by the `money_threshold_results` table
    - Insert-only from the client; no updates / deletes policies granted
*/

CREATE TABLE IF NOT EXISTS trolley_threshold_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id text DEFAULT '',
  completed boolean DEFAULT false,
  completed_at timestamptz DEFAULT now(),
  lever_threshold jsonb DEFAULT '{}'::jsonb,
  bridge_threshold jsonb,
  summary jsonb DEFAULT '{}'::jsonb,
  history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trolley_threshold_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert trolley results"
  ON trolley_threshold_results
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Participants can read their own trolley results"
  ON trolley_threshold_results
  FOR SELECT
  TO authenticated
  USING (participant_id = auth.uid()::text);
