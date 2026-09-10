import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api'
import { calculateRisk, calculateRiskScore } from '../utils/risk'
import getProjectHealth from '../utils/health'
import getScheduleForecast from '../utils/forecast'
import { calculateBudgetUtilization } from '../utils/costRisk'

function ProjectDetails({ project, onBack }) {
  const [milestones, setMilestones] = useState(project.milestones || [])
  const [form, setForm] = useState({
    name: "",
    dueDate: "",
    status: "Not Started",
  })
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [editingMilestoneForm, setEditingMilestoneForm] = useState({
    name: "",
    dueDate: "",
    status: "Not Started",
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [prediction, setPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(true)
  const [predictionError, setPredictionError] = useState("")
  const [benchmark, setBenchmark] = useState(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(true)

  const role = localStorage.getItem('role') || 'officer'
  const risk = calculateRisk(project)
  const riskScore = calculateRiskScore(project)
  const health = getProjectHealth(project)
  const forecast = getScheduleForecast(project)
  const utilization = calculateBudgetUtilization(project)
  const variance = Number(project.progress || 0) - Number(project.plannedProgress || 0)

  const aiActionText = useMemo(() => {
    if (!prediction?.recommended_actions?.length) {
      return ''
    }
    return prediction.recommended_actions.join(' ')
  }, [prediction])

  useEffect(() => {
    setMilestones(project.milestones || [])
    setPredictionLoading(true)
    setPredictionError("")
    setPrediction(null)

    apiRequest(`/projects/${project.id}/prediction`)
      .then((data) => setPrediction(data))
      .catch((error) => {
        console.error(error)
        setPredictionError(error.message || "Unable to load AI prediction")
      })
      .finally(() => setPredictionLoading(false))

    setBenchmarkLoading(true)
    apiRequest(`/projects/${project.id}/benchmark`)
      .then((data) => setBenchmark(data))
      .catch((error) => {
        console.error(error)
      })
      .finally(() => setBenchmarkLoading(false))
  }, [project.id, project.milestones])

  function handleInputChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function startMilestoneEdit(milestone) {
    setEditingMilestone(milestone.id)
    setEditingMilestoneForm({
      name: milestone.name,
      dueDate: milestone.dueDate,
      status: milestone.status,
    })
  }

  function handleMilestoneEditChange(event) {
    const { name, value } = event.target
    setEditingMilestoneForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCreateMilestone(event) {
    event.preventDefault()
    setCreating(true)
    setError("")

    try {
      const newMilestone = await apiRequest(
        `/projects/${project.id}/milestones`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            due_date: form.dueDate,
            status: form.status,
          }),
        }
      )

      setMilestones((current) => [...current, newMilestone])
      setForm({ name: "", dueDate: "", status: "Not Started" })
    } catch (error) {
      console.error(error)
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateMilestone(event, milestoneId) {
    event.preventDefault()
    setError("")

    try {
      const updatedMilestone = await apiRequest(
        `/projects/${project.id}/milestones/${milestoneId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingMilestoneForm.name,
            due_date: editingMilestoneForm.dueDate,
            status: editingMilestoneForm.status,
          }),
        }
      )

      setMilestones((current) =>
        current.map((milestone) =>
          milestone.id === updatedMilestone.id
            ? updatedMilestone
            : milestone
        )
      )
      setEditingMilestone(null)
    } catch (error) {
      console.error(error)
      setError(error.message)
    }
  }

  async function handleDeleteMilestone(milestoneId) {
    const confirmed = window.confirm("Are you sure you want to delete this milestone?")
    if (!confirmed) return

    setError("")

    try {
      await apiRequest(
        `/projects/${project.id}/milestones/${milestoneId}`,
        { method: "DELETE" }
      )

      setMilestones((current) =>
        current.filter((milestone) => milestone.id !== milestoneId)
      )
    } catch (error) {
      console.error(error)
      setError(error.message)
    }
  }

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <button className="secondary-action-btn" onClick={onBack}>
            ← Back to Projects
          </button>
          <h1>{project.name}</h1>
          <p className="page-subtitle">{project.department} • {project.status}</p>
        </div>
      </div>

      <div className="project-detail-grid">
        <div className="detail-metric-card">
          <span>Actual Progress</span>
          <strong>{project.progress}%</strong>
        </div>
        <div className="detail-metric-card">
          <span>Planned Progress</span>
          <strong>{project.plannedProgress}%</strong>
        </div>
        <div className="detail-metric-card">
          <span>Progress Variance</span>
          <strong>{variance > 0 ? '+' : ''}{variance.toFixed(1)} pp</strong>
        </div>
        <div className="detail-metric-card">
          <span>Budget</span>
          <strong>₹{Number(project.budget).toFixed(2)} Cr</strong>
        </div>
        <div className="detail-metric-card">
          <span>Budget Used</span>
          <strong>₹{Number(project.budgetUsed).toFixed(2)} Cr</strong>
        </div>
        <div className="detail-metric-card">
          <span>Budget Utilization</span>
          <strong>{utilization.toFixed(1)}%</strong>
        </div>
        <div className="detail-metric-card">
          <span>System Risk</span>
          <strong>{risk}</strong>
        </div>
        <div className="detail-metric-card">
          <span>Risk Score</span>
          <strong>{riskScore}/100</strong>
        </div>
        <div className="detail-metric-card">
          <span>Project Health</span>
          <strong>{health.status}</strong>
        </div>
        <div className="detail-metric-card">
          <span>Schedule Forecast</span>
          <strong>{forecast.status}</strong>
        </div>
        <div className="detail-metric-card">
          <span>Start Date</span>
          <strong>{project.startDate}</strong>
        </div>
        <div className="detail-metric-card">
          <span>End Date</span>
          <strong>{project.endDate}</strong>
        </div>
      </div>

      <section className="ai-prediction-card">
        <div className="ai-prediction-header">
          <div>
            <span className="ai-label">AI-Powered Early Warning</span>
            <h2>Predictive Risk Assessment</h2>
          </div>
          {prediction && <span className="ai-model-badge">{prediction.model}</span>}
        </div>

        {predictionLoading && <p>Generating prediction...</p>}

        {predictionError && (
          <p className="error-message">{predictionError}</p>
        )}

        {prediction && (
          <>
            <div className="prediction-grid">
              <div className={`prediction-item prediction-${prediction.cost_prediction.toLowerCase()}`}>
                <span>Cost Overrun Probability</span>
                <strong>{prediction.cost_overrun_probability}%</strong>
                <small>{prediction.cost_prediction} Risk</small>
              </div>

              <div className={`prediction-item prediction-${prediction.schedule_prediction.toLowerCase().replaceAll(' ', '-')}`}>
                <span>Schedule Delay Probability</span>
                <strong>
                  {prediction.time_overrun_probability === null
                    ? 'N/A'
                    : `${prediction.time_overrun_probability}%`}
                </strong>
                <small>{prediction.schedule_prediction}</small>
              </div>
            </div>

            <div className="ai-recommendation">
              <span>Recommended Action</span>
              <p>{aiActionText}</p>
            </div>
          </>
        )}
      </section>

      {benchmark && !benchmarkLoading && (
        <section className="benchmark-card">
          <div className="section-heading-row">
            <div>
              <h2>Department &amp; Portfolio Benchmark</h2>
              <p className="section-muted">How this project compares to its department and the overall portfolio.</p>
            </div>
          </div>

          <div className="benchmark-grid">
            <div className="benchmark-row">
              <span className="benchmark-row-label">Progress</span>
              <div className="benchmark-bars">
                <div className="benchmark-bar-item">
                  <span>This Project</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.project.progress, 100)}%` }} /></div>
                  <strong>{benchmark.project.progress.toFixed(0)}%</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>{project.department} Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.department_average.avg_progress, 100)}%` }} /></div>
                  <strong>{benchmark.department_average.avg_progress}%</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>Portfolio Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.portfolio_average.avg_progress, 100)}%` }} /></div>
                  <strong>{benchmark.portfolio_average.avg_progress}%</strong>
                </div>
              </div>
            </div>

            <div className="benchmark-row">
              <span className="benchmark-row-label">Budget Utilization</span>
              <div className="benchmark-bars">
                <div className="benchmark-bar-item">
                  <span>This Project</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.project.budget_utilization, 100)}%` }} /></div>
                  <strong>{benchmark.project.budget_utilization}%</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>{project.department} Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.department_average.avg_utilization, 100)}%` }} /></div>
                  <strong>{benchmark.department_average.avg_utilization}%</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>Portfolio Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.portfolio_average.avg_utilization, 100)}%` }} /></div>
                  <strong>{benchmark.portfolio_average.avg_utilization}%</strong>
                </div>
              </div>
            </div>

            <div className="benchmark-row">
              <span className="benchmark-row-label">Risk Score</span>
              <div className="benchmark-bars">
                <div className="benchmark-bar-item">
                  <span>This Project</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.project.risk_score, 100)}%` }} /></div>
                  <strong>{benchmark.project.risk_score}/100</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>{project.department} Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.department_average.avg_risk_score, 100)}%` }} /></div>
                  <strong>{benchmark.department_average.avg_risk_score}/100</strong>
                </div>
                <div className="benchmark-bar-item">
                  <span>Portfolio Avg</span>
                  <div className="analytics-bar"><div className="analytics-bar-fill" style={{ width: `${Math.min(benchmark.portfolio_average.avg_risk_score, 100)}%` }} /></div>
                  <strong>{benchmark.portfolio_average.avg_risk_score}/100</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="section-heading-row">
          <div>
            <h2>Project Milestones</h2>
            <p className="section-muted">Track milestone status, due dates and recovery actions.</p>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}

        <div className="milestone-list">
          {milestones.length === 0 ? (
            <p>No milestones have been added yet.</p>
          ) : (
            milestones.map((milestone) => (
              <div className="milestone-card" key={milestone.id}>
                {editingMilestone === milestone.id ? (
                  <form className="milestone-edit-form" onSubmit={(event) => handleUpdateMilestone(event, milestone.id)}>
                    <input
                      type="text"
                      name="name"
                      value={editingMilestoneForm.name}
                      onChange={handleMilestoneEditChange}
                      required
                    />
                    <input
                      type="date"
                      name="dueDate"
                      value={editingMilestoneForm.dueDate}
                      onChange={handleMilestoneEditChange}
                      required
                    />
                    <select
                      name="status"
                      value={editingMilestoneForm.status}
                      onChange={handleMilestoneEditChange}
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Delayed">Delayed</option>
                    </select>
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setEditingMilestone(null)}>Cancel</button>
                  </form>
                ) : (
                  <div className="milestone-row">
                    <div>
                      <strong>{milestone.name}</strong>
                      <p>Due: {milestone.dueDate}</p>
                    </div>
                    <div className="milestone-actions">
                      <span className={`milestone-status milestone-status-${milestone.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {milestone.status}
                      </span>
                      <button onClick={() => startMilestoneEdit(milestone)}>Edit</button>
                      <button onClick={() => handleDeleteMilestone(milestone.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="create-milestone-section">
          <h3>Add Milestone</h3>
          <form onSubmit={handleCreateMilestone}>
            <input
              type="text"
              name="name"
              placeholder="Milestone name"
              value={form.name}
              onChange={handleInputChange}
              required
            />
            <input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleInputChange}
              required
            />
            <select
              name="status"
              value={form.status}
              onChange={handleInputChange}
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
            </select>
            <button type="submit" disabled={creating}>
              {creating ? "Adding..." : "Add Milestone"}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

export default ProjectDetails
