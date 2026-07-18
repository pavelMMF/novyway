import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useT } from '../i18n'
import { groupColors, groupNames, useDocuments, useSettings, useStore } from '../demo/store'
import { Panel } from '../ui/components'
import { sound } from '../sound/engine'

// ==========================================================
// Пространство документов: полноэкранная Three.js-сцена.
// Семантическая укладка: категории — смысловые кластеры на
// кольце; внутри кластера документ → поправка → голосование →
// снимок → receipts. Цвет узла = группа документов/категория.
// ==========================================================

type NodeType = 'category' | 'document' | 'amendment' | 'election' | 'snapshot' | 'policy' | 'receipt'

interface GNode {
  id: string
  type: NodeType
  label: string
  sub?: string
  color: string
  size: number
  pos: THREE.Vector3
  route?: string
  categoryId: string
  voteState?: 'active' | 'historical'
  voteCount?: number
}

interface GEdge { a: string; b: string; kind: string }
type GraphLayout = 'standalone' | 'primary' | 'combined'

const typeLabels: Record<NodeType, { ru: string; en: string }> = {
  category: { ru: 'категория', en: 'category' },
  document: { ru: 'документ', en: 'document' },
  amendment: { ru: 'поправка', en: 'amendment' },
  election: { ru: 'голосование', en: 'election' },
  snapshot: { ru: 'снимок', en: 'snapshot' },
  policy: { ru: 'политика', en: 'policy' },
  receipt: { ru: 'квитанция', en: 'receipt' },
}

