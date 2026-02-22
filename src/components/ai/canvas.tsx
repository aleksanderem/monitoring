"use client"

import { Background, ReactFlow, type ReactFlowProps } from "@xyflow/react"
import type { ReactNode } from "react"
import "@xyflow/react/dist/style.css"

type CanvasProps = ReactFlowProps & {
  children?: ReactNode
  bgColor?: string
}

export const Canvas = ({ children, bgColor = "var(--sidebar)", ...props }: CanvasProps) => (
  <ReactFlow
    deleteKeyCode={["Backspace", "Delete"]}
    fitView
    panOnDrag={false}
    panOnScroll
    selectionOnDrag={false}
    zoomOnDoubleClick={false}
    {...props}
  >
    <Background bgColor={bgColor} />
    {children}
  </ReactFlow>
)
