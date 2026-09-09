-- BDOS · 003 content
-- High-volume watch events do NOT live here (they go to Scylla + ClickHouse
-- per docs/03). Postgres holds the durable object graph and rollups only.

CREATE TYPE content.post_kind      AS ENUM ('video','photo_carousel');
CREATE TYPE content.publish_state  AS ENUM ('uploading','transcoding','moderating','published','rejected','removed');
CREATE TYPE content.audition_state AS ENUM ('pending','running','complete','skipped');

CREATE TABLE content.post (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    uuid NOT NULL REFERENCES identity.user_account(id),
  kind         content.post_kind NOT NULL DEFAULT 'video',
  caption      text CHECK (length(caption) <= 2200),
  -- Bangla, English, or Banglish. Drives which moderation models run.
  caption_lang text CHECK (caption_lang IN ('bn','en','bn_latin')),
  duration_ms  int CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1000 AND 600000),
  state        content.publish_state NOT NULL DEFAULT 'uploading',
  -- Perceptual hash for near-duplicate detection and moderation lookup.
  phash        bytea,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_has_timestamp
    CHECK ((state = 'published') <= (published_at IS NOT NULL))
);
CREATE INDEX ON content.post (author_id, published_at DESC);
CREATE INDEX ON content.post (state) WHERE state <> 'published';
CREATE INDEX post_recent_idx ON content.post (published_at DESC) WHERE state = 'published';
CREATE TRIGGER t_touch BEFORE UPDATE ON content.post
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- The ABR ladder. 480p is the default rung on cellular (docs/03 §3).
CREATE TABLE content.post_variant (
  post_id     uuid NOT NULL REFERENCES content.post(id) ON DELETE CASCADE,
  height      smallint NOT NULL CHECK (height IN (240,360,480,720,1080)),
  codec       text NOT NULL CHECK (codec IN ('h264','av1')),
  bitrate_kbps int NOT NULL CHECK (bitrate_kbps > 0),
  bytes       bigint NOT NULL CHECK (bytes > 0),
  uri         text NOT NULL,
  is_default_cellular boolean NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, height, codec)
);
CREATE UNIQUE INDEX one_cellular_default_per_post
  ON content.post_variant (post_id) WHERE is_default_cellular;

-- Sounds are joinable formats, not metadata (docs/01 §2).
CREATE TABLE content.sound (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  artist       text,
  -- No sound is usable until its licence is recorded. docs/05 §4: the sounds
  -- library is a legal project before it is a feature.
  licence_ref  text,
  is_licensed  boolean NOT NULL DEFAULT false,
  duration_ms  int NOT NULL CHECK (duration_ms > 0),
  use_count    bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT licensed_needs_ref CHECK (is_licensed = (licence_ref IS NOT NULL))
);

CREATE TABLE content.post_sound (
  post_id  uuid PRIMARY KEY REFERENCES content.post(id) ON DELETE CASCADE,
  sound_id uuid NOT NULL REFERENCES content.sound(id),
  start_ms int NOT NULL DEFAULT 0 CHECK (start_ms >= 0)
);

-- Duet / Stitch: consumption becomes production.
CREATE TYPE content.derivation AS ENUM ('duet','stitch','template');
CREATE TABLE content.post_derivation (
  child_id  uuid PRIMARY KEY REFERENCES content.post(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES content.post(id),
  kind      content.derivation NOT NULL,
  CONSTRAINT no_self_derivation CHECK (child_id <> parent_id)
);

CREATE TABLE content.follow (
  follower_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> followee_id)
);
CREATE INDEX ON content.follow (followee_id);

-- Rollup used by ranking. Written by the stream processor, not by the app.
CREATE TABLE content.post_stats (
  post_id        uuid PRIMARY KEY REFERENCES content.post(id) ON DELETE CASCADE,
  impressions    bigint NOT NULL DEFAULT 0,
  plays          bigint NOT NULL DEFAULT 0,
  completions    bigint NOT NULL DEFAULT 0,
  likes          bigint NOT NULL DEFAULT 0,
  comments       bigint NOT NULL DEFAULT 0,
  shares         bigint NOT NULL DEFAULT 0,
  follows_gained bigint NOT NULL DEFAULT 0,
  product_clicks bigint NOT NULL DEFAULT 0,
  purchases      bigint NOT NULL DEFAULT 0,
  reports        bigint NOT NULL DEFAULT 0,
  watch_ms_total bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The cold-start contract: every post gets a guaranteed audience sample.
CREATE TABLE content.audition (
  post_id            uuid PRIMARY KEY REFERENCES content.post(id) ON DELETE CASCADE,
  state              content.audition_state NOT NULL DEFAULT 'pending',
  guaranteed_impressions int NOT NULL DEFAULT 500 CHECK (guaranteed_impressions > 0),
  served_impressions int NOT NULL DEFAULT 0 CHECK (served_impressions >= 0),
  started_at         timestamptz,
  completed_at       timestamptz
);
