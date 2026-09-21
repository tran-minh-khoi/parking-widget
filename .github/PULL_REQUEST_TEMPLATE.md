## What changed

## How I checked it

- [ ] `npm test` passes
- [ ] Rules changed → tests added for the allowed and the denied case
- [ ] New text exists in both `vi.json` and `en.json`
- [ ] Uses shared components and `lib/feedback.tsx` (no `Alert`, no one-off toast)
- [ ] Anything new stored on the server has a retention rule and is cleaned up in `deleteAccount`
- [ ] No secrets or per-project files committed

Screenshots for UI changes:
