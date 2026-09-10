function getProjectWarnings(project) {
  const warnings = []

  const plannedProgress = project.plannedProgress ?? 0
  const actualProgress = project.progress ?? 0

  const progressVariance = actualProgress - plannedProgress

  if (progressVariance <= -15) {
    warnings.push({
      type: "critical",
      message: "Project is significantly behind planned progress."
    })
  } else if (progressVariance <= -5) {
    warnings.push({
      type: "warning",
      message: "Project is behind planned progress."
    })
  }

  const today = new Date()

  const overdueMilestones = (project.milestones || []).filter(
    (milestone) =>
      milestone.status !== "Completed" &&
      new Date(milestone.dueDate) < today
  )

  if (overdueMilestones.length > 0) {
    warnings.push({
      type: "critical",
      message: `${overdueMilestones.length} milestone(s) are overdue.`
    })
  }

  return warnings
}

export default getProjectWarnings;