function getOverdueMilestones(project) {
  const today = new Date()

  return (project.milestones || []).filter((milestone) => {
    return (
      milestone.status !== "Completed" &&
      new Date(milestone.dueDate) < today
    )
  })
}


function calculateRiskScore(project) {
  const progress = Number(project.progress) || 0
  const plannedProgress = Number(project.plannedProgress) || 0
  const budget = Number(project.budget) || 0
  const budgetUsed = Number(project.budgetUsed) || 0

  const progressVariance = progress - plannedProgress

  let score = 0

  if (progressVariance <= -15) {
    score += 40
  } else if (progressVariance <= -5) {
    score += 25
  }

  if (budget > 0) {
    const budgetUtilization = (budgetUsed / budget) * 100

    if (budgetUtilization >= 90) {
      score += 35
    } else if (budgetUtilization >= 75) {
      score += 25
    }

    if (budgetUtilization - progress >= 20) {
      score += 20
    }
  }

  const overdueMilestones = getOverdueMilestones(project)

  if (overdueMilestones.length >= 2) {
    score += 25
  } else if (overdueMilestones.length === 1) {
    score += 15
  }

  if (project.status === "Delayed") {
    score += 20
  } else if (project.status === "At Risk") {
    score += 10
  }

  return Math.min(score, 100)
}


function calculateRisk(project) {
  const score = calculateRiskScore(project)

  if (score >= 60) {
    return "High"
  }

  if (score >= 30) {
    return "Medium"
  }

  return "Low"
}


function getRiskSignals(project) {
  const signals = []

  const progress = Number(project.progress) || 0
  const plannedProgress = Number(project.plannedProgress) || 0
  const budget = Number(project.budget) || 0
  const budgetUsed = Number(project.budgetUsed) || 0

  const progressVariance = progress - plannedProgress

  if (progressVariance <= -15) {
    signals.push(
      "Project is significantly behind planned progress."
    )
  } else if (progressVariance <= -5) {
    signals.push(
      "Project is behind planned progress."
    )
  }

  if (budget > 0) {
    const budgetUtilization = (budgetUsed / budget) * 100

    if (budgetUtilization >= 90) {
      signals.push(
        "90% or more of the project budget has been used."
      )
    } else if (budgetUtilization >= 75) {
      signals.push(
        "More than 75% of the project budget has been used."
      )
    }

    if (budgetUtilization - progress >= 20) {
      signals.push(
        "Budget usage is significantly higher than project progress."
      )
    }
  }

  const overdueMilestones = getOverdueMilestones(project)

  if (overdueMilestones.length > 0) {
    signals.push(
      `${overdueMilestones.length} milestone(s) are overdue.`
    )
  }

  if (project.status === "Delayed") {
    signals.push(
      "Project status is marked as Delayed."
    )
  } else if (project.status === "At Risk") {
    signals.push(
      "Project status is marked as At Risk."
    )
  }

  return signals
}


export {
  calculateRisk,
  calculateRiskScore,
  getRiskSignals
}