import { supabase } from './supabase'
import { isUuid } from './ordersLib'

const DEFAULT_LABOR_RATE = 150

export async function listJobCostRollup() {
  const { data: cards, error } = await supabase
    .from('wms_job_cards')
    .select('*')
    .in('status', ['open', 'in_progress', 'inspection', 'complete'])
    .order('job_number')
  if (error) throw error
  const jobs = cards || []
  if (!jobs.length) return []

  const jobIds = jobs.map(j => j.id)
  const lineIds = [...new Set(jobs.map(j => j.po_line_id))]

  const [{ data: lines }, { data: entries }, { data: dprs }, { data: operators }] = await Promise.all([
    supabase.from('wms_po_lines').select('id, po_id, qty, unit_rate, line_no, description').in('id', lineIds),
    supabase.from('wms_job_cost_entries').select('*').in('job_card_id', jobIds),
    supabase.from('wms_dpr_entries').select('job_card_id, hours_spent, operator_id').in('job_card_id', jobIds),
    supabase.from('wms_operators').select('id, hourly_rate'),
  ])

  const poIds = [...new Set((lines || []).map(l => l.po_id))]
  const { data: pos } = poIds.length
    ? await supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds)
    : { data: [] }

  const lineById = Object.fromEntries((lines || []).map(l => [l.id, l]))
  const poById = Object.fromEntries((pos || []).map(p => [p.id, p]))
  const rateByOp = Object.fromEntries((operators || []).map(o => [o.id, Number(o.hourly_rate) || DEFAULT_LABOR_RATE]))

  const entriesByJob = {}
  for (const e of entries || []) {
    entriesByJob[e.job_card_id] = entriesByJob[e.job_card_id] || []
    entriesByJob[e.job_card_id].push(e)
  }

  const dprByJob = {}
  for (const d of dprs || []) {
    dprByJob[d.job_card_id] = dprByJob[d.job_card_id] || []
    dprByJob[d.job_card_id].push(d)
  }

  return jobs.map(job => {
    const line = lineById[job.po_line_id]
    const lineQty = Number(line?.qty) || 1
    const lineValue = lineQty * (Number(line?.unit_rate) || 0)
    const jobQty = Number(job.qty_ordered) || 0
    const revenue = lineValue * (jobQty / lineQty)

    let laborDpr = 0
    for (const d of dprByJob[job.id] || []) {
      const rate = d.operator_id ? (rateByOp[d.operator_id] ?? DEFAULT_LABOR_RATE) : DEFAULT_LABOR_RATE
      laborDpr += Number(d.hours_spent) * rate
    }

    const manual = entriesByJob[job.id] || []
    const sumType = (type) => manual.filter(e => e.cost_type === type).reduce((s, e) => s + Number(e.amount), 0)
    const materialManual = sumType('material')
    const laborManual = sumType('labor')
    const subcontract = sumType('subcontract')
    const overhead = sumType('overhead')
    const other = sumType('other')

    const laborTotal = laborDpr + laborManual
    const materialTotal = materialManual
    const totalCost = materialTotal + laborTotal + subcontract + overhead + other
    const margin = revenue - totalCost
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : null

    return {
      job,
      po: line ? poById[line.po_id] : null,
      po_line: line,
      revenue,
      material: materialTotal,
      labor: laborTotal,
      labor_dpr: laborDpr,
      subcontract,
      overhead,
      other,
      total_cost: totalCost,
      margin,
      margin_pct: marginPct,
    }
  })
}

export async function listCostEntries(jobCardId) {
  if (!isUuid(jobCardId)) return []
  const { data, error } = await supabase
    .from('wms_job_cost_entries')
    .select('*')
    .eq('job_card_id', jobCardId)
    .order('cost_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveCostEntry(payload, id) {
  const row = {
    job_card_id: payload.job_card_id,
    cost_type: payload.cost_type,
    description: payload.description,
    amount: Number(payload.amount),
    cost_date: payload.cost_date,
    reference: payload.reference || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_job_cost_entries').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_job_cost_entries').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function deleteCostEntry(id) {
  const { error } = await supabase.from('wms_job_cost_entries').delete().eq('id', id)
  if (error) throw error
}
