import MasterCrudPage from './MasterCrudPage'
import { masterConfigs } from './masterConfigs'

export default function WmsMachinesPage() {
  return <MasterCrudPage config={masterConfigs.machines} />
}
