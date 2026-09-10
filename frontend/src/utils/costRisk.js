function calculateBudgetUtilization(project) {
  const budget = Number(project.budget) || 0
  const budgetUsed = Number(project.budgetUsed) || 0

  if (budget <= 0) {
    return 0
  }

  return (budgetUsed / budget) * 100
}


function getCostWarning(project) {
  const budgetUtilization = calculateBudgetUtilization(project)
  const progress = Number(project.progress) || 0

  if (budgetUtilization >= 90) {
    return {
      type: "critical",
      message: "90% or more of the project budget has been used."
    }
  }

  if (budgetUtilization - progress >= 20) {
    return {
      type: "warning",
      message: "Budget usage is significantly higher than project progress."
    }
  }

  return null
}


export {
  calculateBudgetUtilization,
  getCostWarning
}