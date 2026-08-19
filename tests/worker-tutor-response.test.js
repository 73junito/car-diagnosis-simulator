import {
  buildPrompt,
  extractJson,
  validateTutorResponse,
  normalizeTutorResponse
} from "../worker/utils/tutor-response.js"

describe("TorqueMind tutor utilities", () => {
  test("buildPrompt includes request context and required schema", () => {
    const prompt = buildPrompt({
      scenario: "Engine cranks but will not start.",
      question: "What should be checked first?",
      studentAnswer: "Replace the starter.",
      topic: "Engine Performance"
    })

    expect(prompt).toContain("Engine cranks but will not start.")
    expect(prompt).toContain("What should be checked first?")
    expect(prompt).toContain("Replace the starter.")
    expect(prompt).toContain("Engine Performance")

    expect(prompt).toContain('"reasonIncorrect"')
    expect(prompt).toContain('"reasonCorrect"')
    expect(prompt).toContain('"aseConcept"')
    expect(prompt).toContain('"nextStep"')
  })

  test("extractJson parses plain JSON", () => {
    expect(
      extractJson(
        '{"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"}'
      )
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test("extractJson parses fenced JSON", () => {
    expect(
      extractJson(
        '```json\n{"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"}\n```'
      )
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test("extractJson parses JSON surrounded by prose", () => {
    expect(
      extractJson(
        'Here is the result: {"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"} End.'
      )
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test("extractJson rejects empty output", () => {
    expect(() => extractJson("")).toThrow("AI provider returned an empty response")
  })

  test("extractJson rejects output without JSON", () => {
    expect(() => extractJson("No JSON here")).toThrow(
      "AI provider did not return a JSON object"
    )
  })

  test("validateTutorResponse trims valid fields", () => {
    expect(
      validateTutorResponse({
        reasonIncorrect: " A ",
        reasonCorrect: " B ",
        aseConcept: " C ",
        nextStep: " D "
      })
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test("validateTutorResponse accepts common alias keys", () => {
    expect(
      validateTutorResponse({
        explanation: "A",
        reasoning: "B",
        ase_concept: "C",
        nextDiagnosticStep: "D"
      })
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test("validateTutorResponse accepts nested feedback payload", () => {
    expect(
      validateTutorResponse({
        feedback: {
          reasonIncorrect: "A",
          reasonCorrect: "B",
          aseConcept: "C",
          nextStep: "D"
        }
      })
    ).toEqual({
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    })
  })

  test.each([
    ["reasonIncorrect"],
    ["reasonCorrect"],
    ["aseConcept"],
    ["nextStep"]
  ])("validateTutorResponse rejects missing %s", (field) => {
    const value = {
      reasonIncorrect: "A",
      reasonCorrect: "B",
      aseConcept: "C",
      nextStep: "D"
    }

    delete value[field]

    expect(() => validateTutorResponse(value)).toThrow(
      `Tutor response is missing ${field}`
    )
  })

  test("validateTutorResponse rejects blank fields", () => {
    expect(() =>
      validateTutorResponse({
        reasonIncorrect: "",
        reasonCorrect: "B",
        aseConcept: "C",
        nextStep: "D"
      })
    ).toThrow("Tutor response is missing reasonIncorrect")
  })

  test("validateTutorResponse rejects non-string fields", () => {
    expect(() =>
      validateTutorResponse({
        reasonIncorrect: 42,
        reasonCorrect: "B",
        aseConcept: "C",
        nextStep: "D"
      })
    ).toThrow("Tutor response is missing reasonIncorrect")
  })

  test("normalizeTutorResponse returns fallback payload for malformed output", () => {
    const out = normalizeTutorResponse({}, "Model returned plain text without JSON")
    expect(out.reasonIncorrect).toContain("Model returned plain text")
    expect(out.reasonCorrect.length).toBeGreaterThan(0)
    expect(out.aseConcept.length).toBeGreaterThan(0)
    expect(out.nextStep.length).toBeGreaterThan(0)
  })
})
