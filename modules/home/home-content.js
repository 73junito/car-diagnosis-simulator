window.TorqueMindHome = Object.freeze({
  hero: {
    eyebrow: "Automotive Diagnostic Training",
    title: "Diagnose Real Faults. Train Real Technicians.",
    description:
      "Evidence-driven automotive diagnostic training for CTE programs, military maintenance teams, and technical instructors.",
    primaryAction: {
      label: "Start Student Training",
      href: "/dashboard/student/"
    },
    secondaryAction: {
      label: "Open Instructor Tools",
      href: "/dashboard/analytics"
    }
  },

  trainingModes: [
    {
      id: "student",
      title: "Student Training",
      description:
        "Practice structured diagnostic reasoning, collect evidence, and submit a final diagnosis.",
      href: "/dashboard/student/",
      action: "Browse Scenarios"
    },
    {
      id: "instructor",
      title: "Instructor Tools",
      description:
        "Review performance, identify ASE weaknesses, and manage classroom activities.",
      href: "/dashboard/analytics",
      action: "Open Instructor Tools"
    },
    {
      id: "author",
      title: "Scenario Authoring",
      description:
        "Create, validate, import, export, and organize diagnostic scenarios.",
      href: "/dashboard/author/",
      action: "Open Authoring Studio"
    }
  ],

  instructor: {
    title: "Built for technical education",
    description:
      "Track student progress, compare diagnostic decisions, and focus instruction on measurable skill gaps.",
    actions: [
      {
        label: "View Analytics",
        href: "/dashboard/analytics"
      },
      {
        label: "Start Live Session",
        href: "/dashboard/live-session"
      }
    ]
  }
});
