ALTER TABLE categories
ADD COLUMN limit_minor_optional INTEGER
CHECK (limit_minor_optional IS NULL OR limit_minor_optional > 0);

UPDATE categories
SET limit_minor_optional = NULLIF(limit_minor, 0);

