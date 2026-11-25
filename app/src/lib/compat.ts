import { getProjects, getVersions, type MrVersion } from './modrinth'

/**
 * Compatibility verification against publisher-declared metadata.
 *
 * "verified" here means: the mod's author published a file on Modrinth that declares the exact
 * game version AND loader, and the dependency graph of the chosen files has no declared
 * incompatibilities and no missing required dependencies. It does NOT mean the mod was tested in
 * a running game — the UI states this explicitly.
 */

export type CompatStatus = 'compatible' | 'no-matching-version' | 'error'

export interface ModCheck {
  projectId: string
  title: string
  status: CompatStatus
  version?: MrVersion
  message: string
}

export interface Issue {
  kind: 'missing-dependency' | 'incompatible'
  from: string
  target: string
  targetTitle?: string
  message: string
}

export interface CompatReport {
  gameVersion: string
  loader: string
  checks: ModCheck[]
  issues: Issue[]
  checkedAt: number
}

export async function checkMods(
  mods: { id: string; title: string }[],
  gameVersion: string,
  loader: string,
): Promise<CompatReport> {
  const checks: ModCheck[] = await Promise.all(
    mods.map(async (m): Promise<ModCheck> => {
      try {
        const vs = await getVersions(m.id, { gameVersion, loader })
        const best = vs.find((v) => v.version_type === 'release') ?? vs[0]
        if (!best)
          return { projectId: m.id, title: m.title, status: 'no-matching-version', message: `No published file declares Minecraft ${gameVersion} + ${loader}.` }
        return { projectId: m.id, title: m.title, status: 'compatible', version: best, message: `${best.version_number} declares ${gameVersion} + ${loader} (${best.version_type}).` }
      } catch (e) {
        return { projectId: m.id, title: m.title, status: 'error', message: (e as Error).message }
      }
    }),
  )

  const selected = new Set(mods.map((m) => m.id))
  const issues: Issue[] = []
  const unknownIds = new Set<string>()
  for (const c of checks) {
    if (!c.version) continue
    for (const d of c.version.dependencies) {
      if (!d.project_id) continue
      if (d.dependency_type === 'required' && !selected.has(d.project_id)) {
        issues.push({ kind: 'missing-dependency', from: c.title, target: d.project_id, message: `${c.title} requires a dependency that is not in your selection.` })
        unknownIds.add(d.project_id)
      }
      if (d.dependency_type === 'incompatible' && selected.has(d.project_id)) {
        issues.push({ kind: 'incompatible', from: c.title, target: d.project_id, message: `${c.title} declares itself incompatible with another selected mod.` })
        unknownIds.add(d.project_id)
      }
    }
  }
  if (unknownIds.size) {
    try {
      const ps = await getProjects([...unknownIds])
      const names = new Map(ps.map((p) => [p.id, p.title]))
      for (const i of issues) i.targetTitle = names.get(i.target) ?? mods.find((m) => m.id === i.target)?.title
    } catch {
      /* titles are cosmetic */
    }
  }
  return { gameVersion, loader, checks, issues, checkedAt: Date.now() }
}
