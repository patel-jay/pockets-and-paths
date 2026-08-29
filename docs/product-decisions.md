# Product decisions

## Monthly life and temporary journeys are peers

A trip does not pause rent, groceries, or subscriptions. The model therefore lets monthly and temporary budgets run concurrently. The dashboard combines what remains, while every expense still belongs to one clear plan.

## Reporting currency belongs to a budget

A traveler may keep their profile in INR, plan Japan in JPY, and pay a booking deposit in EUR. The original payment is preserved, but progress is computed in the budget’s reporting currency. This makes each plan understandable on its own and still allows a profile-level summary.

## Temporary is broader than travel

The temporary budget supports dates rather than a travel-specific itinerary. It can represent a wedding, home move, conference, renovation, or holiday without adding separate product concepts.

## Isolated dummy login before real identity

The portfolio release has a visible dummy login but creates a private browser-scoped profile instead of sharing one mutable account across visitors. Logout preserves the sandbox for a later login on the same browser; reset restores the examples. This makes the core product immediately testable and avoids collecting personal data. A production service would replace it with a supported identity provider and explicit onboarding.

## Category limits are optional

Categories organize every expense, but not everyone wants to pre-allocate every part of a budget. A category without a limit shows its spend without a misleading percentage. Limits can total less or more than the overall budget; the interface shows unallocated or overallocated amounts and lets the user decide.

## Overspending is recorded, not rejected

A budget cannot prevent a payment that happened in the real world. The app previews the effect, warns when the expense will exceed a category or the overall budget, and still allows confirmation. Progress can exceed 100%, with the overage shown as both money and percentage.

## What is intentionally postponed

- Live rates: correctness requires a provider, timestamps, fallback behavior, and disclosure.
- Bank sync: high integration and security cost for little value in validating the core model.
- Sharing: roles and permissions deserve their own design rather than a superficial toggle.
- Full offline writes: a durable queue needs conflict rules and clear synchronization feedback.
