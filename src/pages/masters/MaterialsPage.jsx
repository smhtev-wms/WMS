import MasterCrudPage from './MasterCrudPage'
import { masterConfigs } from './masterConfigs'

export default function MaterialsPage() {
  return <MasterCrudPage config={masterConfigs.materials} />
}
