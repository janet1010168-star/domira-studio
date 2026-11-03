# Configurator release — owner approved

Base: GitHub v2.0 47106fa. The owner approved the light-theme preview for publication. Push to v2.0 triggers production; completion requires successful CI and verification of both Workers and every published asset.

## Fixed
- Furniture library startup was aborted by generic `.chip` handlers that expected every button to contain a span. The new fit-mode buttons have none. Restrict preference handlers and syncing to `[data-pref]`; retain fit-mode handlers.
- Show all 62 branded/concept products by default; All clears search/brand filters. Add missing wardrobe category/material metadata.
- Render first view follows the actual workbench camera. Snapshot preserves measured/floorplan geometry, coordinates, dimensions and orientation. Changed layouts cannot resume old batches. Stale stored renders are not silently opened as current designs.
- Exact 2560x1440 renders reuse the current Three.js scene; route/helper overlays are hidden only during capture and restored. The five-view ZIP contains design inventory, camera views and fingerprint. It is model rendering, not AI generation.
- Keep optional paid AI image editing, labelled ambience reference, with side-by-side comparison. It cannot guarantee pixel/geometric fidelity. No live AI image was purchased during local QA.

## Added
- Light-themed Tesla configurator-inspired stage/choice layout, understated borders, consistent material choices, responsive configuration panel. Reference https://www.tesla.com/model3/design?#overview ; no Tesla assets/branding reused.
- Readable mode: larger type, stronger contrast, minimum 46px controls, no UI transitions. Explicitly started route animation has pause, replay and skip controls.
- Local breadth-first path search on a 0.15m grid, inflated rotated furniture obstacles, conservative boundary clearance and furniture-front destination. 0.7/0.9/1.2m profiles are planning targets, not legal compliance claims.
- Use detected door position when available or explicitly labelled manual start. Reject detected doors narrower than requested route. Show actual visited cells, route creation and walking avatar, then explain actual length/turns/rug cautions. No invented path for blocked room/entrance/destination.
- Planning is limited to the active room. Whole-home mode switches to its active room before planning. Edit room/furniture/orientation to invalidate old routes. Turning circles, levels, door swing, wall irregularities and actual seat heights remain field verification items.
- Aging advice on rugs, seat/bed/armrest specifications, table corners, lighting and site conditions, with unknowns stated explicitly. General reference https://www.archsd.gov.hk/en/ua/index.html ; no claim of certified accessibility.

## Acceptance
1. Initial load has no app error, 62 cards. Search nonsense gives 0; All restores 62; wardrobe gives 3 named products, HKD estimate labels. Fit-mode toggle does not append undefined preferences or interrupt rendering.
2. Drag/rotate furniture, open render studio: first view follows current model; five exact images are 2560x1440. ZIP model inventory matches preview. Stale layout does not auto-resume saved images; new render keeps coordinates/rotation.
3. Start planning on a clear route: explored cells then route then avatar/explanation. Pause/resume, skip, replay work. Blocked layout shows no route. Wider profile rejects a too-small passage. Changing furniture clears previous planning.
4. Desktop/mobile/readable layouts remain usable; controls retain labels and keyboard focus. No route/avatar is baked into design renders.
5. Full Node test suite, Worker build/ESM validation, Cloudflare build and quote bundle checks must pass. After approval: fetch/reconcile concurrent GitHub changes, commit/push, wait CI, verify frontend and API same SHA and all asset hashes.

Owner requested light theme on review: white/soft-neutral surfaces, charcoal text, dark green actions, light dialog/library/quote/render panels, and theme-aware planning diagram. The owner subsequently confirmed publication of this light-theme version.
