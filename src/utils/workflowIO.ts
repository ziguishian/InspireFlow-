import { Node, Edge } from 'reactflow';
import { Workflow, WorkflowNode, WorkflowEdge } from '@/types';

/**
 * Convert React Flow nodes/edges to Workflow format
 */
export function exportWorkflow(nodes: Node[], edges: Edge[]): Workflow {
  const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type || 'default',
    label: node.data.label || '',
    inputs: [],
    outputs: [],
    params: [],
    position: node.position,
    data: node.data,
  }));

  const workflowEdges: WorkflowEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || '',
    targetHandle: edge.targetHandle || '',
  }));

  return {
    nodes: workflowNodes,
    edges: workflowEdges,
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    },
  };
}

/**
 * Convert Workflow format to React Flow nodes/edges
 */
export function importWorkflow(workflow: Workflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      label: node.label,
      ...node.data,
    },
  }));

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));

  return { nodes, edges };
}

/**
 * Download workflow as JSON file
 */
export function downloadWorkflow(workflow: Workflow, filename: string = 'workflow.json') {
  const json = JSON.stringify(workflow, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Load workflow from JSON file
 */
export function loadWorkflowFromFile(file: File): Promise<Workflow> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string) as Workflow;
        resolve(workflow);
      } catch (error) {
        reject(new Error('Invalid workflow file format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
