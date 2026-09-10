import { useState } from 'react'
import { apiRequest } from '../services/api'

function CreateProjectForm({ onProjectCreated }) {
  const [form, setForm] = useState({
    name: "",
    department: "",
    progress: 0,
    plannedProgress: 0,
    budget: 0,
    budgetUsed: 0,
    status: "On Track",
    startDate: "",
    endDate: "",
  })

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  function handleInputChange(event) {
    const { name, value } = event.target

    setForm({
      ...form,
      [name]: value
    })
  }

  async function handleCreateProject(event) {
    event.preventDefault()

    setCreating(true)
    setError("")

    try {
      const newProject = await apiRequest("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          department: form.department,
          progress: Number(form.progress),
          planned_progress: Number(form.plannedProgress),
          budget: Number(form.budget),
          budget_used: Number(form.budgetUsed),
          status: form.status,
          start_date: form.startDate,
          end_date: form.endDate,
        })
      })

      onProjectCreated(newProject)

      setForm({
        name: "",
        department: "",
        progress: 0,
        plannedProgress: 0,
        budget: 0,
        budgetUsed: 0,
        status: "On Track",
        startDate: "",
        endDate: ""
      })

    } catch (error) {
      console.error(error)
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="create-project-section">

      <h2>Add New Project</h2>

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      <form onSubmit={handleCreateProject}>

        <input
          type="text"
          name="name"
          placeholder="Project name"
          value={form.name}
          onChange={handleInputChange}
          required
        />

        <input
          type="text"
          name="department"
          placeholder="Department"
          value={form.department}
          onChange={handleInputChange}
          required
        />

        <label>
          Actual Progress (%)
          <input
            type="number"
            name="progress"
            min="0"
            max="100"
            value={form.progress}
            onChange={handleInputChange}
          />
        </label>

        <label>
          Planned Progress (%)
          <input
            type="number"
            name="plannedProgress"
            min="0"
            max="100"
            value={form.plannedProgress}
            onChange={handleInputChange}
          />
        </label>

        <label>
          Total Budget (₹ Cr)
          <input
            type="number"
            name="budget"
            min="0"
            value={form.budget}
            onChange={handleInputChange}
          />
        </label>

        <label>
          Budget Used (₹ Cr)
          <input
            type="number"
            name="budgetUsed"
            min="0"
            value={form.budgetUsed}
            onChange={handleInputChange}
          />
        </label>

        <label>
          Status
          <select
            name="status"
            value={form.status}
            onChange={handleInputChange}
          >
            <option value="On Track">On Track</option>
            <option value="At Risk">At Risk</option>
            <option value="Delayed">Delayed</option>
          </select>
        </label>
        <label>
          Project Start Date
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleInputChange}
            required
          />
        </label>

      <label>
        Project End Date
        <input
          type="date"
          name="endDate"
          value={form.endDate}
          onChange={handleInputChange}
          required
        />
      </label>
        <button
          type="submit"
          disabled={creating}
        >
          {creating ? "Creating..." : "Create Project"}
        </button>

      </form>

    </div>
  )
}

export default CreateProjectForm;