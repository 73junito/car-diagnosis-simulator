# DigiKey + Mouser source discovery

The engineering register uses **DigiKey** and **Mouser** as optional discovery sources. Neither is an engineering approval authority. The original manufacturer's current, revision-matched datasheet or drawing, with human verification, is required before dimensional, terminal, electrical or publication signoff.

- DigiKey product discovery and API documentation: https://developer.digikey.com/
- Mouser Search API documentation: https://www.mouser.com/api-search/

## Offline, credential-free workflow
Create a JSON array of records containing `manufacturer`, `partNumber`, `provider` (`digikey` or `mouser`), `listingUrl` and optionally `datasheetUrl`. Then run:
```sh
node scripts/distributor-source-discovery.js records.json
```
The tool validates exact part-number syntax, requires HTTPS and a correctly matching distributor host, and emits explicitly **unverified** provenance records. It does not scrape websites, generate search URLs, make network calls, use credentials, ingest copyrighted text, or update any simulation/asset approval.

## Next integration step
DigiKey and Mouser have separately authenticated APIs; obtaining the user's account-specific credentials, usage permission, and the applicable access terms is required before building live API connectors. Do not assume listings, availability, dimensions, manufacturer suffixes, or CAD models can be guessed from a distributor URL. Preserve the full suffix and manufacturer identity. Differences must block automated matching.

**Publishing**: no record generated here satisfies either technical geometry gate or engineering/assessment authority.
