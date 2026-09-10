import { useEffect, useMemo, useState } from "react";
import ProjectCard from "../components/ProjectCard";
import ProjectDetails from "../components/ProjectDetails";
import AddProject from "./AddProject";
import { calculateRisk } from "../utils/risk";
import { apiRequest, getCachedApiResponse } from "../services/api";
import { exportProjectsToCsv } from "../utils/exportCsv";

const PAGE_SIZE = 12;

// Parses a dd-mm-yyyy string into a zero-padded ISO "yyyy-mm-dd" string so it
// can be compared directly against project.endDate (already stored as ISO).
// Returns null if the input is empty, malformed, or not a real calendar date.
function parseDdMmYyyyToIso(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Guard against inputs like 31-02-2026 that regex-match but aren't real dates.
  const parsed = new Date(iso);
  const isRealDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isRealDate ? iso : null;
}
function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function Projects() {
  const cachedProjects = getCachedApiResponse("/projects");
  const [projects, setProjects] = useState(() => cachedProjects || []);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(() => !cachedProjects);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingProject, setEditingProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editForm, setEditForm] = useState({
    name: "",
    department: "",
    progress: 0,
    plannedProgress: 0,
    budget: 0,
    budgetUsed: 0,
    status: "On Track",
    startDate: "",
    endDate: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);

  const role = localStorage.getItem("role") || "officer";

  useEffect(() => {
    apiRequest("/projects")
      .then((data) => setProjects(data))
      .catch((error) => {
        console.error(error);
        setError(error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, riskFilter, endDateFilter]);

  function handleProjectClick(projectId) {
    setDetailsLoading(true);
    setError("");

    apiRequest(`/projects/${projectId}`)
      .then((data) => setSelectedProject(data))
      .catch((error) => {
        console.error(error);
        setError(error.message);
      })
      .finally(() => setDetailsLoading(false));
  }

  function handleEditClick(project, event) {
    event.stopPropagation();
    setEditingProject(project);
    setEditForm({
      name: project.name,
      department: project.department,
      progress: project.progress,
      plannedProgress: project.plannedProgress,
      budget: project.budget,
      budgetUsed: project.budgetUsed,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
    });
  }

  function handleEditInputChange(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  async function handleUpdateProject(event) {
    event.preventDefault();
    setError("");

    try {
      const updatedProject = await apiRequest(
        `/projects/${editingProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editForm.name,
            department: editForm.department,
            progress: Number(editForm.progress),
            planned_progress: Number(editForm.plannedProgress),
            budget: Number(editForm.budget),
            budget_used: Number(editForm.budgetUsed),
            status: editForm.status,
            start_date: editForm.startDate,
            end_date: editForm.endDate,
          }),
        },
      );

      setProjects((current) =>
        current.map((project) =>
          project.id === updatedProject.id ? updatedProject : project,
        ),
      );
      setEditingProject(null);
    } catch (error) {
      console.error(error);
      setError(error.message);
    }
  }

  async function handleDeleteProject(projectId, event) {
    event.stopPropagation();
    const confirmed = window.confirm(
      "Are you sure you want to delete this project?",
    );
    if (!confirmed) return;

    setError("");

    try {
      await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
      setProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
    } catch (error) {
      console.error(error);
      setError(error.message);
    }
  }

  const endDateFilterIso = useMemo(
    () => parseDdMmYyyyToIso(endDateFilter),
    [endDateFilter],
  );
  const endDateFilterInvalid = endDateFilter.trim() !== "" && !endDateFilterIso;

  const filteredProjects = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return projects.filter((project) => {
      const matchesSearch =
        !search ||
        project.name.toLowerCase().includes(search) ||
        project.department.toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "All" || project.status === statusFilter;

      const matchesRisk =
        riskFilter === "All" || calculateRisk(project) === riskFilter;

      // Show projects whose end date is on or before the chosen date.
      // Invalid/incomplete input is ignored so it doesn't hide everything.
      const matchesEndDate =
        !endDateFilterIso ||
        (Boolean(project.endDate) && project.endDate <= endDateFilterIso);

      return matchesSearch && matchesStatus && matchesRisk && matchesEndDate;
    });
  }, [projects, searchTerm, statusFilter, riskFilter, endDateFilterIso]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const visibleProjects = filteredProjects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  if (loading) {
    return <p>Loading projects...</p>;
  }

  if (showAddProject) {
    return (
      <AddProject
        onBack={() => setShowAddProject(false)}
        onProjectCreated={(newProject) => {
          setProjects((current) => [newProject, ...current]);
          setCurrentPage(1);
          setShowAddProject(false);
        }}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectDetails
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <h1>Projects</h1>
          <p className="page-subtitle">Monitor and manage ongoing projects.</p>
        </div>
        <button
          className="secondary-action-btn export-btn"
          onClick={() => exportProjectsToCsv(filteredProjects)}
          disabled={filteredProjects.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="add-project-action">
        <button
          type="button"
          className="primary-action-btn"
          onClick={() => setShowAddProject(true)}
        >
          + Add New Project
        </button>
      </div>

      <div className="project-filters">
        <input
          type="text"
          placeholder="Search by project name or department name..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Reported Statuses</option>
          <option value="On Track">On Track</option>
          <option value="At Risk">At Risk</option>
          <option value="Delayed">Delayed</option>
        </select>

        <select
          value={riskFilter}
          onChange={(event) => setRiskFilter(event.target.value)}
        >
          <option value="All">All Calculated Risks</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
        </select>

        <div className="end-date-filter">
          <input
            type="text"
            inputMode="numeric"
            placeholder="End date on/before (dd-mm-yyyy)"
            value={endDateFilter}
            onChange={(event) => setEndDateFilter(event.target.value)}
            maxLength={10}
            aria-invalid={endDateFilterInvalid}
          />
          {endDateFilterInvalid && (
            <span className="end-date-filter-hint">
              Enter a valid date as dd-mm-yyyy
            </span>
          )}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {editingProject && (
        <div className="create-project-section">
          <h2>Edit Project</h2>
          <form onSubmit={handleUpdateProject}>
            <input
              type="text"
              name="name"
              value={editForm.name}
              onChange={handleEditInputChange}
              required
            />
            <input
              type="text"
              name="department"
              value={editForm.department}
              onChange={handleEditInputChange}
              required
            />
            <label>
              Actual Progress (%)
              <input
                type="number"
                name="progress"
                min="0"
                max="100"
                step="0.1"
                value={editForm.progress}
                onChange={handleEditInputChange}
              />
            </label>
            <label>
              Planned Progress (%)
              <input
                type="number"
                name="plannedProgress"
                min="0"
                max="100"
                step="0.1"
                value={editForm.plannedProgress}
                onChange={handleEditInputChange}
              />
            </label>
            <label>
              Total Budget (₹ Cr)
              <input
                type="number"
                name="budget"
                min="0"
                step="0.01"
                value={editForm.budget}
                onChange={handleEditInputChange}
              />
            </label>
            <label>
              Budget Used (₹ Cr)
              <input
                type="number"
                name="budgetUsed"
                min="0"
                step="0.01"
                value={editForm.budgetUsed}
                onChange={handleEditInputChange}
              />
            </label>
            <label>
              Status
              <select
                name="status"
                value={editForm.status}
                onChange={handleEditInputChange}
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
                value={editForm.startDate}
                onChange={handleEditInputChange}
                required
              />
            </label>
            <label>
              Project End Date
              <input
                type="date"
                name="endDate"
                value={editForm.endDate}
                onChange={handleEditInputChange}
                required
              />
            </label>
            <button type="submit">Save Changes</button>
            <button type="button" onClick={() => setEditingProject(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {detailsLoading && <p>Loading project details...</p>}

      {filteredProjects.length === 0 ? (
        <p>No projects match your search or filters.</p>
      ) : (
        <>
          <div className="project-list">
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                className="project-wrapper"
                onClick={() => handleProjectClick(project.id)}
              >
                <ProjectCard
                  name={project.name}
                  department={project.department}
                  progress={project.progress}
                  plannedProgress={project.plannedProgress}
                  budget={project.budget}
                  budgetUsed={project.budgetUsed}
                  status={project.status}
                  milestones={project.milestones}
                  startDate={project.startDate}
                  endDate={project.endDate}
                />

                <div className="project-actions">
                  <button onClick={(event) => handleEditClick(project, event)}>
                    Edit
                  </button>
                  {role === "admin" && (
                    <button
                      onClick={(event) =>
                        handleDeleteProject(project.id, event)
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination-bar">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredProjects.length)} of{" "}
              {filteredProjects.length}
            </span>
            <div className="pagination-controls">
              <button
                disabled={safePage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span>
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Projects;
