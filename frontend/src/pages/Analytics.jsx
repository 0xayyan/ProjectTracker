import { useEffect, useMemo, useState } from 'react'
import { apiRequest, getCachedApiResponse } from '../services/api'
import { calculateRisk, calculateRiskScore } from '../utils/risk'
import getScheduleForecast from '../utils/forecast'
import { calculateBudgetUtilization } from '../utils/costRisk'

const PAGE_SIZE = 10

function Analytics() {
  const cachedProjects = getCachedApiResponse('/projects')
  const [projects, setProjects] = useState(() => cachedProjects || [])
  const [modelData, setModelData] = useState(null)
  const [loading, setLoading] = useState(() => !cachedProjects)
  const [error, setError] = useState('')
  const [modelError, setModelError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.all([
      apiRequest('/projects'),
      apiRequest('/analytics/model-performance'),
    ])
      .then(([projectData, modelPerformance]) => {
        setProjects(projectData)
        setModelData(modelPerformance)
      })
      .catch((err) => {
        console.error(err)
        const message = err.message || 'Unable to load analytics'
        if (message.includes('Model evaluation')) {
          setModelError(message)
          return apiRequest('/projects').then((data) => setProjects(data))
        }
        setError(message)
        return null
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
    const usedBudget = projects.reduce((sum, p) => sum + (Number(p.budgetUsed) || 0), 0)
    const avgProgress = projects.length
      ? projects.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / projects.length
      : 0
    const avgRiskScore = projects.length
      ? projects.reduce((sum, p) => sum + calculateRiskScore(p), 0) / projects.length
      : 0
    const utilization = calculateBudgetUtilization({ budget: totalBudget, budgetUsed: usedBudget })
    return { totalBudget, usedBudget, avgProgress, avgRiskScore, utilization }
  }, [projects])

  const riskCounts = useMemo(() => ({
    High: projects.filter((p) => calculateRisk(p) === 'High').length,
    Medium: projects.filter((p) => calculateRisk(p) === 'Medium').length,
    Low: projects.filter((p) => calculateRisk(p) === 'Low').length,
  }), [projects])

  const statusCounts = useMemo(() => ({
    'On Track': projects.filter((p) => p.status === 'On Track').length,
    'At Risk': projects.filter((p) => p.status === 'At Risk').length,
    Delayed: projects.filter((p) => p.status === 'Delayed').length,
  }), [projects])

  const departments = useMemo(() => {
    const groups = {}
    projects.forEach((project) => {
      if (!groups[project.department]) {
        groups[project.department] = { count: 0, progress: 0, budget: 0, used: 0, risk: 0 }
      }
      const group = groups[project.department]
      group.count += 1
      group.progress += Number(project.progress) || 0
      group.budget += Number(project.budget) || 0
      group.used += Number(project.budgetUsed) || 0
      group.risk += calculateRiskScore(project)
    })

    return Object.entries(groups)
      .map(([department, group]) => ({
        department,
        count: group.count,
        avgProgress: group.progress / group.count,
        budget: group.budget,
        used: group.used,
        utilization: calculateBudgetUtilization({ budget: group.budget, budgetUsed: group.used }),
        avgRisk: group.risk / group.count,
      }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
  }, [projects])

  const timeline = useMemo(() => {
    const counts = {
      'Likely Delayed': 0,
      'High Delay Risk': 0,
      'At Risk': 0,
      'On Track': 0,
      Unknown: 0,
    }
    projects.forEach((project) => {
      counts[getScheduleForecast(project).status] += 1
    })
    return counts
  }, [projects])

  const budgetRows = projects.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE))

  if (loading) return <p>Loading analytics...</p>
  if (error) return <p className="error-message">{error}</p>

  const costComparison = modelData?.comparison?.cost_overrun
  const timeComparison = modelData?.comparison?.time_overrun
  const topCostDrivers = modelData?.top_cost_drivers || []
  const topScheduleDrivers = modelData?.top_schedule_drivers || []
  const maxCostImportance = topCostDrivers[0]?.importance || 1
  const maxScheduleImportance = topScheduleDrivers[0]?.importance || 1

  return (
    <div>
      <h1>Analytics</h1>
      <p className="page-subtitle">Portfolio analysis, PAIMANA model performance and predictive risk drivers.</p>

      {modelData && (
        <section className="source-summary-card">
          <div>
            <span>PAIMANA Source</span>
            <strong>{modelData.source_summary.source}</strong>
          </div>
          <div>
            <span>Projects in Source</span>
            <strong>{modelData.source_summary.projects_in_source}</strong>
          </div>
          <div>
            <span>Cost Labelled</span>
            <strong>{modelData.source_summary.cost_labelled_projects}</strong>
          </div>
          <div>
            <span>Schedule Labelled</span>
            <strong>{modelData.source_summary.schedule_labelled_projects}</strong>
          </div>
        </section>
      )}

      {modelError && <p className="analytics-notice">Model evaluation results are unavailable, but portfolio analytics are still shown.</p>}

      <div className="analytics-summary-grid">
        <div className="analytics-metric"><span>Total Budget</span><strong>₹{summary.totalBudget.toFixed(2)} Cr</strong></div>
        <div className="analytics-metric"><span>Budget Used</span><strong>₹{summary.usedBudget.toFixed(2)} Cr</strong></div>
        <div className="analytics-metric"><span>Avg Progress</span><strong>{summary.avgProgress.toFixed(1)}%</strong></div>
        <div className="analytics-metric"><span>Avg Risk Score</span><strong>{summary.avgRiskScore.toFixed(1)}/100</strong></div>
        <div className="analytics-metric"><span>Utilization</span><strong>{summary.utilization.toFixed(1)}%</strong></div>
      </div>

      {modelData && costComparison && timeComparison && (
        <section className="analytics-panel">
          <div className="section-heading-row">
            <div>
              <h2>Model Performance</h2>
              <p className="section-muted">Statistical baseline versus Random Forest on the evaluated dataset.</p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="analytics-table model-performance-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Metric</th>
                  <th>Logistic Regression</th>
                  <th>Random Forest</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr><td rowSpan="5">Cost Overrun</td><td>Accuracy</td><td>{costComparison.baseline_accuracy}</td><td>{costComparison.ml_accuracy}</td><td>{costComparison.accuracy_change >= 0 ? '+' : ''}{costComparison.accuracy_change}</td></tr>
                <tr><td>Precision</td><td>{costComparison.baseline_precision}</td><td>{costComparison.ml_precision}</td><td>{costComparison.precision_change >= 0 ? '+' : ''}{costComparison.precision_change}</td></tr>
                <tr><td>Recall</td><td>{costComparison.baseline_recall}</td><td>{costComparison.ml_recall}</td><td>{costComparison.recall_change >= 0 ? '+' : ''}{costComparison.recall_change}</td></tr>
                <tr><td>F1</td><td>{costComparison.baseline_f1}</td><td>{costComparison.ml_f1}</td><td>{costComparison.f1_change >= 0 ? '+' : ''}{costComparison.f1_change}</td></tr>
                <tr><td>ROC-AUC</td><td>{costComparison.baseline_roc_auc}</td><td>{costComparison.ml_roc_auc}</td><td>{costComparison.roc_auc_change >= 0 ? '+' : ''}{costComparison.roc_auc_change}</td></tr>
                <tr><td rowSpan="5">Schedule Delay</td><td>Accuracy</td><td>{timeComparison.baseline_accuracy}</td><td>{timeComparison.ml_accuracy}</td><td>{timeComparison.accuracy_change >= 0 ? '+' : ''}{timeComparison.accuracy_change}</td></tr>
                <tr><td>Precision</td><td>{timeComparison.baseline_precision}</td><td>{timeComparison.ml_precision}</td><td>{timeComparison.precision_change >= 0 ? '+' : ''}{timeComparison.precision_change}</td></tr>
                <tr><td>Recall</td><td>{timeComparison.baseline_recall}</td><td>{timeComparison.ml_recall}</td><td>{timeComparison.recall_change >= 0 ? '+' : ''}{timeComparison.recall_change}</td></tr>
                <tr><td>F1</td><td>{timeComparison.baseline_f1}</td><td>{timeComparison.ml_f1}</td><td>{timeComparison.f1_change >= 0 ? '+' : ''}{timeComparison.f1_change}</td></tr>
                <tr><td>ROC-AUC</td><td>{timeComparison.baseline_roc_auc}</td><td>{timeComparison.ml_roc_auc}</td><td>{timeComparison.roc_auc_change >= 0 ? '+' : ''}{timeComparison.roc_auc_change}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modelData && (
        <div className="analytics-grid-two">
          <section className="analytics-panel">
            <h2>Top Cost Prediction Drivers</h2>
            <div className="driver-list">
              {topCostDrivers.map((driver) => (
                <div className="driver-row" key={driver.feature}>
                  <div className="driver-label"><span>{driver.feature}</span><strong>{(driver.importance * 100).toFixed(1)}%</strong></div>
                  <div className="driver-bar"><div className="driver-bar-fill" style={{ width: `${(driver.importance / maxCostImportance) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-panel">
            <h2>Top Schedule Prediction Drivers</h2>
            <div className="driver-list">
              {topScheduleDrivers.map((driver) => (
                <div className="driver-row" key={driver.feature}>
                  <div className="driver-label"><span>{driver.feature}</span><strong>{(driver.importance * 100).toFixed(1)}%</strong></div>
                  <div className="driver-bar"><div className="driver-bar-fill" style={{ width: `${(driver.importance / maxScheduleImportance) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="analytics-grid-two">
        <section className="analytics-panel">
          <h2>Risk Distribution</h2>
          {Object.entries(riskCounts).map(([level, count]) => {
            const width = projects.length ? (count / projects.length) * 100 : 0
            return (
              <div className="distribution-row" key={level}>
                <div className="distribution-label"><span>{level}</span><strong>{count}</strong></div>
                <div className="analytics-bar"><div className={`analytics-bar-fill risk-fill-${level.toLowerCase()}`} style={{ width: `${width}%` }} /></div>
              </div>
            )
          })}
        </section>

        <section className="analytics-panel">
          <h2>Reported Status</h2>
          {Object.entries(statusCounts).map(([level, count]) => (
            <div className="status-summary-row" key={level}><span>{level}</span><strong>{count}</strong></div>
          ))}
        </section>
      </div>

      <section className="analytics-panel">
        <h2>Department Analysis</h2>
        <div className="table-scroll">
          <table className="analytics-table">
            <thead><tr><th>Department</th><th>Projects</th><th>Avg Progress</th><th>Budget</th><th>Used</th><th>Utilization</th><th>Avg Risk</th></tr></thead>
            <tbody>
              {departments.map((row) => (
                <tr key={row.department}><td>{row.department}</td><td>{row.count}</td><td>{row.avgProgress.toFixed(1)}%</td><td>₹{row.budget.toFixed(2)} Cr</td><td>₹{row.used.toFixed(2)} Cr</td><td>{row.utilization.toFixed(1)}%</td><td>{row.avgRisk.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analytics-panel">
        <h2>Budget Breakdown</h2>
        <div className="table-scroll">
          <table className="analytics-table">
            <thead><tr><th>Project</th><th>Budget</th><th>Used</th><th>Utilization</th><th>Progress</th><th>Risk</th></tr></thead>
            <tbody>
              {budgetRows.map((project) => {
                const utilization = calculateBudgetUtilization(project)
                const risk = calculateRisk(project)
                return (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>₹{Number(project.budget || 0).toFixed(2)} Cr</td>
                    <td>₹{Number(project.budgetUsed || 0).toFixed(2)} Cr</td>
                    <td><div className="table-progress-wrap"><div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(utilization, 100)}%` }} /></div><span>{utilization.toFixed(1)}%</span></div></td>
                    <td>{project.progress}%</td>
                    <td>{risk}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination-bar">
          <span>Page {Math.min(page, totalPages)} of {totalPages}</span>
          <div className="pagination-controls">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      </section>

      <section className="analytics-panel">
        <h2>Timeline Analysis</h2>
        <div className="timeline-stat-grid">
          {Object.entries(timeline).map(([status, count]) => (
            <div className="timeline-stat" key={status}><strong>{count}</strong><span>{status}</span></div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Analytics
