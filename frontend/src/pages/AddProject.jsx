import CreateProjectForm from '../components/CreateProjectForm'

function AddProject({ onBack, onProjectCreated }) {
  return (
    <div className="add-project-page">
      <div className="page-heading-row">
        <div>
          <h1>Add New Project</h1>
          <p className="page-subtitle">
            Enter the project details to add it to ProjectWatch.
          </p>
        </div>

        <button
          type="button"
          className="secondary-action-btn"
          onClick={onBack}
        >
          ← Back to Projects
        </button>
      </div>

      <CreateProjectForm
        onProjectCreated={onProjectCreated}
      />
    </div>
  )
}

export default AddProject
