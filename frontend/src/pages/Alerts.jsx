import { useEffect, useMemo, useState } from 'react'
import { apiRequest, getCachedApiResponse } from '../services/api'
import { calculateRiskScore } from '../utils/risk'
import getProjectWarnings from '../utils/warning'
import { getCostWarning } from '../utils/costRisk'
import getScheduleForecast from '../utils/forecast'
import { exportAlertsToCsv } from '../utils/exportCsv'

const PAGE_SIZE = 20

function Alerts() {
  const cachedPredictions = getCachedApiResponse('/projects/predictions')
  const [items, setItems] = useState(() => cachedPredictions || [])
  const [severity, setSeverity] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(() => !cachedPredictions)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    apiRequest('/projects/predictions')
      .then((data) => setItems(data))
      .catch((err) => {
        console.error(err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPage(1)
  }, [severity, searchTerm])

  const projectAlerts = useMemo(() => {
    const groups = []

    items.forEach((item) => {
      if (!item.prediction_available) return

      const project = item.project
      const issues = []
      // Compute each portfolio signal once. Alerts can contain 1,911 projects,
      // so avoid repeatedly recalculating the same risk/health/forecast values.
      const riskScore = calculateRiskScore(project)
      const risk = riskScore >= 60 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low'
      const warnings = getProjectWarnings(project)
      const costWarning = getCostWarning(project)
      const forecast = getScheduleForecast(project)
      const hasCriticalForecast =
        forecast.status === 'Likely Delayed' ||
        forecast.status === 'High Delay Risk'
      const hasScheduleWarning = forecast.status === 'At Risk'

      let health
      if (riskScore >= 60 || hasCriticalForecast) {
        health = {
          status: 'Critical',
          message: 'Project requires immediate attention.',
          riskScore,
          warningCount: warnings.length,
          forecastStatus: forecast.status,
        }
      } else if (riskScore >= 30 || hasScheduleWarning) {
        health = {
          status: 'Needs Attention',
          message: 'Project shows signs of potential delay or cost pressure.',
          riskScore,
          warningCount: warnings.length,
          forecastStatus: forecast.status,
        }
      } else {
        health = {
          status: 'Healthy',
          message: 'Project is currently progressing within acceptable limits.',
          riskScore,
          warningCount: warnings.length,
          forecastStatus: forecast.status,
        }
      }

      if (health.status === 'Critical') {
        issues.push({ severity: 'Critical', type: 'Project Health', message: health.message })
      }

      if (risk === 'High') {
        issues.push({ severity: 'Critical', type: 'System Risk', message: `Calculated risk score is ${riskScore}/100.` })
      }

      if (costWarning) {
        issues.push({
          severity: costWarning.type === 'critical' ? 'Critical' : 'Warning',
          type: 'Budget Monitoring',
          message: costWarning.message,
        })
      }

      warnings.forEach((warning) => {
        issues.push({
          severity: warning.type === 'critical' ? 'Critical' : 'Warning',
          type: 'Progress / Milestone',
          message: warning.message,
        })
      })

      if (forecast.status === 'Likely Delayed' || forecast.status === 'High Delay Risk') {
        issues.push({ severity: 'Critical', type: 'Schedule Forecast', message: forecast.message })
      } else if (forecast.status === 'At Risk') {
        issues.push({ severity: 'Warning', type: 'Schedule Forecast', message: forecast.message })
      }

      if (item.cost_prediction === 'High') {
        issues.push({ severity: 'Critical', type: 'AI Cost Prediction', message: `Random Forest estimates ${item.cost_overrun_probability}% probability of cost overrun.` })
      } else if (item.cost_prediction === 'Medium') {
        issues.push({ severity: 'Warning', type: 'AI Cost Prediction', message: `Random Forest estimates ${item.cost_overrun_probability}% probability of cost overrun.` })
      }

      if (item.schedule_state === 'Already overdue') {
        issues.push({ severity: 'Critical', type: 'AI Schedule State', message: 'The project has passed its current end date without reaching 100% progress.' })
      } else if (item.schedule_prediction === 'High') {
        issues.push({ severity: 'Critical', type: 'AI Schedule Prediction', message: `Random Forest estimates ${item.time_overrun_probability}% probability of schedule delay.` })
      } else if (item.schedule_prediction === 'Medium') {
        issues.push({ severity: 'Warning', type: 'AI Schedule Prediction', message: `Random Forest estimates ${item.time_overrun_probability}% probability of schedule delay.` })
      }

      if (!issues.length) return

      const criticalCount = issues.filter((issue) => issue.severity === 'Critical').length
      const warningCount = issues.filter((issue) => issue.severity === 'Warning').length
      const groupSeverity = criticalCount > 0 ? 'Critical' : warningCount > 0 ? 'Warning' : 'Info'

      groups.push({
        project,
        health,
        risk,
        riskScore,
        severity: groupSeverity,
        issues,
        criticalCount,
        warningCount,
        issueCount: issues.length,
        prediction: item,
      })
    })

    const rank = { Critical: 0, Warning: 1, Info: 2 }
    return groups.sort((a, b) => {
      const severityDifference = rank[a.severity] - rank[b.severity]
      if (severityDifference !== 0) return severityDifference
      return b.riskScore - a.riskScore
    })
  }, [items])

  const filteredAlerts = projectAlerts.filter((group) => {
    const search = searchTerm.trim().toLowerCase()
    const matchesSeverity = severity === 'All' || group.severity === severity
    const matchesSearch = !search ||
      group.project.name.toLowerCase().includes(search) ||
      group.project.department.toLowerCase().includes(search)
    return matchesSeverity && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleAlerts = filteredAlerts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  if (loading) return <p>Loading alerts...</p>
  if (error) return <p className="error-message">{error}</p>

  const criticalProjects = projectAlerts.filter((group) => group.severity === 'Critical').length
  const warningProjects = projectAlerts.filter((group) => group.severity === 'Warning').length

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <h1>Alerts</h1>
          <p className="page-subtitle">One alert card per project, combining rule-based signals and AI predictions.</p>
        </div>
        <button
          className="secondary-action-btn export-btn"
          onClick={() => exportAlertsToCsv(filteredAlerts)}
          disabled={filteredAlerts.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="alert-controls">
        <input
          type="text"
          className="alert-search"
          placeholder="Search project or department..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select className="alert-filter" value={severity} onChange={(event) => setSeverity(event.target.value)}>
          <option value="All">All Severities</option>
          <option value="Critical">Critical Projects</option>
          <option value="Warning">Warning Projects</option>
        </select>
      </div>

      <div className="alert-summary-grid">
        <div className="alert-summary alert-summary-critical"><span>Critical Projects</span><strong>{criticalProjects}</strong></div>
        <div className="alert-summary alert-summary-warning"><span>Warning Projects</span><strong>{warningProjects}</strong></div>
        <div className="alert-summary alert-summary-info"><span>Projects with Alerts</span><strong>{projectAlerts.length}</strong></div>
      </div>

      <div className="alerts-result-count">Showing {filteredAlerts.length} project{filteredAlerts.length === 1 ? '' : 's'}</div>

      {visibleAlerts.length === 0 ? (
        <section className="alerts-empty">
          <h2>No matching projects</h2>
          <p>No projects currently match the selected alert filters.</p>
        </section>
      ) : (
        <div className="project-alerts-list">
          {visibleAlerts.map((group) => (
            <details className={`project-alert-card alert-${group.severity.toLowerCase()}`} key={group.project.id}>
              <summary className="project-alert-summary">
                <div className="project-alert-icon">{group.severity === 'Critical' ? '!' : '⚠'}</div>
                <div className="project-alert-main">
                  <div className="project-alert-topline"><span className="alert-type">{group.severity}</span><span>{group.project.department}</span></div>
                  <h3>{group.project.name}</h3>
                  <p>{group.issueCount} issue{group.issueCount === 1 ? '' : 's'} • Risk Score: {group.riskScore}/100 • AI Cost: {group.prediction.cost_overrun_probability}% • AI Schedule: {group.prediction.time_overrun_probability === null ? 'N/A' : `${group.prediction.time_overrun_probability}%`}</p>
                </div>
                <div className="project-alert-right">
                  <span className={`alert-severity-badge ${group.severity.toLowerCase()}`}>{group.severity}</span>
                  <span className="alert-expand">View</span>
                </div>
              </summary>

              <div className="project-alert-details">
                <div className="project-alert-metrics">
                  <div><span>Project Health</span><strong>{group.health.status}</strong></div>
                  <div><span>System Risk</span><strong>{group.risk}</strong></div>
                  <div><span>AI Cost Risk</span><strong>{group.prediction.cost_prediction}</strong></div>
                  <div><span>AI Schedule Risk</span><strong>{group.prediction.schedule_prediction}</strong></div>
                </div>

                <div className="ai-alert-summary">
                  <span>Recommended Action</span>
                  <p>{group.prediction.recommended_actions.join(' ')}</p>
                </div>

                <h4>Why this project needs attention</h4>
                <div className="project-alert-issues">
                  {group.issues.map((issue, index) => (
                    <div className="project-alert-issue" key={`${issue.type}-${index}`}>
                      <span className={`issue-severity-dot issue-${issue.severity.toLowerCase()}`} />
                      <div><strong>{issue.type}</strong><p>{issue.message}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {filteredAlerts.length > PAGE_SIZE && (
        <div className="pagination-bar">
          <span>Page {currentPage} of {totalPages} • {filteredAlerts.length} projects</span>
          <div className="pagination-controls">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Alerts
