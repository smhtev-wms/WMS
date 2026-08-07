import MasterCrudPage from './MasterCrudPage'
import { masterConfigs } from './masterConfigs'

export default function CustomersPage() {
  return <MasterCrudPage config={masterConfigs.customers} />
}
