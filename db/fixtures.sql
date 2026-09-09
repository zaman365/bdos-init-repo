-- Deterministic fixtures for tests and local development.
INSERT INTO identity.user_account (id, msisdn, handle, display_name, date_of_birth, state) VALUES
  ('11111111-1111-1111-1111-111111111111','+8801712345678','nusrat','Nusrat','1999-04-02','active'),
  ('22222222-2222-2222-2222-222222222222','+8801812345678','rifat','Rifat','2006-01-15','active'),
  ('33333333-3333-3333-3333-333333333333','+8801912345678','bograshop','Bogura Kurti','1988-07-07','active'),
  ('99999999-9999-9999-9999-999999999999','+8801612345678','tamim','Tamim','2012-05-20','active');

INSERT INTO identity.seller (id, owner_id, legal_name, trade_name, state, bharosha) VALUES
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333',
   'Bogura Kurti House','Bogura Kurti','active', 78.5);

INSERT INTO ledger.account (id, kind, owner_kind, owner_id) VALUES
  ('55555555-5555-5555-5555-555555555555','seller_payable','seller','44444444-4444-4444-4444-444444444444'),
  ('66666666-6666-6666-6666-666666666666','creator_payable','user','11111111-1111-1111-1111-111111111111');
