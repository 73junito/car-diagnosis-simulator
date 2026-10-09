const fs = require('fs');
const path = require('path');

describe('supplemental automotive authority batch 1', () => {
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20261009045500_add_supplemental_automotive_authority_batch_1.sql'
  );
  const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

  test('adds five narrowly scoped automotive-specific source records', () => {
    [
      'nhtsa-fmvss-135-light-vehicle-brake-systems',
      'nhtsa-fmvss-126-electronic-stability-control',
      'epa-mvac-section-609-servicing-2026',
      'epa-vehicle-emissions-im-obd-guidance-2026',
      'bccampus-diesel-drivetrain-systems-directory-record',
    ].forEach((id) => expect(migration).toContain(`'${id}'`));
  });

  test('keeps all newly added source records non-ingestible', () => {
    const sourceInsert = migration.split(
      'on conflict (id) do update set'
    )[0];
    expect(sourceInsert.match(/false, false, false,/g)).toHaveLength(5);
  });

  test('supplements seven high-priority undergraduate mappings', () => {
    [
      'ug-brakes-foundations',
      'ug-suspension-steering-foundations',
      'ug-aut170-hvac-systems',
      'ug-aut270-emissions-systems',
      'ug-aut160-drivetrain-systems',
      'ug-aut220-automatic-transmissions',
      'ug-aut320-hybrid-vehicle-technology',
    ].forEach((lessonId) => expect(migration).toContain(`'${lessonId}'`));
  });

  test('reuses the existing NHTSA EV safety source instead of duplicating it', () => {
    expect(migration).toContain(
      "'nhtsa-electric-hybrid-vehicle-safety-2026',\n  'ug-aut320-hybrid-vehicle-technology'"
    );
    const sourceInsert = migration.split(
      'on conflict (id) do update set'
    )[0];
    expect(sourceInsert).not.toContain(
      "'nhtsa-electric-hybrid-vehicle-safety-2026'"
    );
  });

  test('keeps mappings idempotent and does not grant assessment eligibility', () => {
    expect(migration).toContain(
      'on conflict (reference_id, lesson_plan_id, role) do update set'
    );
    expect(migration).not.toContain('assessment_eligible');
    expect(migration).not.toContain('approved_for_assessment');
  });
});
