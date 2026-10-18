'use strict';
const data=require('../data/curriculum/aut250-literature-evidence.json');
const {verify}=require('../scripts/verify-aut250-literature-evidence');
const copy=()=>JSON.parse(JSON.stringify(data));
test('AUT-250 reference-only registry validates',()=>expect(verify(copy())).toEqual({valid:true,errors:[],count:8}));
test('no references authorize ingestion, figures or grading',()=>{for(const s of data.sources){expect(s.content_ingestion_allowed).toBe(false);expect(s.rag_allowed).toBe(false);expect(s.figure_reuse_allowed).toBe(false);expect(s.assessment_authority).toBe(false)}});
test('rejects duplicate IDs and unauthorized reuse',()=>{const x=copy();x.sources[1].source_id=x.sources[0].source_id;x.sources[2].rag_allowed=true;expect(verify(x).valid).toBe(false)});
test('rejects unreviewed claims of license or technical approval',()=>{const x=copy();x.sources[0].license_review='approved';x.sources[1].technical_review='approved';expect(verify(x).valid).toBe(false)});
test('uploaded Lime Book is historical and has no public download URL',()=>{const x=data.sources.find(s=>s.source_id==='lime-book');expect(x.canonical_url).toBeNull();expect(x.units).toEqual(['historical-engine-identification'])});
