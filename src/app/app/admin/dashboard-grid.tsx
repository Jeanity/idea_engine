'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, LayoutGrid, RotateCcw, Check } from 'lucide-react'

// Reorderable + resizable widget grid (Block R2). The dashboard body is a
// 4-column CSS grid on lg+; each widget owns an order slot and a column span
// (1–4 → ¼ / ½ / ¾ / full). Order AND span persist to localStorage keyed per
// admin id. Below lg everything stacks full width regardless of saved span
// (grid-cols-1 makes the lg:col-span-* classes inert). This is pure client
// layout state — no server data is touched.

export type WidgetSpan = 1 | 2 | 3 | 4

export interface WidgetDef {
  id: string
  /** Default column span when no saved layout exists. */
  defaultSpan: WidgetSpan
  node: ReactNode
}

interface LayoutItem {
  id: string
  span: WidgetSpan
}

// Literal class names so Tailwind's scanner keeps them. base grid is 1-col
// (mobile) so these only bite at lg+, giving full-width stacking on mobile.
const SPAN_CLASS: Record<WidgetSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
}

const SPAN_OPTIONS: { span: WidgetSpan; label: string; title: string }[] = [
  { span: 1, label: '¼', title: 'Quarter width' },
  { span: 2, label: '½', title: 'Half width' },
  { span: 3, label: '¾', title: 'Three-quarter width' },
  { span: 4, label: '1', title: 'Full width' },
]

function storageKey(adminId: string): string {
  return `admin.dashboard.layout.v1:${adminId}`
}

function isSpan(n: unknown): n is WidgetSpan {
  return n === 1 || n === 2 || n === 3 || n === 4
}

/**
 * Reconcile a persisted layout with the current widget set: keep saved order +
 * span for ids that still exist, drop unknown ids, and append any newly-added
 * widgets at their default span. Keeps old saved layouts working as the widget
 * set evolves.
 */
function reconcile(saved: LayoutItem[] | null, widgets: WidgetDef[]): LayoutItem[] {
  const byId = new Map(widgets.map(w => [w.id, w]))
  const out: LayoutItem[] = []
  const seen = new Set<string>()
  for (const item of saved ?? []) {
    const def = byId.get(item.id)
    if (!def || seen.has(item.id)) continue
    out.push({ id: item.id, span: isSpan(item.span) ? item.span : def.defaultSpan })
    seen.add(item.id)
  }
  for (const w of widgets) {
    if (!seen.has(w.id)) out.push({ id: w.id, span: w.defaultSpan })
  }
  return out
}

function defaultLayout(widgets: WidgetDef[]): LayoutItem[] {
  return widgets.map(w => ({ id: w.id, span: w.defaultSpan }))
}

export function DashboardGrid({ widgets, adminId }: { widgets: WidgetDef[]; adminId: string }) {
  const [layout, setLayout] = useState<LayoutItem[]>(() => defaultLayout(widgets))
  const [editing, setEditing] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restore persisted layout post-mount (SSR renders the default order/spans).
  useEffect(() => {
    let saved: LayoutItem[] | null = null
    try {
      const raw = localStorage.getItem(storageKey(adminId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) saved = parsed as LayoutItem[]
      }
    } catch {
      /* ignore corrupt/private-mode storage */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(reconcile(saved, widgets))
    setHydrated(true)
    // Reconcile only against the widget id set, not node identity (nodes change
    // every render as data loads).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, widgets.map(w => w.id).join(',')])

  const persist = useCallback(
    (next: LayoutItem[]) => {
      try {
        localStorage.setItem(storageKey(adminId), JSON.stringify(next))
      } catch {
        /* ignore private-mode storage failures */
      }
    },
    [adminId]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const nodeById = useMemo(() => new Map(widgets.map(w => [w.id, w.node])), [widgets])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLayout(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      persist(next)
      return next
    })
  }

  function setSpan(id: string, span: WidgetSpan) {
    setLayout(prev => {
      const next = prev.map(i => (i.id === id ? { ...i, span } : i))
      persist(next)
      return next
    })
  }

  function resetLayout() {
    const next = defaultLayout(widgets)
    setLayout(next)
    try {
      localStorage.removeItem(storageKey(adminId))
    } catch {
      /* ignore */
    }
  }

  // Render nothing layout-specific until hydrated to avoid a flash of the
  // default order overwriting a saved one (still renders the widgets though).
  const items = hydrated ? layout : defaultLayout(widgets)
  const ids = items.map(i => i.id)

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white light:border-gray-200 light:bg-gray-50 light:text-gray-600 light:hover:text-gray-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset layout
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          aria-pressed={editing}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            editing
              ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300 light:border-indigo-200 light:bg-indigo-100 light:text-indigo-700'
              : 'border-white/10 bg-white/5 text-slate-300 hover:text-white light:border-gray-200 light:bg-gray-50 light:text-gray-600 light:hover:text-gray-900'
          }`}
        >
          {editing ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />}
          {editing ? 'Done' : 'Edit layout'}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 lg:auto-rows-min lg:grid-flow-row-dense lg:grid-cols-4">
            {items.map(item => (
              <SortableWidget
                key={item.id}
                id={item.id}
                span={item.span}
                editing={editing}
                onSpanChange={span => setSpan(item.id, span)}
              >
                {nodeById.get(item.id)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableWidget({
  id,
  span,
  editing,
  onSpanChange,
  children,
}: {
  id: string
  span: WidgetSpan
  editing: boolean
  onSpanChange: (span: WidgetSpan) => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${SPAN_CLASS[span]} ${isDragging ? 'opacity-80' : ''} ${
        editing ? 'rounded-2xl ring-2 ring-indigo-500/30 ring-offset-2 ring-offset-slate-950 light:ring-offset-gray-50' : ''
      }`}
    >
      {editing && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/90 p-1 shadow-lg backdrop-blur light:border-gray-200 light:bg-white/95">
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label="Drag to reorder widget"
            className="cursor-grab rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white active:cursor-grabbing light:text-gray-400 light:hover:bg-gray-100 light:hover:text-gray-700"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="hidden items-center gap-0.5 lg:flex" role="group" aria-label="Widget width">
            {SPAN_OPTIONS.map(opt => (
              <button
                key={opt.span}
                type="button"
                title={opt.title}
                aria-label={opt.title}
                aria-pressed={span === opt.span}
                onClick={() => onSpanChange(opt.span)}
                className={`h-6 w-6 rounded-md text-xs font-medium transition-colors ${
                  span === opt.span
                    ? 'bg-indigo-500/20 text-indigo-300 light:bg-indigo-100 light:text-indigo-700'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white light:text-gray-400 light:hover:bg-gray-100 light:hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
