-- New expenses must use their parent budget's currency. The neutral compatibility
-- fields preserve the additive migration history without exposing conversion in
-- the product model.
CREATE TRIGGER expenses_budget_currency_insert
BEFORE INSERT ON expenses
FOR EACH ROW
WHEN NEW.currency <> (
  SELECT reporting_currency FROM budgets WHERE id = NEW.budget_id
) OR NEW.exchange_rate_micros <> 1000000
   OR NEW.amount_minor <> NEW.converted_amount_minor
BEGIN
  SELECT RAISE(ABORT, 'expense must use its budget currency');
END;

CREATE TRIGGER expenses_budget_currency_update
BEFORE UPDATE OF amount_minor, currency, exchange_rate_micros, converted_amount_minor, budget_id
ON expenses
FOR EACH ROW
WHEN NEW.currency <> (
  SELECT reporting_currency FROM budgets WHERE id = NEW.budget_id
) OR NEW.exchange_rate_micros <> 1000000
   OR NEW.amount_minor <> NEW.converted_amount_minor
BEGIN
  SELECT RAISE(ABORT, 'expense must use its budget currency');
END;
