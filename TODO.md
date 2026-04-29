# TODO — Tekniska skulder att utvärdera

## Lint-undantag för react-hooks/set-state-in-effect

Fyra ställen i `app/page.tsx` och `app/simulator/components/ResultV2/ResultScrollFlow.tsx` använder `eslint-disable-next-line react-hooks/set-state-in-effect` för medvetna SSR/hydration-mönster (portal-mounting, hydration-bootstrap, loading-spinners).

Överväg att antingen:
- (a) Lägga ett scopat undantag i ESLint-konfigurationen för dessa filer/mönster
- (b) Refaktorera till `useSyncExternalStore` eller motsvarande modernt mönster

Beslut tas separat — inte akut. Disable-kommentarerna är dokumenterade med motiveringar i koden.
