-- Forward-only improvements: preserve deployed migration checksums and history.
ALTER TABLE commerce.product ADD COLUMN version integer NOT NULL DEFAULT 0;
ALTER TABLE commerce.sku ADD COLUMN version integer NOT NULL DEFAULT 0;
CREATE FUNCTION commerce.bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$;
CREATE TRIGGER product_version BEFORE UPDATE ON commerce.product FOR EACH ROW EXECUTE FUNCTION commerce.bump_version();
CREATE TRIGGER sku_version BEFORE UPDATE ON commerce.sku FOR EACH ROW EXECUTE FUNCTION commerce.bump_version();
CREATE INDEX post_published_cursor ON content.post(published_at DESC,id DESC) WHERE state='published';
CREATE INDEX comment_page ON content.comment(post_id,pinned DESC,created_at DESC);
CREATE INDEX message_sender_recipient ON app.message(sender_id,recipient_id);
CREATE INDEX message_recipient_sender ON app.message(recipient_id,sender_id);
CREATE INDEX report_reporter_post ON trust.report(reporter_id,post_id,category);
ALTER TABLE trust.report ADD COLUMN case_id uuid REFERENCES trust.moderation_case(id);
-- Partial uniqueness applies to new grouped reports; historical duplicate evidence is retained.
CREATE UNIQUE INDEX report_once_per_case ON trust.report(reporter_id,case_id) WHERE case_id IS NOT NULL;
CREATE INDEX report_case ON trust.report(case_id);
-- Preserve legacy selections; new application logic rejects selecting again.
-- Enforce the one-winner rule for all new/updated selections at the DB boundary.
CREATE FUNCTION app.single_brief_winner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state='selected' THEN
    PERFORM 1 FROM app.brief WHERE id=NEW.brief_id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM app.application WHERE brief_id=NEW.brief_id AND creator_id<>NEW.creator_id AND state='selected') THEN
      RAISE EXCEPTION 'This brief already has a selected creator';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER single_brief_winner BEFORE INSERT OR UPDATE ON app.application FOR EACH ROW EXECUTE FUNCTION app.single_brief_winner();
ALTER TABLE app.command ADD COLUMN action text;
