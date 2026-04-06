'use client'

import { useState, useCallback, useRef, type DragEvent } from 'react'

export type KanbanPhase = {
  id: string
  number: number
  name: string
  color: string | null
  stallThresholdDays: number
}

export type KanbanProject = {
  id: string
  title: string
  customerName: string
  currentPhase: number
  phaseEnteredAt: string
  daysInPhase: number
  isStalled: boolean
  kwp?: number
  beraterName?: string
}

export type KanbanBoardProps = {
  phases: KanbanPhase[]
  projects: KanbanProject[]
  onMoveProject?: (projectId: string, toPhase: number) => void
  loading?: boolean
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function KanbanSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" role="status" aria-label="Loading Kanban board">
      {Array.from({ length: Math.min(columnCount, 8) }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-64 animate-pulse"
        >
          <div className="h-10 bg-brand-surface rounded-brand mb-2" />
          <div className="space-y-2">
            <div className="h-24 bg-brand-surface rounded-brand" />
            <div className="h-24 bg-brand-surface rounded-brand" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile accordion view                                              */
/* ------------------------------------------------------------------ */

function MobileAccordionView({
  phases,
  projectsByPhase,
  onMoveProject,
}: {
  phases: KanbanPhase[]
  projectsByPhase: Map<number, KanbanProject[]>
  onMoveProject?: KanbanBoardProps['onMoveProject']
}) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(() => {
    // Auto-expand phases that have projects
    const initial = new Set<number>()
    for (const phase of phases) {
      const projects = projectsByPhase.get(phase.number)
      if (projects && projects.length > 0) {
        initial.add(phase.number)
        // Only auto-expand first 3 non-empty phases
        if (initial.size >= 3) break
      }
    }
    return initial
  })

  const togglePhase = useCallback((phaseNumber: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseNumber)) {
        next.delete(phaseNumber)
      } else {
        next.add(phaseNumber)
      }
      return next
    })
  }, [])

  return (
    <div className="md:hidden space-y-1">
      {phases.map((phase) => {
        const projects = projectsByPhase.get(phase.number) ?? []
        const isExpanded = expandedPhases.has(phase.number)
        const stalledCount = projects.filter((p) => p.isStalled).length
        const headerColor = phase.color ?? 'var(--brand-primary)'

        return (
          <div key={phase.id} className="rounded-brand overflow-hidden">
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => togglePhase(phase.number)}
              className="flex min-h-[44px] w-full items-center justify-between px-3 py-2.5 text-left"
              style={{ backgroundColor: headerColor, color: '#FFFFFF' }}
              aria-expanded={isExpanded}
              aria-controls={`phase-panel-${phase.number}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold flex-shrink-0">{phase.number}</span>
                <span className="text-sm font-medium truncate">{phase.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-bold bg-white/20 rounded px-1.5 py-0.5">
                  {projects.length}
                </span>
                {stalledCount > 0 && (
                  <span className="text-xs font-bold bg-red-500 text-white rounded px-1.5 py-0.5">
                    {stalledCount}
                  </span>
                )}
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Accordion panel */}
            {isExpanded && (
              <div
                id={`phase-panel-${phase.number}`}
                className="bg-brand-surface/50 p-2 space-y-2"
                role="list"
                aria-label={`Phase ${phase.number}: ${phase.name}, ${projects.length} Projekte`}
              >
                {projects.length === 0 ? (
                  <p className="text-xs text-brand-text-secondary text-center py-4">
                    Keine Projekte in dieser Phase
                  </p>
                ) : (
                  projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      phases={phases}
                      onMoveProject={onMoveProject}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Project card                                                       */
/* ------------------------------------------------------------------ */

function ProjectCard({
  project,
  phases,
  onMoveProject,
  isDragTarget = false,
}: {
  project: KanbanProject
  phases?: KanbanPhase[]
  onMoveProject?: KanbanBoardProps['onMoveProject']
  isDragTarget?: boolean
}) {
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', project.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    [project.id],
  )

  const stallBorder = project.isStalled
    ? project.daysInPhase > 14
      ? 'border-red-500'
      : 'border-amber-500'
    : 'border-transparent'

  return (
    <div
      draggable={!!onMoveProject}
      onDragStart={handleDragStart}
      className={[
        'bg-brand-background rounded-brand p-3 border-l-4 shadow-sm',
        stallBorder,
        isDragTarget ? 'opacity-50' : '',
        onMoveProject ? 'cursor-grab active:cursor-grabbing' : '',
      ].join(' ')}
      role="listitem"
      aria-label={`${project.title} - ${project.customerName}, ${project.daysInPhase} Tage in Phase`}
    >
      <p className="text-sm font-medium text-brand-text-primary truncate">
        {project.title}
      </p>
      <p className="text-xs text-brand-text-secondary truncate mt-0.5">
        {project.customerName}
      </p>
      <div className="flex items-center justify-between mt-2">
        {project.kwp !== undefined && (
          <span className="text-xs text-brand-text-secondary">
            {new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 }).format(project.kwp)} kWp
          </span>
        )}
        <span
          className={[
            'text-xs font-medium px-1.5 py-0.5 rounded',
            project.isStalled
              ? project.daysInPhase > 14
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
              : 'bg-brand-surface text-brand-text-secondary',
          ].join(' ')}
        >
          {project.daysInPhase} {project.daysInPhase === 1 ? 'Tag' : 'Tage'}
        </span>
      </div>
      {project.beraterName && (
        <p className="text-xs text-brand-text-secondary mt-1 truncate">
          {project.beraterName}
        </p>
      )}

      {/* Mobile move controls */}
      {onMoveProject && phases && (
        <div className="mt-2 md:hidden">
          <label htmlFor={`move-${project.id}`} className="sr-only">
            Projekt verschieben
          </label>
          <select
            id={`move-${project.id}`}
            value={project.currentPhase}
            onChange={(e) => {
              const toPhase = Number(e.target.value)
              if (toPhase !== project.currentPhase) {
                onMoveProject(project.id, toPhase)
              }
            }}
            className="w-full min-h-[44px] text-xs px-2 py-1 rounded border border-brand-text-secondary/20 bg-brand-surface text-brand-text-primary"
            aria-label={`Move ${project.title} to a different phase`}
          >
            {phases.map((phase) => (
              <option key={phase.id} value={phase.number}>
                {phase.number}. {phase.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase column                                                       */
/* ------------------------------------------------------------------ */

function PhaseColumn({
  phase,
  projects,
  onMoveProject,
}: {
  phase: KanbanPhase
  projects: KanbanProject[]
  onMoveProject?: KanbanBoardProps['onMoveProject']
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)
      const projectId = e.dataTransfer.getData('text/plain')
      if (projectId && onMoveProject) {
        onMoveProject(projectId, phase.number)
      }
    },
    [onMoveProject, phase.number],
  )

  const stalledCount = projects.filter((p) => p.isStalled).length
  const headerColor = phase.color ?? 'var(--brand-primary)'

  return (
    <div
      className={[
        'flex-shrink-0 w-64 flex flex-col rounded-brand overflow-hidden',
        isDragOver ? 'ring-2 ring-brand-primary ring-offset-2' : '',
      ].join(' ')}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="list"
      aria-label={`Phase ${phase.number}: ${phase.name}, ${projects.length} Projekte`}
    >
      {/* Column header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ backgroundColor: headerColor, color: '#FFFFFF' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold flex-shrink-0">{phase.number}</span>
          <span className="text-xs font-medium truncate">{phase.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-bold bg-white/20 rounded px-1.5 py-0.5">
            {projects.length}
          </span>
          {stalledCount > 0 && (
            <span
              className="text-xs font-bold bg-red-500 text-white rounded px-1.5 py-0.5"
              title={`${stalledCount} blockierte Projekte`}
              aria-label={`${stalledCount} stalled projects`}
            >
              {stalledCount}
            </span>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 bg-brand-surface/50 p-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-200px)]">
        {projects.length === 0 ? (
          <p className="text-xs text-brand-text-secondary text-center py-4">Leer</p>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onMoveProject={onMoveProject}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main board                                                         */
/* ------------------------------------------------------------------ */

export function KanbanBoard({
  phases,
  projects,
  onMoveProject,
  loading = false,
}: KanbanBoardProps) {
  const sortedPhases = [...phases].sort((a, b) => a.number - b.number)

  const projectsByPhase = new Map<number, KanbanProject[]>()
  for (const phase of sortedPhases) {
    projectsByPhase.set(phase.number, [])
  }
  for (const project of projects) {
    const bucket = projectsByPhase.get(project.currentPhase)
    if (bucket) {
      bucket.push(project)
    }
  }

  if (loading) {
    return <KanbanSkeleton columnCount={sortedPhases.length} />
  }

  return (
    <div role="region" aria-label="Projekt-Kanban-Board">
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-3 text-xs text-brand-text-secondary">
        <span>{projects.length} Projekte total</span>
        <span>{projects.filter((p) => p.isStalled).length} blockiert</span>
      </div>

      {/* Mobile accordion view */}
      <MobileAccordionView
        phases={sortedPhases}
        projectsByPhase={projectsByPhase}
        onMoveProject={onMoveProject}
      />

      {/* Desktop scrollable board */}
      <div
        className="hidden md:flex gap-3 overflow-x-auto pb-4"
        role="list"
        aria-label="Phase columns"
      >
        {sortedPhases.map((phase) => (
          <PhaseColumn
            key={phase.id}
            phase={phase}
            projects={projectsByPhase.get(phase.number) ?? []}
            onMoveProject={onMoveProject}
          />
        ))}
      </div>
    </div>
  )
}
