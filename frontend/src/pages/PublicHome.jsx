import { useEffect, useMemo, useState } from 'react'
import ProjectCard from '../components/ProjectCard'
import PublicProjectDetails from './PublicProjectDetails'
import { apiRequest, getCachedApiResponse } from '../services/api'
import { calculateRisk } from '../utils/risk'
import { exportProjectsToCsv } from '../utils/exportCsv'

const PAGE_SIZE = 12

function parseDdMmYyyyToIso(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim())
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(iso)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return iso
}

function getStats(projects) {
  return {
    total: projects.length,
    onTrack: projects.filter((project) => project.status === 'On Track').length,
    atRisk: projects.filter((project) => project.status === 'At Risk').length,
    delayed: projects.filter((project) => project.status === 'Delayed').length,
  }
}

function PublicHome({ darkMode, onThemeToggle, onLogin }) {
  const cachedProjects = getCachedApiResponse('/public/projects')
  const [projects, setProjects] = useState(() => cachedProjects || [])
  const [loading, setLoading] = useState(() => !cachedProjects)
  const [error, setError] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [riskFilter, setRiskFilter] = useState('All')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    apiRequest('/public/projects')
      .then(setProjects)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, riskFilter, endDateFilter])

  const endDateFilterIso = useMemo(
    () => parseDdMmYyyyToIso(endDateFilter),
    [endDateFilter]
  )

  const filteredProjects = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()

    return projects.filter((project) => {
      const matchesSearch =
        !search ||
        project.name.toLowerCase().includes(search) ||
        project.department.toLowerCase().includes(search)

      const matchesStatus =
        statusFilter === 'All' || project.status === statusFilter

      const matchesRisk =
        riskFilter === 'All' || calculateRisk(project) === riskFilter

      const matchesEndDate =
        !endDateFilterIso ||
        (Boolean(project.endDate) && project.endDate <= endDateFilterIso)

      return matchesSearch && matchesStatus && matchesRisk && matchesEndDate
    })
  }, [projects, searchTerm, statusFilter, riskFilter, endDateFilterIso])

  const stats = useMemo(() => getStats(projects), [projects])
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const visibleProjects = filteredProjects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  if (selectedProject) {
    return (
      <div className="public-page">
        <PublicHeader
          darkMode={darkMode}
          onThemeToggle={onThemeToggle}
          onLogin={onLogin}
        />
        <main className="public-content">
          <PublicProjectDetails
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="public-page">
      <PublicHeader
        darkMode={darkMode}
        onThemeToggle={onThemeToggle}
        onLogin={onLogin}
      />

      <main className="public-content">
        <section className="public-hero">
          <div>
            <span className="public-eyebrow">MoSPI • SIH26103</span>
            <h1>Project Monitoring Portal</h1>
            <p>
              Explore project progress, budgets, milestones and reported status
              across the monitored portfolio.
            </p>
          </div>
          <button className="secondary-action-btn export-btn" onClick={() => exportProjectsToCsv(filteredProjects)} disabled={!filteredProjects.length}>
            Export CSV
          </button>
        </section>

        <section className="public-stats">
          <div className="public-stat-card">
            <span>Total Projects</span>
            <strong>{stats.total.toLocaleString()}</strong>
          </div>
          <div className="public-stat-card">
            <span>On Track</span>
            <strong>{stats.onTrack.toLocaleString()}</strong>
          </div>
          <div className="public-stat-card">
            <span>At Risk</span>
            <strong>{stats.atRisk.toLocaleString()}</strong>
          </div>
          <div className="public-stat-card">
            <span>Delayed</span>
            <strong>{stats.delayed.toLocaleString()}</strong>
          </div>
        </section>

        <div className="public-section-heading">
          <div>
            <h2>All Projects</h2>
            <p>View project information without signing in. Management actions are available only to authorized officials.</p>
          </div>
        </div>

        <div className="project-filters public-project-filters">
          <input
            type="text"
            placeholder="Search by project name or department name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Reported Statuses</option>
            <option value="On Track">On Track</option>
            <option value="At Risk">At Risk</option>
            <option value="Delayed">Delayed</option>
          </select>
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="All">All Calculated Risks</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="End date on/before (dd-mm-yyyy)"
            value={endDateFilter}
            onChange={(event) => setEndDateFilter(event.target.value)}
            maxLength={10}
            aria-invalid={Boolean(endDateFilter && !endDateFilterIso)}
          />
        </div>

        {error && <p className="error-message">{error}</p>}
        {loading && <div className="public-loading">Loading project portfolio...</div>}

        {!loading && filteredProjects.length === 0 && (
          <div className="public-empty">No projects match your search or filters.</div>
        )}

        {!loading && filteredProjects.length > 0 && (
          <>
            <div className="project-list public-project-list">
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className="project-wrapper public-project-wrapper"
                  onClick={() => setSelectedProject(project)}
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
                  <button
                    type="button"
                    className="public-view-project-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedProject(project)
                    }}
                  >
                    View Project Details
                  </button>
                </div>
              ))}
            </div>

            <div className="pagination-bar">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredProjects.length)} of{' '}
                {filteredProjects.length}
              </span>
              <div className="pagination-controls">
                <button disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                  Previous
                </button>
                <span>Page {safePage} of {totalPages}</span>
                <button disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function PublicHeader({ darkMode, onThemeToggle, onLogin }) {
  return (
    <header className="public-header">
      <div className="public-brand">
        <div className="public-brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20" />
            <path d="M5 20V10l7-7 7 7v10" />
            <path d="M9 20v-6h6v6" />
          </svg>
        </div>
        <div>
          <strong>Project Tracker</strong>
          <span>MoSPI • SIH26103</span>
        </div>
      </div>

      <div className="public-header-actions">
        <button
          type="button"
          className="theme-toggle-btn public-theme-toggle"
          onClick={onThemeToggle}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {darkMode ? '☀ Light' : '☾ Dark'}
        </button>
        <button type="button" className="public-login-btn" onClick={onLogin}>
          Login
        </button>
      </div>
    </header>
  )
}

export default PublicHome
