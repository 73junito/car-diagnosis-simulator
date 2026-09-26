/**
 * Hono route: GET /api/curriculum
 *
 * Server-side read API for the relational curriculum layer created in
 * supabase/migrations/*_add_curriculum_schema.sql.
 *
 * Contract:
 * - The response mirrors the static data/curriculum/* JSON contract exactly
 *   ({ schemaVersion, pathways, courses, competencies, lessonPlans,
 *   scenarioMappings }) so consumers validated against the static source can
 *   swap to this endpoint without shape changes.
 * - Read-only: explicit column lists only (never all columns), no writes.
 * - Fail-closed: missing configuration, query errors, or broken referential
 *   data return 500 instead of a partial payload.
 * - Security: all curriculum tables are service_role-only in the database;
 *   this handler is the single read boundary. No browser-facing RLS policy is
 *   required or created. Lesson evidence (curriculum_lesson_evidence) is not
 *   exposed: it stays fail-closed behind approved_sources/source_chunks.
 *
 * The data returned (pathways, CIP codes, courses, competencies) is reference
 * data already published as static JSON on the public site, so the endpoint
 * does not require authentication; CORS is restricted to the app origin.
 */
import { createClient } from '@supabase/supabase-js'

export const CURRICULUM_SCHEMA_VERSION = '1.0.0'

const SELECTS = {
  pathways: 'id, academic_level, status',
  programs: 'id, pathway_id, academic_level, cip_code, program_name, cip_title, status',
  courses: 'id, program_id, academic_level, cip_code, title, status',
  competencies: 'id, course_id, academic_level, statement, status',
  lessonPlans: 'id, course_id, competency_id, academic_level, title, status',
  lessonSteps: 'lesson_plan_id, position, step_text',
  scenarioMappings: 'scenario_id, lesson_plan_id, competency_id, course_id, academic_level, cip_code, status'
}

async function selectRows(supabase, table, columns, orderColumn) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending: true })

  if (error) {
    throw new Error(`curriculum query failed for ${table}: ${error.message || 'unknown error'}`)
  }

  return data || []
}

export async function handleCurriculumRead(c) {
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = c.env.SUPABASE_URL
    const supabaseServiceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables')
      return c.json({ error: 'Server configuration incomplete' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)


    const [
      pathways,
      programs,
      courses,
      competencies,
      lessonPlans,
      lessonSteps,
      scenarioMappings
    ] = await Promise.all([
      selectRows(supabase, 'curriculum_pathways', SELECTS.pathways, 'id'),
      selectRows(supabase, 'curriculum_programs', SELECTS.programs, 'id'),
      selectRows(supabase, 'curriculum_courses', SELECTS.courses, 'id'),
      selectRows(supabase, 'curriculum_competencies', SELECTS.competencies, 'id'),
      selectRows(supabase, 'curriculum_lesson_plans', SELECTS.lessonPlans, 'id'),
      selectRows(supabase, 'curriculum_lesson_steps', SELECTS.lessonSteps, 'position'),
      selectRows(supabase, 'scenario_curriculum_mappings', SELECTS.scenarioMappings, 'scenario_id')
    ])

    // A pathway without its program row cannot satisfy the static contract;
    // fail closed rather than emit a partial payload.
    const programByPathway = new Map(
      programs.map((program) => [`${program.pathway_id}::${program.academic_level}`, program])
    )

    const payloadPathways = pathways.map((pathway) => {
      const program = programByPathway.get(`${pathway.id}::${pathway.academic_level}`)
      if (!program) {
        throw new Error(`curriculum_programs row missing for pathway ${pathway.id}`)
      }
      return {
        id: pathway.id,
        academicLevel: pathway.academic_level,
        programId: program.id,
        cipCode: program.cip_code,
        programName: program.program_name,
        cipTitle: program.cip_title,
        status: pathway.status
      }
    })

    const payloadCourses = courses.map((course) => ({
      id: course.id,
      academicLevel: course.academic_level,
      cipCode: course.cip_code,
      title: course.title,
      status: course.status
    }))

    const payloadCompetencies = competencies.map((competency) => ({
      id: competency.id,
      academicLevel: competency.academic_level,
      courseId: competency.course_id,
      statement: competency.statement,
      status: competency.status
    }))

    const stepsByLesson = new Map()
    for (const step of lessonSteps) {
      const existing = stepsByLesson.get(step.lesson_plan_id) || []
      existing.push(step)
      stepsByLesson.set(step.lesson_plan_id, existing)
    }

    const payloadLessonPlans = lessonPlans.map((lessonPlan) => {
      const orderedSteps = (stepsByLesson.get(lessonPlan.id) || [])
        .slice()
        .sort((a, b) => a.position - b.position)
      return {
        id: lessonPlan.id,
        academicLevel: lessonPlan.academic_level,
        courseId: lessonPlan.course_id,
        competencyId: lessonPlan.competency_id,
        title: lessonPlan.title,
        sequence: orderedSteps.map((step) => step.step_text),
        status: lessonPlan.status
      }
    })

    const payloadScenarioMappings = scenarioMappings.map((mapping) => ({
      scenarioId: mapping.scenario_id,
      academicLevel: mapping.academic_level,
      cipCode: mapping.cip_code,
      courseId: mapping.course_id,
      competencyId: mapping.competency_id,
      lessonPlanId: mapping.lesson_plan_id,
      status: mapping.status
    }))

    return c.json(
      {
        schemaVersion: CURRICULUM_SCHEMA_VERSION,
        pathways: payloadPathways,
        courses: payloadCourses,
        competencies: payloadCompetencies,
        lessonPlans: payloadLessonPlans,
        scenarioMappings: payloadScenarioMappings
      },
      200
    )
  } catch (err) {
    console.error('Curriculum read failed:', err)
    return c.json({ error: 'Server error' }, 500)
  }
}
