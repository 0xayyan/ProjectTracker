function getScheduleForecast(project) {
  const startDate = new Date(project.startDate)
  const endDate = new Date(project.endDate)
  const today = new Date()

  const progress = Number(project.progress) || 0
  const plannedProgress = Number(project.plannedProgress) || 0

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return {
      status: "Unknown",
      message: "Project dates are not available.",
      expectedProgress: null
    }
  }

  const totalDuration =
    endDate.getTime() - startDate.getTime()

  const elapsedDuration =
    today.getTime() - startDate.getTime()

  let timeProgress =
    (elapsedDuration / totalDuration) * 100

  timeProgress = Math.max(
    0,
    Math.min(100, timeProgress)
  )

  const scheduleGap = progress - timeProgress
  const planGap = progress - plannedProgress

  if (today > endDate && progress < 100) {
    return {
      status: "Likely Delayed",
      message: "The planned end date has passed but the project is not complete.",
      expectedProgress: 100
    }
  }

  if (planGap <= -15 && scheduleGap <= -15) {
    return {
      status: "High Delay Risk",
      message: "Actual progress is significantly behind both the planned progress and elapsed project time.",
      expectedProgress: Number(timeProgress.toFixed(1))
    }
  }

  if (planGap <= -5 || scheduleGap <= -5) {
    return {
      status: "At Risk",
      message: "Actual progress is behind the expected project schedule.",
      expectedProgress: Number(timeProgress.toFixed(1))
    }
  }

  return {
    status: "On Track",
    message: "Actual progress is consistent with the expected schedule.",
    expectedProgress: Number(timeProgress.toFixed(1))
  }
}

export default getScheduleForecast;