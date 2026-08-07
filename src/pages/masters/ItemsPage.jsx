import MasterCrudPage from './MasterCrudPage'
import { masterConfigs } from './masterConfigs'

export default function ItemsPage() {
  return <MasterCrudPage config={masterConfigs.items} />
}
