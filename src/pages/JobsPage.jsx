export default function JobsPage() {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Work orders</h3>
      <table className="table">
        <thead><tr><th>Order</th><th>Customer</th><th>Machine</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>WO-1001</td><td>SteelCo</td><td>Lathe-01</td><td><span className="badge badge-blue">Scheduled</span></td></tr>
          <tr><td>WO-1002</td><td>Forge Parts</td><td>CNC-04</td><td><span className="badge badge-green">Completed</span></td></tr>
          <tr><td>WO-1003</td><td>Axis Tools</td><td>Miller-02</td><td><span className="badge badge-amber">Pending</span></td></tr>
        </tbody>
      </table>
    </div>
  )
}
