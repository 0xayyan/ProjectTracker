import { useEffect, useMemo, useState } from 'react'
import StatCard from '../components/StatCard'
import { calculateRisk } from '../utils/risk'
import getProjectHealth from '../utils/health'
import { calculateBudgetUtilization } from '../utils/costRisk'
import { apiRequest, getCachedApiResponse } from '../services/api'

const icons = {
  projects: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>,
  track: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6"/></svg>,
  warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.4 2.2 17a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L15.7 3.4a3.1 3.1 0 0 0-5.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  delay: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  risk: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 4 7v5c0 4.9 3.4 8.1 8 9 4.6-.9 8-4.1 8-9V7l-8-4Z"/><path d="M12 8v4M12 16h.01"/></svg>,
}

function Dashboard() {
  const cachedProjects = getCachedApiResponse('/projects')
  const cachedPredictions = getCachedApiResponse('/projects/predictions')
  const [projects, setProjects] = useState(() => cachedProjects || [])
  const [predictions, setPredictions] = useState(() => cachedPredictions || [])
  const [loading, setLoading] = useState(() => !cachedProjects)
  const [predictionsLoading, setPredictionsLoading] = useState(() => !cachedPredictions)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/projects')
      .then((projectData) => {
        setProjects(projectData)
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
      })
      .finally(() => setLoading(false))

    apiRequest('/projects/predictions')
      .then((predictionData) => {
        setPredictions(predictionData)
      })
      .catch((err) => {
        console.error(err)
        setPredictions([])
      })
      .finally(() => setPredictionsLoading(false))
  }, [])

  const stats = useMemo(() => ({
    onTrack: projects.filter((p) => p.status === 'On Track').length,
    atRisk: projects.filter((p) => p.status === 'At Risk').length,
    delayed: projects.filter((p) => p.status === 'Delayed').length,
    highRisk: projects.filter((p) => calculateRisk(p) === 'High').length,
  }), [projects])

  const budget = useMemo(() => {
    const total = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
    const used = projects.reduce((sum, p) => sum + (Number(p.budgetUsed) || 0), 0)
    return {
      total,
      used,
      utilization: calculateBudgetUtilization({ budget: total, budgetUsed: used }),
    }
  }, [projects])

  const attentionProjects = useMemo(() => {
    return projects
      .map((project) => ({
        project,
        risk: calculateRisk(project),
        health: getProjectHealth(project),
      }))
      .filter(({ risk, health }) => risk !== 'Low' || health.status !== 'Healthy')
      .sort((a, b) => b.health.riskScore - a.health.riskScore)
      .slice(0, 6)
  }, [projects])

  const aiSummary = useMemo(() => {
    const available = predictions.filter((item) => item.prediction_available)
    const highCost = available.filter((item) => item.cost_prediction === 'High').length
    const highSchedule = available.filter((item) =>
      item.schedule_prediction === 'High' || item.schedule_state === 'Already overdue'
    ).length
    const highBoth = available.filter((item) =>
      item.cost_prediction === 'High' &&
      (item.schedule_prediction === 'High' || item.schedule_state === 'Already overdue')
    ).length
    return { highCost, highSchedule, highBoth }
  }, [predictions])

  const aiAttention = useMemo(() => {
    return predictions
      .filter((item) => item.prediction_available && item.early_warning)
      .sort((a, b) => {
        const scoreA = Math.max(
          Number(a.cost_overrun_probability) || 0,
          Number(a.time_overrun_probability) || 0
        )
        const scoreB = Math.max(
          Number(b.cost_overrun_probability) || 0,
          Number(b.time_overrun_probability) || 0
        )
        return scoreB - scoreA
      })
      .slice(0, 5)
  }, [predictions])

  if (loading) return <p>Loading dashboard...</p>
  if (error) return <p className="error-message">{error}</p>

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <h1>Project Monitoring Dashboard</h1>
          <p className="page-subtitle">Portfolio overview, risk signals, budget health and predictive early warnings.</p>
        </div>
      </div>

      <div className="stats">
        <StatCard title="Total Projects" value={projects.length} color="cyan" icon={icons.projects} />
        <StatCard title="On Track" value={stats.onTrack} color="green" icon={icons.track} />
        <StatCard title="At Risk" value={stats.atRisk} color="amber" icon={icons.warning} />
        <StatCard title="Delayed" value={stats.delayed} color="rose" icon={icons.delay} />
        <StatCard title="High Risk" value={stats.highRisk} color="violet" icon={icons.risk} />
      </div>

      <section className="budget-overview">
        <div className="budget-card">
          <h3>Total Budget</h3>
          <div className="budget-value">₹{budget.total.toFixed(2)} Cr</div>
        </div>
        <div className="budget-card">
          <h3>Budget Used</h3>
          <div className="budget-value">₹{budget.used.toFixed(2)} Cr</div>
        </div>
        <div className="budget-card budget-card-wide">
          <div className="budget-card-topline">
            <h3>Overall Budget Utilization</h3>
            <strong>{budget.utilization.toFixed(1)}%</strong>
          </div>
          <div className="analytics-bar">
            <div className="analytics-bar-fill" style={{ width: `${Math.min(budget.utilization, 100)}%` }} />
          </div>
        </div>
      </section>

      <section className="dashboard-section ai-dashboard-section">
        <div className="section-heading-row">
          <div>
            <h2>AI Early Warning</h2>
            <p className="section-muted">Model-based indicators for cost and schedule intervention priority.</p>
          </div>
        </div>

        {predictionsLoading ? (
          <p>AI predictions are being generated in the background...</p>
        ) : (
        <>
        <div className="ai-summary-grid">
          <div className="ai-summary-card">
            <span>High Cost Risk</span>
            <strong>{aiSummary.highCost}</strong>
          </div>
          <div className="ai-summary-card">
            <span>High Schedule Risk</span>
            <strong>{aiSummary.highSchedule}</strong>
          </div>
          <div className="ai-summary-card">
            <span>High Risk on Both</span>
            <strong>{aiSummary.highBoth}</strong>
          </div>
        </div>

        {aiAttention.length === 0 ? (
          <p>No AI early-warning projects require priority attention.</p>
        ) : (
          <div className="attention-list">
            {aiAttention.map((item) => (
              <div className="attention-card" key={item.project.id}>
                <div>
                  <strong>{item.project.name}</strong>
                  <span>{item.project.department}</span>
                  <small>
                    Cost {item.cost_overrun_probability}% • Schedule {item.time_overrun_probability === null ? 'N/A' : `${item.time_overrun_probability}%`}
                  </small>
                </div>
                <div className="attention-meta">
                  <span className="ai-model-badge">{item.model}</span>
                  <span className={`risk risk-${item.cost_prediction.toLowerCase()}`}>{item.cost_prediction} Cost</span>
                  <span className={`risk risk-${item.schedule_prediction.toLowerCase().replaceAll(' ', '-')}`}>{item.schedule_prediction}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading-row">
          <div>
            <h2>Projects Needing Attention</h2>
            <p className="section-muted">Highest-risk projects based on current monitoring signals.</p>
          </div>
        </div>

        {attentionProjects.length === 0 ? (
          <p>All projects are currently healthy.</p>
        ) : (
          <div className="attention-list">
            {attentionProjects.map(({ project, risk, health }) => (
              <div className="attention-card" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.department}</span>
                  <small>Progress {project.progress}% • Budget ₹{project.budget} Cr</small>
                </div>
                <div className="attention-meta">
                  <span className={`risk risk-${risk.toLowerCase()}`}>{risk}</span>
                  <span className={`health-pill health-${health.status.toLowerCase().replace(' ', '-')}`}>{health.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard
