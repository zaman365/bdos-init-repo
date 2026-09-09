-- BDOS · 009 trust and safety
-- Moderation is a core platform system with its own data model, not a queue
-- bolted onto support (docs/01 §5).

CREATE TYPE trust.case_state AS ENUM ('open','auto_actioned','human_review','actioned','dismissed','appealed','overturned');
CREATE TYPE trust.severity AS ENUM ('low','medium','high','critical');
CREATE TYPE trust.action_kind AS ENUM (
  'none','age_restrict','reduce_reach','remove_content','warn',
  'mute_comments','block_live','suspend_account','escalate_legal'
);
-- Categories tuned to what actually happens here. 'communal_religious' routes
-- to the safety protocol, not the normal queue: accusations in this category
-- have escalated to physical violence (docs/05 §4).
CREATE TYPE trust.category AS ENUM (
  'spam','nudity','graphic_violence','harassment','hate_speech',
  'communal_religious','self_harm','minor_safety','counterfeit',
  'misinformation','fraud','copyright'
);

CREATE TABLE trust.report (
  id          bigserial PRIMARY KEY,
  reporter_id uuid REFERENCES identity.user_account(id),
  post_id     uuid REFERENCES content.post(id),
  subject_id  uuid REFERENCES identity.user_account(id),
  category    trust.category NOT NULL,
  note        text CHECK (length(note) <= 1000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_has_a_target
    CHECK (post_id IS NOT NULL OR subject_id IS NOT NULL)
);
CREATE INDEX ON trust.report (post_id);
CREATE INDEX ON trust.report (category, created_at DESC);

CREATE TABLE trust.moderation_case (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES content.post(id),
  subject_id uuid REFERENCES identity.user_account(id),
  category   trust.category NOT NULL,
  severity   trust.severity NOT NULL,
  state      trust.case_state NOT NULL DEFAULT 'open',
  -- Model confidence; high-reach content goes to a human regardless.
  model_score numeric(4,3) CHECK (model_score BETWEEN 0 AND 1),
  detected_lang text CHECK (detected_lang IN ('bn','en','bn_latin','syl','ctg')),
  reach_at_detection bigint NOT NULL DEFAULT 0,
  requires_human boolean NOT NULL DEFAULT false,
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz
);
CREATE INDEX ON trust.moderation_case (state, severity, opened_at);
CREATE INDEX ON trust.moderation_case (requires_human) WHERE requires_human;

CREATE TABLE trust.moderation_action (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES trust.moderation_case(id) ON DELETE CASCADE,
  kind       trust.action_kind NOT NULL,
  -- Every action gets a plain-Bangla reason shown to the user. Non-negotiable.
  reason_bn  text NOT NULL,
  reason_en  text NOT NULL,
  actor      text NOT NULL,   -- 'model:v3' or a moderator id
  acted_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON trust.moderation_action (case_id);

CREATE TABLE trust.appeal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL UNIQUE REFERENCES trust.moderation_case(id),
  -- Exactly one appeal per case, by design.
  submitted_by uuid NOT NULL REFERENCES identity.user_account(id),
  statement  text CHECK (length(statement) <= 1000),
  outcome    text CHECK (outcome IN ('upheld','overturned')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT decided_has_outcome CHECK ((outcome IS NOT NULL) = (decided_at IS NOT NULL))
);

-- Nirapod: the safety layer. Defaults here are deliberately protective.
CREATE TABLE trust.nirapod_setting (
  user_id            uuid PRIMARY KEY REFERENCES identity.user_account(id) ON DELETE CASCADE,
  dm_from            text NOT NULL DEFAULT 'nobody' CHECK (dm_from IN ('nobody','following','everyone')),
  comment_filter     text NOT NULL DEFAULT 'strict' CHECK (comment_filter IN ('off','standard','strict')),
  allow_duet         boolean NOT NULL DEFAULT false,
  allow_stitch       boolean NOT NULL DEFAULT false,
  hide_from_search   boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Brigading detection: many accounts converging on one target quickly.
CREATE TABLE trust.harassment_cluster (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   uuid NOT NULL REFERENCES identity.user_account(id),
  actor_count int NOT NULL CHECK (actor_count > 1),
  window_start timestamptz NOT NULL,
  window_end   timestamptz NOT NULL,
  severity    trust.severity NOT NULL,
  escalated_at timestamptz,
  CONSTRAINT sane_window CHECK (window_end > window_start)
);
CREATE INDEX ON trust.harassment_cluster (target_id, window_end DESC);
