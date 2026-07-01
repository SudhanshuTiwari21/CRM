UPDATE "AgencySettings"
SET "email" = 'Sales@techrecoil.in'
WHERE "id" = 'default'
  AND ("email" IS NULL OR "email" = 'techrecoil@yahoo.in');
