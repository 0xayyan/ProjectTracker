function StatCard({ title, value, color = 'cyan', icon }) {
  return (
    <div className={`card stat-card stat-card-${color}`}>
      <div className="card-header">
        <div className={`card-icon ${color}`}>
          {icon}
        </div>
      </div>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  )
}

export default StatCard;