function seededRand(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export default function Graph({ layout = 'standalone', spaceId = 'all', documentIds }: { layout?: GraphLayout; spaceId?: string; documentIds?: string[] }) {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const { s } = useSettings()
  const docs = useDocuments()
  const nav = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<GNode | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'3d' | 'list'>('3d')
  const apiRef = useRef<{ center: (id: string) => void; reset: () => void } | null>(null)
  const dataLang = s.dataLanguage === 'auto' ? lang : s.dataLanguage
  const space = state.graphSpaces.find((item) => item.id === spaceId) ?? state.graphSpaces[0]
  const visibleDocs = useMemo(
    () => {
      const inSpace = space?.id === 'all' ? docs : docs.filter((document) => space?.documentIds.includes(document.id))
      return documentIds ? inSpace.filter((document) => documentIds.includes(document.id)) : inSpace
    },
    [docs, documentIds, space],
  )

  // ---------- построение графа ----------
  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = []
    const edges: GEdge[] = []
    const pick = (value: { ru: string; en: string }) => value[lang]
    const rand = seededRand(99)
    const R = 34
    const catIds = state.categories.map((c) => c.id)

    state.categories.forEach((cat, ci) => {
      const angle = (ci / catIds.length) * Math.PI * 2
      const hub = new THREE.Vector3(Math.cos(angle) * R, (rand() - 0.5) * 6, Math.sin(angle) * R)
      nodes.push({
        id: cat.id, type: 'category', label: pick(cat.name), color: cat.color,
        size: 3.4, pos: hub, categoryId: cat.id, route: '/elections',
        sub: `policy v${cat.policy.policyVersion}`,
      })
      // узел политики
      const polPos = hub.clone().add(new THREE.Vector3((rand() - 0.5) * 8, 6 + rand() * 3, (rand() - 0.5) * 8))
      nodes.push({
        id: `${cat.id}-policy`, type: 'policy', label: `policy v${cat.policy.policyVersion}`,
        sub: pick(cat.name), color: cat.color, size: 1.6, pos: polPos, categoryId: cat.id, route: '/admin',
      })
      edges.push({ a: cat.id, b: `${cat.id}-policy`, kind: 'HAS_POLICY' })

      const catDocs = visibleDocs.filter((d) => d.categoryId === cat.id)
      catDocs.forEach((d, di) => {
        const documentElections = state.elections.filter((election) => election.documentId === d.id)
        const activeDocumentVote = documentElections.some((election) => election.status === 'active')
        const da = angle + (di - (catDocs.length - 1) / 2) * 0.5
        const dpos = new THREE.Vector3(
          Math.cos(da) * (R + 11), hub.y + (rand() - 0.5) * 5, Math.sin(da) * (R + 11),
        )
        nodes.push({
          id: d.id, type: 'document', label: pick(d.title), sub: pick(groupNames[d.group]),
          color: groupColors[d.group], size: 2.6, pos: dpos, categoryId: cat.id,
          route: `/documents/${d.id}`,
          voteState: documentElections.length > 0 ? (activeDocumentVote ? 'active' : 'historical') : undefined,
          voteCount: documentElections.length,
        })
        edges.push({ a: cat.id, b: d.id, kind: 'CONTAINS' })

        d.clauses.filter((c) => c.amendment && c.amendment.electionId).forEach((c, ai) => {
          const am = c.amendment!
          const apos = dpos.clone().add(new THREE.Vector3(
            (rand() - 0.5) * 7, 4 + ai * 3.4, (rand() - 0.5) * 7,
          ))
          nodes.push({
            id: am.id, type: 'amendment', label: `§ ${c.num} · ${pick(c.title)}`,
            sub: pick(d.title), color: groupColors[d.group], size: 1.7, pos: apos,
            categoryId: cat.id, route: `/elections/${am.electionId}`,
          })
          edges.push({ a: d.id, b: am.id, kind: 'CONTAINS' })

          const e = state.elections.find((x) => x.id === am.electionId)
          const amendmentVoteState = e ? (e.status === 'active' ? 'active' : 'historical') : undefined
          const amendmentNode = nodes.find((node) => node.id === am.id)
          if (amendmentNode) amendmentNode.voteState = amendmentVoteState
          if (e) {
            const epos = apos.clone().add(new THREE.Vector3((rand() - 0.5) * 6, 4.5, (rand() - 0.5) * 6))
            nodes.push({
              id: e.id, type: 'election', label: pick(e.title), sub: e.id,
              color: e.status === 'active' ? '#00A9BD' : e.status === 'passed' ? '#679B1E' : e.status === 'rejected' ? '#E64232' : '#66716D',
              size: 2.1, pos: epos, categoryId: cat.id, route: `/elections/${e.id}`,
              voteState: e.status === 'active' ? 'active' : 'historical', voteCount: 1,
            })
            edges.push({ a: am.id, b: e.id, kind: 'GOVERNED_BY' })

            const snap = state.snapshots.find((sn) => sn.id === e.snapshotId)
            if (snap) {
              const spos = epos.clone().add(new THREE.Vector3((rand() - 0.5) * 5, 3.6, (rand() - 0.5) * 5))
              nodes.push({
                id: `snap-${snap.id}`, type: 'snapshot', label: `snapshot #${snap.id}`,
                sub: `policy v${snap.policyVersion}`, color: '#66716D', size: 1.4, pos: spos,
                categoryId: cat.id, route: `/elections/${e.id}`,
                voteState: e.status === 'active' ? 'active' : 'historical', voteCount: 1,
              })
              edges.push({ a: e.id, b: `snap-${snap.id}`, kind: 'FREEZES' })
              edges.push({ a: `snap-${snap.id}`, b: `${cat.id}-policy`, kind: 'USES' })
            }

            state.receipts.filter((r) => r.electionId === e.id).forEach((r, ri) => {
              const rpos = epos.clone().add(new THREE.Vector3((rand() - 0.5) * 6, -3 - ri * 1.6, (rand() - 0.5) * 6))
              nodes.push({
                id: r.id, type: 'receipt', label: `receipt ${r.id}`, sub: r.txHash,
                color: '#B9DB00', size: 1.1, pos: rpos, categoryId: cat.id,
                route: `/elections/${e.id}`,
              })
              edges.push({ a: r.id, b: e.id, kind: 'PROVES' })
            })
          }
        })
      })
    })
    state.graphRelations.forEach((relation) => {
      if (nodes.some((node) => node.id === relation.fromDocumentId) && nodes.some((node) => node.id === relation.toDocumentId)) {
        edges.push({ a: relation.fromDocumentId, b: relation.toDocumentId, kind: pick(relation.label).toUpperCase() })
      }
    })
    return { nodes, edges }
  }, [state, visibleDocs, lang])

  // ---------- three.js сцена ----------
  useEffect(() => {
    if (mode !== '3d') return
    const wrap = wrapRef.current
    if (!wrap) return

    const scene = new THREE.Scene()
    const dark = document.documentElement.dataset.theme === 'dark'
    const sceneColor = dark ? '#111715' : '#dfe6e2'
    scene.background = new THREE.Color(sceneColor)
    scene.fog = new THREE.Fog(sceneColor, 90, 200)

    const initialRect = wrap.getBoundingClientRect()
    const initialWidth = Math.max(1, Math.floor(initialRect.width))
    const initialHeight = Math.max(1, Math.floor(initialRect.height))
    const camera = new THREE.PerspectiveCamera(55, initialWidth / initialHeight, 0.1, 500)
    camera.position.set(0, 30, 86)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(initialWidth, initialHeight)
    wrap.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight('#ffffff', '#8fa39a', 1.15))
    const dir = new THREE.DirectionalLight('#fff5ec', 0.8)
    dir.position.set(30, 50, 20)
    scene.add(dir)

    const group = new THREE.Group()
    scene.add(group)

    const starPositions = new Float32Array(260 * 3)
    for (let i = 0; i < 260; i += 1) {
      starPositions[i * 3] = ((i * 47) % 197 - 98) * 0.86
      starPositions[i * 3 + 1] = ((i * 83) % 89 - 26) * 0.72
      starPositions[i * 3 + 2] = ((i * 61) % 193 - 96) * 0.86
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: dark ? '#4eb8c4' : '#7da6a2', size: 0.22, transparent: true, opacity: dark ? 0.34 : 0.2 }))
    scene.add(stars)

    // сетка-пол в духе конструктивизма
    const grid = new THREE.GridHelper(220, 34, dark ? '#285057' : '#a8bbb5', dark ? '#20332f' : '#cfd8d2')
    grid.position.y = -26
    group.add(grid)

    // узлы
    const meshes = new Map<string, THREE.Mesh>()
    const voteMarkers: { ring: THREE.Mesh; active: boolean; phase: number; glow?: THREE.Sprite; glowSize?: number }[] = []
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = 128; glowCanvas.height = 128
    const glowCtx = glowCanvas.getContext('2d')!
    const glowGradient = glowCtx.createRadialGradient(64, 64, 4, 64, 64, 62)
    glowGradient.addColorStop(0, 'rgba(255,255,255,0.72)')
    glowGradient.addColorStop(0.22, 'rgba(255,255,255,0.24)')
    glowGradient.addColorStop(1, 'rgba(255,255,255,0)')
    glowCtx.fillStyle = glowGradient
    glowCtx.fillRect(0, 0, 128, 128)
    const glowTexture = new THREE.CanvasTexture(glowCanvas)
    nodes.forEach((n) => {
      const geo = n.type === 'category'
        ? new THREE.OctahedronGeometry(n.size, 0)
        : n.type === 'document'
          ? new THREE.IcosahedronGeometry(n.size, 1)
          : n.type === 'election' && n.voteState === 'active'
            ? new THREE.CylinderGeometry(n.size * 0.92, n.size * 0.92, n.size * 0.55, 6)
          : n.type === 'election'
            ? new THREE.BoxGeometry(n.size * 1.35, n.size * 0.38, n.size * 1.35)
        : n.type === 'snapshot'
          ? new THREE.BoxGeometry(n.size * 1.4, n.size * 1.4, n.size * 1.4)
          : new THREE.SphereGeometry(n.size, 20, 16)
      const activeElection = n.type === 'election' && n.voteState === 'active'
      const mat = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: activeElection ? n.color : '#000000',
        emissiveIntensity: activeElection ? 0.28 : 0,
        metalness: activeElection ? 0.42 : 0.08,
        roughness: activeElection ? 0.36 : 0.72,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(n.pos)
      mesh.userData.nodeId = n.id
      group.add(mesh)
      meshes.set(n.id, mesh)

      if (n.voteState && (n.type === 'document' || n.type === 'amendment' || n.type === 'election')) {
        const active = n.voteState === 'active'
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(n.size * (n.type === 'document' ? 1.55 : 1.35), active ? 0.075 : 0.035, 8, 40),
          new THREE.MeshBasicMaterial({ color: active ? '#20d8ea' : '#8b72b6', transparent: true, opacity: active ? 0.82 : 0.34, blending: active ? THREE.AdditiveBlending : THREE.NormalBlending }),
        )
        ring.rotation.x = Math.PI / 2
        ring.rotation.z = (n.id.length % 7) * 0.12
        ring.position.copy(n.pos)
        group.add(ring)
        let glow: THREE.Sprite | undefined
        if (active) {
          glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#20d8ea', transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }))
          glow.position.copy(n.pos)
          glow.scale.set(n.size * 4.8, n.size * 4.8, 1)
          group.add(glow)
        }
        voteMarkers.push({ ring, active, phase: (n.id.length % 9) * 0.44, glow, glowSize: n.size * 4.8 })
      }
    })

    // рёбра
    const edgeGeo = new THREE.BufferGeometry()
    const positions: number[] = []
    edges.forEach((e) => {
      const a = nodeById.get(e.a); const b = nodeById.get(e.b)
      if (!a || !b) return
      positions.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z)
    })
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const edgeLines = new THREE.LineSegments(
      edgeGeo, new THREE.LineBasicMaterial({ color: dark ? '#4d746d' : '#91a49d', transparent: true, opacity: dark ? 0.48 : 0.55 }),
    )
    group.add(edgeLines)

    const liveEdgePositions: number[] = []
    edges.forEach((edge) => {
      const a = nodeById.get(edge.a); const b = nodeById.get(edge.b)
      if (!a || !b || (a.voteState !== 'active' && b.voteState !== 'active')) return
      liveEdgePositions.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z)
    })
    const liveEdgeGeometry = new THREE.BufferGeometry()
    liveEdgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(liveEdgePositions, 3))
    group.add(new THREE.LineSegments(liveEdgeGeometry, new THREE.LineBasicMaterial({ color: '#20d8ea', transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending })))

    // подсветка связей выбранного узла
    const hlGeo = new THREE.BufferGeometry()
    const hlLines = new THREE.LineSegments(
      hlGeo, new THREE.LineBasicMaterial({ color: '#00A9BD', linewidth: 2 }),
    )
    group.add(hlLines)

    // подписи категорий (спрайты)
    nodes.filter((n) => n.type === 'category').forEach((n) => {
      const canvas = document.createElement('canvas')
      canvas.width = 512; canvas.height = 96
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 44px Fira Sans, sans-serif'
      ctx.fillStyle = dark ? '#edf3ef' : '#111816'
      ctx.textAlign = 'center'
      ctx.fillText(n.label.toUpperCase(), 256, 60)
      const tex = new THREE.CanvasTexture(canvas)
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
      spr.scale.set(22, 4.1, 1)
      spr.position.copy(n.pos).add(new THREE.Vector3(0, n.size + 3.4, 0))
      group.add(spr)
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.maxDistance = 180
    controls.minDistance = 12

    // выбор узла
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downAt = 0
    const onDown = () => { downAt = Date.now() }
    const onUp = (ev: PointerEvent) => {
      if (Date.now() - downAt > 250) return // это было вращение
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObjects([...meshes.values()])
      if (hits.length > 0) {
        const id = hits[0].object.userData.nodeId as string
      selectNode(id, false)
        sound.play('graphSelect')
      }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    let targetLerp: THREE.Vector3 | null = null

    function selectNode(id: string, shouldCenter = false) {
      const n = nodeById.get(id)
      if (!n) return
      setSelected(n)
      // подсветка связей
      const pts: number[] = []
      edges.forEach((e) => {
        if (e.a !== id && e.b !== id) return
        const a = nodeById.get(e.a)!; const b = nodeById.get(e.b)!
        pts.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z)
      })
      hlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      hlGeo.attributes.position.needsUpdate = true
      // плавное центрирование
      if (shouldCenter) targetLerp = n.pos.clone()
      // масштаб выбранного
      meshes.forEach((m, mid) => m.scale.setScalar(mid === id ? 1.5 : 1))
    }

    apiRef.current = {
      center: (id: string) => selectNode(id, true),
      reset: () => {
        setSelected(null)
        hlGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
        meshes.forEach((m) => m.scale.setScalar(1))
        targetLerp = new THREE.Vector3(0, 0, 0)
        camera.position.set(0, 30, 86)
      },
    }

    // медленный автодрейф (отключается reduced motion)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const drift = !prefersReduced && !s.reducedMotion

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (drift && !controls.enabled) group.rotation.y += 0.0004
      if (drift) group.rotation.y += 0.00035
      if (targetLerp) {
        controls.target.lerp(targetLerp, 0.06)
        if (controls.target.distanceTo(targetLerp) < 0.05) targetLerp = null
      }
      const now = performance.now() * 0.001
      voteMarkers.forEach((marker) => {
        marker.ring.rotation.z += marker.active && drift ? 0.006 : 0.0015
        if (marker.active && marker.glow) {
          const pulse = 1 + Math.sin(now * 2.2 + marker.phase) * 0.08
          marker.glow.scale.set(marker.glowSize! * pulse, marker.glowSize! * pulse, 1)
          ;(marker.glow.material as THREE.SpriteMaterial).opacity = 0.28 + Math.sin(now * 2.2 + marker.phase) * 0.08
        }
      })
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width <= 0 || height <= 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(Math.floor(width), Math.floor(height))
    })
    resizeObserver.observe(wrap)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      renderer.dispose()
      wrap.removeChild(renderer.domElement)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose())
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, nodes, edges, s.reducedMotion, s.theme, state.elections])

  const matches = query.trim()
    ? nodes.filter((n) => (n.label + ' ' + (n.sub ?? '')).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  const connections = selected
    ? edges
        .filter((e) => e.a === selected.id || e.b === selected.id)
        .map((e) => ({ kind: e.kind, other: nodes.find((n) => n.id === (e.a === selected.id ? e.b : e.a))! }))
    : []

  return (
    <div className={`graph-wrap graph-wrap--${layout}`} data-graph-layout={layout} data-graph-render-mode={mode} role="region" aria-label={t('gr.title')}>
      {mode === '3d' && <div className="graph-canvas" data-graph-canvas ref={wrapRef} aria-hidden="true" />}
      <div className="sr-only">
        <h2>{t('gr.title')}</h2>
        <ul>{nodes.map((node) => <li key={node.id}>{node.label} · {typeLabels[node.type][dataLang]}</li>)}</ul>
      </div>

      <div className="graph-hud">
        {layout === 'standalone' && <div className="seg" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>{t('gr.3dView')}</button>
          <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>{t('gr.listView')}</button>
        </div>}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input
            type="search" placeholder={t('gr.searchPh')} value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%' }}
            aria-label={t('common.search')}
          />
          {matches.length > 0 && (
            <div className="panel tight" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}>
              {matches.map((m) => (
                <button
                  key={m.id}
                  className="nav-item"
                  style={{ width: '100%' }}
                  onClick={() => { apiRef.current?.center(m.id); setQuery(''); setSelected(m) }}
                >
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, flex: 'none' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.label} <span className="muted">· {typeLabels[m.type][dataLang]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn small" onClick={() => apiRef.current?.reset()}>{t('gr.reset')}</button>
      </div>

      <div className="graph-legend">
        {state.categories.map((c) => (
          <span key={c.id} className="chip" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="dot" style={{ background: c.color }} /> {l(c.name)}
          </span>
        ))}
        <span className="chip mute" title={t('gr.shapeHint')}>{nodes.length} {t('gr.nodes')} · {t('gr.drag')}</span>
        <span className="chip live"><span className="dot" /> {t('gr.activeVote')}</span>
        <span className="chip graph-history"><span className="dot" /> {t('gr.historicalVote')}</span>
      </div>

      {mode === 'list' && (
        <div style={{ position: 'absolute', inset: '70px 12px 50px', overflowY: 'auto' }}>
          <div className="grid c2">
            {state.categories.map((c) => (
              <Panel key={c.id} title={l(c.name)} tight>
                <div className="stack" style={{ gap: 4 }}>
                  {nodes.filter((n) => n.categoryId === c.id && n.type !== 'category').map((n) => (
                    <Link key={n.id} to={n.route ?? '#'} className="row" style={{ gap: 8, textDecoration: 'none', minHeight: 32 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: n.color, flex: 'none' }} />
                      <span style={{ fontSize: 13 }}>{n.label}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{typeLabels[n.type][dataLang]}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {selected && mode === '3d' && (
        <div className="graph-inspector panel">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="chip mono mute" style={{ color: selected.color, borderColor: 'currentcolor' }}>
              {typeLabels[selected.type][dataLang]}
            </span>
            <button className="icon-btn" style={{ minWidth: 32, minHeight: 32 }} onClick={() => setSelected(null)} aria-label="close">✕</button>
          </div>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>{selected.label}</h3>
          {selected.sub && <div className="mono muted" style={{ fontSize: 11.5, marginBottom: 10 }}>{selected.sub}</div>}
          <div className="row" style={{ marginBottom: 12, gap: 6 }}>
            {selected.route && (
              <button className="btn small primary" onClick={() => nav(selected.route!)}>{t('gr.openNode')} →</button>
            )}
            <button className="btn small" onClick={() => apiRef.current?.center(selected.id)}>{t('gr.center')}</button>
          </div>
          <div className="muted mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {t('gr.connections')} · {connections.length}
          </div>
          <div className="stack" style={{ gap: 3 }}>
            {connections.map((c, i) => (
              <button
                key={i}
                className="nav-item"
                style={{ width: '100%', minHeight: 34 }}
                onClick={() => apiRef.current?.center(c.other.id)}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.other.color, flex: 'none' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                  <span className="mono muted" style={{ fontSize: 10 }}>{c.kind}</span> {c.other.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
