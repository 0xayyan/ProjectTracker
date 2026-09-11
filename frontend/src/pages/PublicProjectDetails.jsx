import { useMemo } from 'react'
import { calculateRisk, calculateRiskScore } from '../utils/risk'
import getProjectHealth from '../utils/health'
import getScheduleForecast from '../utils/forecast'
import { calculateBudgetUtilization } from '../utils/costRisk'

function PublicProjectDetails({ project, onBack }) {
  const risk = calculateRisk(project)
  const riskScore = calculateRiskScore(project)
  const health = getProjectHealth(project)
  const forecast = getScheduleForecast(project)
  const utilization = calculateBudgetUtilization(project)
  const variance = Number(project.progress || 0) - Number(project.plannedProgress || 0)

  const milestoneStats = useMemo(() => {
    const milestones = project.milestones || []
    return {
      total: milestones.length,
      completed: milestones.filter((milestone) => milestone.status === 'Completed').length,
      delayed: milestones.filter((milestone) => milestone.status === 'Delayed').length,
    }
  }, [project.milestones])

  return (
    <div className="public-project-details">
      <button className="secondary-action-btn" onClick={onBack}>← Back to Projects</button>

      <div className="page-heading-row public-detail-heading">
        <div>
          <h1>{project.name}</h1>
          <p className="page-subtitle">{project.department} • {project.status}</p>
        </div>
      </div>

      <div className="project-detail-grid">
        <div className="detail-metric-card"><span>Actual Progress</span><strong>{project.progress}%</strong></div>
        <div className="detail-metric-card"><span>Planned Progress</span><strong>{project.plannedProgress}%</strong></div>
        <div className="detail-metric-card"><span>Progress Variance</span><strong>{variance > 0 ? '+' : ''}{variance.toFixed(1)} pp</strong></div>
        <div className="detail-metric-card"><span>Budget</span><strong>₹{Number(project.budget).toFixed(2)} Cr</strong></div>
        <div className="detail-metric-card"><span>Budget Used</span><strong>₹{Number(project.budgetUsed).toFixed(2)} Cr</strong></div>
        <div className="detail-metric-card"><span>Budget Utilization</span><strong>{utilization.toFixed(1)}%</strong></div>
        <div className="detail-metric-card"><span>System Risk</span><strong>{risk}</strong></div>
        <div className="detail-metric-card"><span>Risk Score</span><strong>{riskScore}/100</strong></div>
        <div className="detail-metric-card"><span>Project Health</span><strong>{health.status}</strong></div>
        <div className="detail-metric-card"><span>Schedule Forecast</span><strong>{forecast.status}</strong></div>
        <div className="detail-metric-card"><span>Start Date</span><strong>{project.startDate}</strong></div>
        <div className="detail-metric-card"><span>End Date</span><strong>{project.endDate}</strong></div>
      </div>

      <section className="benchmark-card public-readonly-card">
        <div className="section-heading-row">
          <div>
            <h2>Project Milestones</h2>
            <p className="section-muted">Reported milestone status and delivery dates.</p>
          </div>
          <div className="public-milestone-summary">
            <span>{milestoneStats.total} Total</span>
            <span>{milestoneStats.completed} Completed</span>
            <span>{milestoneStats.delayed} Delayed</span>
          </div>
        </div>

        <div className="milestone-list">
          {!project.milestones?.length ? (
            <p>No milestones have been added yet.</p>
          ) : (
            project.milestones.map((milestone) => (
              <div className="milestone-card" key={milestone.id}>
                <div className="milestone-row">
                  <div>
                    <strong>{milestone.name}</strong>
                    <p>Due: {milestone.dueDate}</p>
                  </div>
                  <div className="milestone-actions">
                    <span className={`milestone-status milestone-status-${milestone.status.toLowerCase().replaceAll(' ', '-')}`}>
                      {milestone.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="public-readonly-note">
        This public view is read-only. Project creation, editing, deletion and milestone changes require authorized login access.
      </p>
    </div>
  )
}

export default PublicProjectDetails
