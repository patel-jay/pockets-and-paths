# Product decisions

## Monthly life and temporary journeys are peers

A trip does not pause rent, groceries, or subscriptions. The model therefore lets monthly and temporary budgets run concurrently. The dashboard shows what remains by currency, while every expense still belongs to one clear plan.

Monthly budgets recur by calendar month. The expense date chooses the month, and the first expense
in a month snapshots that period’s overall amount and category limits. Later template changes can
shape the current and future periods without rewriting historical months.

## One currency belongs to a budget

A traveler can keep a monthly plan in INR while planning Japan in JPY. Every expense within a budget uses that budget’s currency, which removes hidden rate assumptions from entry, progress, and overspending. The profile currency is only a default for new budgets, and the dashboard keeps unlike currencies separate.

## Temporary is broader than travel

The temporary budget supports dates rather than a travel-specific itinerary. It can represent a wedding, home move, conference, renovation, or holiday without adding separate product concepts.

## Public demo beside invite-only personal identity

The public demo keeps a visible dummy login but creates a private browser-scoped profile instead of sharing one mutable account across visitors. Logout preserves the sandbox for a later login on the same browser; reset restores the examples. A separate invite-only registration path gives the owner durable data across devices without inviting arbitrary public accounts. Turnstile and request throttling reduce automated abuse, while the private invite code keeps registration intentionally closed.

Personal registration starts with an empty profile. Demo data is never copied into an account, and personal sessions cannot call the demo-reset operation. Email verification, recovery, and multi-factor authentication remain explicit follow-up work rather than being implied by the MVP.

Registration also has an explicit deployment switch. It can be opened long enough for the owner to
create an account and then closed without disabling normal sign-in.

## Category limits are optional

Categories organize every expense, but not everyone wants to pre-allocate every part of a budget. A category without a limit shows its spend without a misleading percentage. Limits can total less or more than the overall budget; the interface shows unallocated or overallocated amounts and lets the user decide.

## Overspending is recorded, not rejected

A budget cannot prevent a payment that happened in the real world. The app previews the effect, warns when the expense will exceed a category or the overall budget, and still allows confirmation. Progress can exceed 100%, with the overage shown as both money and percentage.

## Ended and archived mean different things

A fixed-date budget becomes ended automatically after its end date, but it stays visible and editable so the user can review or extend it. Archiving is a manual, reversible action that removes a plan from current views and makes its history read-only until restored.

## What is intentionally postponed

- Cross-currency expenses: correctness requires explicit conversion timing, rate sources, edits, and disclosure.
- Bank sync: high integration and security cost for little value in validating the core model.
- Sharing: roles and permissions deserve their own design rather than a superficial toggle.
- Full offline writes: a durable queue needs conflict rules and clear synchronization feedback.
