// Quest Flow Graph - draws edges between quest nodes with bezier curves
const QuestFlowGraph = {
  mounted() {
    // Read edge colors from CSS custom properties
    const styles = getComputedStyle(document.documentElement)
    this.edgeColor = styles.getPropertyValue('--wb-quest-edge').trim() || '#666666'
    this.edgePrereqColor = styles.getPropertyValue('--wb-quest-edge-prereq').trim() || '#f59e0b'
    this.edgeUnlockColor = styles.getPropertyValue('--wb-quest-edge-unlock').trim() || '#22c55e'
    console.log('[QuestFlowGraph] Edge colors loaded from CSS variables')

    this.drawEdges()
    // Event delegation for SVG path hover effects (avoids per-path listener leaks)
    const svg = this.el.querySelector('.quest-graph-edges')
    if (svg) {
      this.svgEnterHandler = (e) => {
        if (e.target.tagName === 'path') e.target.setAttribute('stroke-width', '3')
      }
      this.svgLeaveHandler = (e) => {
        if (e.target.tagName === 'path') e.target.setAttribute('stroke-width', '2')
      }
      svg.addEventListener('mouseenter', this.svgEnterHandler, true)
      svg.addEventListener('mouseleave', this.svgLeaveHandler, true)
    }
  },

  updated() {
    this.drawEdges()
  },

  drawEdges() {
    try {
      const nodes = JSON.parse(this.el.dataset.nodes || '[]')
      const edges = JSON.parse(this.el.dataset.edges || '[]')
      const svg = this.el.querySelector('.quest-graph-edges')
      if (!svg) return

      // Clear existing edges
      svg.innerHTML = ''

      // Create node position map with bounds for collision avoidance
      const nodePositions = {}
      const nodeBounds = {}
      const nodeWidth = 160
      const nodeHeight = 60

      nodes.forEach(node => {
        nodePositions[node.id] = {
          x: node.x + nodeWidth / 2,  // Center of node
          y: node.y + nodeHeight / 2   // Center of node
        }
        nodeBounds[node.id] = {
          left: node.x,
          right: node.x + nodeWidth,
          top: node.y,
          bottom: node.y + nodeHeight
        }
      })

      // Add arrowhead marker definition first
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      defs.innerHTML = `
        <marker id="arrowhead" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="${this.edgeColor}" />
        </marker>
        <marker id="arrowhead-prereq" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="${this.edgePrereqColor}" />
        </marker>
        <marker id="arrowhead-unlock" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="${this.edgeUnlockColor}" />
        </marker>
      `
      svg.appendChild(defs)

      // Draw edges as bezier curves
      edges.forEach(edge => {
        const from = nodePositions[edge.from]
        const to = nodePositions[edge.to]
        if (!from || !to) return

        // Calculate connection points on node edges
        const { startPoint, endPoint } = this.getConnectionPoints(from, to, nodeBounds[edge.from], nodeBounds[edge.to])

        // Calculate control points for bezier curve
        const controlPoints = this.calculateControlPoints(startPoint, endPoint, nodes, nodeBounds, edge.from, edge.to)

        // Create bezier path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const d = `M ${startPoint.x} ${startPoint.y} C ${controlPoints.cp1.x} ${controlPoints.cp1.y}, ${controlPoints.cp2.x} ${controlPoints.cp2.y}, ${endPoint.x} ${endPoint.y}`
        path.setAttribute('d', d)
        path.setAttribute('fill', 'none')

        // Color based on edge type
        const edgeColor = edge.type === 'prerequisite' ? this.edgePrereqColor :
                         edge.type === 'unlocks' ? this.edgeUnlockColor : this.edgeColor
        const markerId = edge.type === 'prerequisite' ? 'arrowhead-prereq' :
                        edge.type === 'unlocks' ? 'arrowhead-unlock' : 'arrowhead'

        path.setAttribute('stroke', edgeColor)
        path.setAttribute('stroke-width', '2')
        path.setAttribute('marker-end', `url(#${markerId})`)

        // Hover effects handled by delegated SVG listeners (mounted)
        path.style.transition = 'stroke-width 0.2s ease'

        svg.appendChild(path)
      })

    } catch (e) {
      console.error('[QuestFlowGraph] Error drawing edges:', e)
    }
  },

  // Calculate where the edge should connect to the node boundaries
  getConnectionPoints(from, to, fromBounds, toBounds) {
    const dx = to.x - from.x
    const dy = to.y - from.y

    // Determine which side of the node to connect from/to
    let startPoint, endPoint

    // Start point - exit from the appropriate side of the source node
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant - exit from left or right
      if (dx > 0) {
        startPoint = { x: fromBounds.right, y: from.y }
        endPoint = { x: toBounds.left - 10, y: to.y } // -10 for arrow space
      } else {
        startPoint = { x: fromBounds.left, y: from.y }
        endPoint = { x: toBounds.right + 10, y: to.y }
      }
    } else {
      // Vertical dominant - exit from top or bottom
      if (dy > 0) {
        startPoint = { x: from.x, y: fromBounds.bottom }
        endPoint = { x: to.x, y: toBounds.top - 10 }
      } else {
        startPoint = { x: from.x, y: fromBounds.top }
        endPoint = { x: to.x, y: toBounds.bottom + 10 }
      }
    }

    return { startPoint, endPoint }
  },

  // Calculate bezier control points, avoiding other nodes where possible
  calculateControlPoints(start, end, nodes, nodeBounds, fromId, toId) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Base curve tension - how much the curve bends
    const tension = Math.min(distance * 0.4, 100)

    // Determine curve direction based on relative positions
    let cp1, cp2

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal flow - curve vertically to avoid nodes
      const curveDirection = this.findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId)

      cp1 = {
        x: start.x + dx * 0.3,
        y: start.y + curveDirection * tension * 0.5
      }
      cp2 = {
        x: end.x - dx * 0.3,
        y: end.y + curveDirection * tension * 0.5
      }
    } else {
      // Vertical flow - curve horizontally to avoid nodes
      const curveDirection = this.findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId, true)

      cp1 = {
        x: start.x + curveDirection * tension * 0.5,
        y: start.y + dy * 0.3
      }
      cp2 = {
        x: end.x + curveDirection * tension * 0.5,
        y: end.y - dy * 0.3
      }
    }

    return { cp1, cp2 }
  },

  // Find the best direction to curve to avoid overlapping nodes
  findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId, isVertical = false) {
    // Check if there are nodes in the path that we should avoid
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2

    let positiveScore = 0  // Score for curving in positive direction
    let negativeScore = 0  // Score for curving in negative direction

    for (const node of nodes) {
      if (node.id === fromId || node.id === toId) continue

      const bounds = nodeBounds[node.id]
      if (!bounds) continue

      // Check if node is roughly in the path
      const nodeCenter = {
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2
      }

      // Simple proximity check
      const distToMid = Math.sqrt(
        Math.pow(nodeCenter.x - midX, 2) +
        Math.pow(nodeCenter.y - midY, 2)
      )

      if (distToMid < 150) {  // Node is nearby
        if (isVertical) {
          // For vertical flow, check horizontal position
          if (nodeCenter.x > midX) {
            negativeScore += 1  // Curve left to avoid
          } else {
            positiveScore += 1  // Curve right to avoid
          }
        } else {
          // For horizontal flow, check vertical position
          if (nodeCenter.y > midY) {
            negativeScore += 1  // Curve up to avoid
          } else {
            positiveScore += 1  // Curve down to avoid
          }
        }
      }
    }

    // Return direction based on scores (slight preference for positive to create consistent curves)
    if (negativeScore > positiveScore) {
      return -1
    } else if (positiveScore > negativeScore) {
      return 1
    }

    // Default: slight curve based on start/end relationship for visual consistency
    return isVertical ? (start.x < end.x ? 1 : -1) : (start.y < end.y ? 1 : -1)
  },

  destroyed() {
    const svg = this.el.querySelector('.quest-graph-edges')
    if (svg) {
      if (this.svgEnterHandler) svg.removeEventListener('mouseenter', this.svgEnterHandler, true)
      if (this.svgLeaveHandler) svg.removeEventListener('mouseleave', this.svgLeaveHandler, true)
      svg.innerHTML = ''
    }
  }
}

export default QuestFlowGraph
