-- Migration: 012_seed_named_requestors
-- Seed hardcoded named access requestors.
-- Passwords are bcrypt-hashed (cost 12). Plaintext passwords distributed out-of-band.
-- To add more users in future: add a row here and run `npm run migrate`.

INSERT INTO users (username, password, role, name) VALUES
  ('noamziv008@gmail.com',                '$2a$12$ensVmhDoPcW8JGsp0zZsFeQfZTPzp7ejitiySyQUWX5CZvsA0HpD6', 'access_requestor', 'נועם לוי'),
  ('gabby.s27@gmail.com',                 '$2a$12$V.WH.JGyog8fdj38GqCJWejgV1cg4VyPriWh4t/VYh7mfaYXZUwLa', 'access_requestor', 'גבי סלמה'),
  ('alradaev0@gmail.com',                 '$2a$12$sGHzS2GzlOcBzZpCTP0sCOlgcpxifnBYn0oPsxoBQiavkTJFRuNAy', 'access_requestor', 'אלכסיי רדייב'),
  ('eyalshilon@gmail.com',                '$2a$12$Suow92cI0RodvzJqKzCQCOz/wni6sr0EjX/f2UNBenOKJm.Gnc49q', 'access_requestor', 'אייל שילון'),
  ('ariklidermanisr@gmail.com',           '$2a$12$pK1HCFV/Ei13RXypNPE7iuoXIdEm90wG1rsAVICTe9b6xaSAF8gCa', 'access_requestor', 'אריק לידרמן'),
  ('abc770yes@gmail.com',                 '$2a$12$PnypafoymZ591iaJl8Falu1WdyjV/Hc0GffjScpLrb9QiqQeiRgRi', 'access_requestor', 'איתמר בן חורין'),
  ('danahodorow@gmail.com',               '$2a$12$JFyBguhYYe20Wz0r.e0GEO2C4y4qQfFOqtcoQ99WLte.vO3CYmram', 'access_requestor', 'דנה חודורובסקי'),
  ('mirel1792@gmail.com',                 '$2a$12$EJSNMrkmhXqQnBFRdu15DuT5zv07U567aJk/cRQAD.KwHopi2eN6C', 'access_requestor', 'מיראל ספקטורמן'),
  ('beni.shabsai@gmail.com',              '$2a$12$qu6Z7kXOf/.GRVvjbHMOFO.Hq3M.NUQA4rbbXB9z16SWNfybqtWH2', 'access_requestor', 'בני שבסאי'),
  ('noa18094727@gmail.com',               '$2a$12$umK5VsHKbuICeqi5pqXZveI4nh0INSwF2H3iNDPFQDI01FxTL0lYS', 'access_requestor', 'נועה נרקיס'),
  ('no1rotem@gmail.com',                  '$2a$12$rmOzl5osOIiJr80RbZwo0OY7Lsuhc9JiFqwUoU5QApkAlpE.ts8Z.', 'access_requestor', 'רותם בר'),
  ('sarihilik@gmail.com',                 '$2a$12$Gizw6C1LQCowt/v/dEZpx.hF6Lgmz4uxbz3zkRBtmW9h6M0nGPIti', 'access_requestor', 'עומרי חוס'),
  ('ayahajbi1@gmail.com',                 '$2a$12$Lt71/f1PvYVCYjskblAgeOUiPbdNrrP0H.ODt6W3ZVrbHruvBOPUC', 'access_requestor', 'איילה חג׳בי'),
  ('alexander.greenberg@vis-services.com','$2a$12$.ELGtIZUCKGvcINKZd5OTeeE6YSNTRgg5GJQV2lSphx/MX/XAOt1W', 'access_requestor', 'אלכסנדר גרינברג'),
  ('0208emerald@gmail.com',               '$2a$12$EkzexA2/MQgl0Lbc8V0Na.mVHY795ZXDAHoFACHzP59bJnbjdbgRq', 'access_requestor', 'אמרלד בן דוד'),
  ('xattar10@gmail.com',                  '$2a$12$C9eeh3yR7klSwdvhN.0Vxu9TNhj5sG56krEYXLD/lskgLX4EeB5y6', 'access_requestor', 'סמדר עטר חיים'),
  ('nir151290@gmail.com',                 '$2a$12$Bs00FZOV80e9IzsQ2/ESF.o4wPQ3SxneeslTC9UZiAYq43Q3RaqUW', 'access_requestor', 'ניר סולומון'),
  ('shlomi@cirotta.com',                  '$2a$12$/Dcwn72z2NSVZYt5AaNlMO9QcIhEtDaoqZxeMyQssjZa41nSOoWd6', 'access_requestor', 'שלומי ארז'),
  ('osherhafuta21@gmail.com',             '$2a$12$3L7MeRYwyqA4jL1bO82Tzu8NH1iF/Yp0SdSwWDm1wzWS1zTe4l8g6', 'access_requestor', 'אושר חפוטה'),
  ('roee0809@gmail.com',                  '$2a$12$JNV2PLqsrZqtb202bpWI3./qXsMARyeInUyBNoy975vZAvM8niioG', 'access_requestor', 'רועי לוי'),
  ('yuval969605@gmail.com',               '$2a$12$0uqbrmCe9aBXSY1IUb3FrOOQ9L3PZTmvDLIoeIc6mMzl9.zgkhOp.', 'access_requestor', 'יובל סויסה'),
  ('yaar.edry@gmail.com',                 '$2a$12$b/KYZJ0BBGZKMcOnYY8P6uLmobnDzltv8tWb45ZsVci0NJMu9gCiu', 'access_requestor', 'ירון אדרי')
ON CONFLICT (username) DO NOTHING;
