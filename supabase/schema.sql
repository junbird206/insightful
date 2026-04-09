-- ============================================================
-- insightful — Supabase schema
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. scraps 테이블
CREATE TABLE scraps (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
  original_url  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  opened_at     TIMESTAMPTZ,
  status        TEXT DEFAULT 'processing' NOT NULL,
  source_platform TEXT DEFAULT 'unknown' NOT NULL,
  site_name     TEXT,
  image_url     TEXT,
  raw_title     TEXT,
  raw_description TEXT,
  bucket        TEXT NOT NULL,
  memo          TEXT DEFAULT '' NOT NULL,
  tags          TEXT[] DEFAULT '{}' NOT NULL,
  starred       BOOLEAN DEFAULT false NOT NULL,
  remind_at     TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ,
  suggested_memo TEXT
);

ALTER TABLE scraps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scraps"
  ON scraps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraps"
  ON scraps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scraps"
  ON scraps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraps"
  ON scraps FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_scraps_user_id ON scraps(user_id);
CREATE INDEX idx_scraps_user_bucket ON scraps(user_id, bucket);

-- 2. tag_pools 테이블
CREATE TABLE tag_pools (
  user_id    UUID REFERENCES auth.users(id) DEFAULT auth.uid() PRIMARY KEY,
  tags       TEXT[] DEFAULT '{}' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE tag_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tag pool"
  ON tag_pools FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. 계정 탈퇴 RPC
-- 사용자의 데이터를 삭제한 뒤 auth.users에서 본인을 제거한다.
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM scraps    WHERE user_id = auth.uid();
  DELETE FROM tag_pools WHERE user_id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
