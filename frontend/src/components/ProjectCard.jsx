import { calculateRisk, calculateRiskScore } from '../utils/risk'
import getProjectWarnings from '../utils/warning'

function ProjectCard({
  name,
  department,
  progress,
  plannedProgress,
  budget,
  budgetUsed,
  status,
  milestones,
  startDate,
  endDate
}) {
  const riskProject = {
    progress,
    plannedProgress,
    budget,
    budgetUsed,
    status,
    milestones,
    startDate,
    endDate
  }

  const overallRisk = calculateRisk(riskProject)
  const riskScore = calculateRiskScore(riskProject)
  const warnings = getProjectWarnings({
    progress,
    plannedProgress,
    milestones
  })

  const progressValue = Math.max(0, Math.min(100, Number(progress) || 0))
  const variance = (Number(progress) || 0) - (Number(plannedProgress) || 0)
  const budgetValue = Number(budget) || 0
  const budgetUsedValue = Number(budgetUsed) || 0
  const budgetUtilization = budgetValue > 0
    ? (budgetUsedValue / budgetValue) * 100
    : 0

  return (
    <div className="project-card">
      <div className="project-header compact-project-header">
        <div className="project-title-block">
          <h3 title={name}>{name}</h3>
          <p className="project-department" title={department}>
            {department}
          </p>
        </div>

        <span
          className={`status status-${String(status)
            .toLowerCase()
            .replace(/\s+/g, '-')}`}
        >
          {status}
        </span>
      </div>

      <div className="compact-progress-section">
        <div className="progress-label">
          <span>Progress</span>
          <strong>{progressValue.toFixed(1)}%</strong>
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className="project-card-metrics">
        <div className="project-card-metric">
          <span>Budget</span>
          <strong>₹{budgetValue.toLocaleString('en-IN')} Cr</strong>
        </div>

        <div className="project-card-metric">
          <span>Spent</span>
          <strong>
            ₹{budgetUsedValue.toLocaleString('en-IN')} Cr
          </strong>
        </div>

        <div className="project-card-metric">
          <span>Risk</span>
          <strong className={`card-risk-${overallRisk.toLowerCase()}`}>
            {overallRisk} · {riskScore}/100
          </strong>
        </div>
      </div>

      <div className="project-card-meta">
        <span>
          Plan: {Number(plannedProgress || 0).toFixed(1)}%
        </span>
        <span>
          Variance: {variance >= 0 ? '+' : ''}{variance.toFixed(1)} pp
        </span>
        <span>
          Budget used: {budgetUtilization.toFixed(1)}%
        </span>
      </div>

      <div className="project-card-footer">
        {warnings.length > 0 ? (
          <span className="project-card-warning-count">
            ⚠ {warnings.length} {warnings.length === 1 ? 'issue' : 'issues'}
          </span>
        ) : (
          <span className="project-card-no-warning">No active warnings</span>
        )}

        <span className="project-card-details-hint">
          View details →
        </span>
      </div>
    </div>
  )
}

export default ProjectCard
