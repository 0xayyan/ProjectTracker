function downloadCsv(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((value) => {
          const text = value === null || value === undefined ? '' : String(value)
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`
          }
          return text
        })
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportProjectsToCsv(projects) {
  const header = [
    'Name',
    'Department',
    'Status',
    'Progress (%)',
    'Planned Progress (%)',
    'Budget (Cr)',
    'Budget Used (Cr)',
    'Budget Utilization (%)',
    'Start Date',
    'End Date',
  ]

  const rows = projects.map((project) => {
    const budget = Number(project.budget) || 0
    const budgetUsed = Number(project.budgetUsed) || 0
    const utilization = budget > 0 ? ((budgetUsed / budget) * 100).toFixed(1) : '0.0'
    return [
      project.name,
      project.department,
      project.status,
      project.progress,
      project.plannedProgress,
      budget.toFixed(2),
      budgetUsed.toFixed(2),
      utilization,
      project.startDate,
      project.endDate,
    ]
  })

  downloadCsv(`projectwatch-projects-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
}

function exportAlertsToCsv(alertGroups) {
  const header = [
    'Project',
    'Department',
    'Severity',
    'Risk Score',
    'AI Cost Overrun (%)',
    'AI Schedule Overrun (%)',
    'Issue Count',
    'Issues',
  ]

  const rows = alertGroups.map((group) => [
    group.project.name,
    group.project.department,
    group.severity,
    group.riskScore,
    group.prediction.cost_overrun_probability,
    group.prediction.time_overrun_probability === null ? 'N/A' : group.prediction.time_overrun_probability,
    group.issueCount,
    group.issues.map((issue) => `${issue.type}: ${issue.message}`).join(' | '),
  ])

  downloadCsv(`projectwatch-alerts-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
}

export { exportProjectsToCsv, exportAlertsToCsv }
