import { calculateRiskScore } from './risk'
import getScheduleForecast from './forecast'
import getProjectWarnings from './warning'


function getProjectHealth(project) {
  const riskScore = calculateRiskScore(project)

  const scheduleForecast = getScheduleForecast(project)

  const warnings = getProjectWarnings(project)

  const hasCriticalForecast =
    scheduleForecast.status === "Likely Delayed" ||
    scheduleForecast.status === "High Delay Risk"

  const hasScheduleWarning =
    scheduleForecast.status === "At Risk"

  if (riskScore >= 60 || hasCriticalForecast) {
    return {
      status: "Critical",
      message: "Project requires immediate attention.",
      riskScore,
      warningCount: warnings.length,
      forecastStatus: scheduleForecast.status
    }
  }

  if (riskScore >= 30 || hasScheduleWarning) {
    return {
      status: "Needs Attention",
      message: "Project shows signs of potential delay or cost pressure.",
      riskScore,
      warningCount: warnings.length,
      forecastStatus: scheduleForecast.status
    }
  }

  return {
    status: "Healthy",
    message: "Project is currently progressing within acceptable limits.",
    riskScore,
    warningCount: warnings.length,
    forecastStatus: scheduleForecast.status
  }
}


export default getProjectHealth;