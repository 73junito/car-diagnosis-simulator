const {eligibility}=require('../scripts/audit-live-cloudflare-previews');
const now=new Date('2026-10-16T20:00:00Z');
const row={review:'reviewable_merged_live',identity:'verified',live_status:'present_by_name_lookup',pr:42};
const pr=(date)=>[{number:42,state:'closed',merged_at:date}];
test('29 days remains retained',()=>expect(eligibility(row,pr('2026-09-17T20:00:00Z'),now).eligibility).toBe('retained'));
test('exactly 30 days enters review, not deletion',()=>expect(eligibility(row,pr('2026-09-16T20:00:00Z'),now).eligibility).toBe('review_required'));
test('active or unknown identity protected',()=>expect(eligibility({...row,identity:'unverified'},pr('2026-08-01T00:00:00Z'),now).eligibility).toBe('protected'));
test('future merge date protected',()=>expect(eligibility(row,pr('2026-10-17T20:00:00Z'),now).eligibility).toBe('protected'));
test('missing PR protected',()=>expect(eligibility(row,[],now).eligibility).toBe('protected'));
