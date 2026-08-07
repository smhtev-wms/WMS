import { useAuth } from './AuthContext'
import { useWmsRbac } from './WmsRbacContext'

/** Per-module read/write from WMS permission matrix (Phase 5). */
export function useWmsModuleAccess(module) {
  const { profile } = useAuth()
  const { canRead, canWrite, ready } = useWmsRbac()
  const role = profile?.role
  return {
    ready,
    canView: canRead(role, module),
    canEdit: canWrite(role, module),
  }
}
