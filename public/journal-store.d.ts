export type PendingVisit = {
  id: string
  owner: string
  summit_id: string
  completed_at: string
  notes: string
  created_at?: string
}
export function getOwner(): Promise<string | null | undefined>
export function setOwner(owner: string | null): Promise<unknown>
export function listPending(owner: string): Promise<PendingVisit[]>
export function removePending(id: string): Promise<unknown>
export function clearPending(owner: string): Promise<void>
export function putPending(visit: PendingVisit): Promise<void>
