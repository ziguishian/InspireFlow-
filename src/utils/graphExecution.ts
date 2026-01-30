import { Node, Edge } from 'reactflow';

/**
 * Topological sort algorithm to determine execution order
 * Returns nodes in order of execution (dependencies first)
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize in-degree for all nodes
  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });

  // Build adjacency list and calculate in-degrees
  edges.forEach((edge) => {
    const targetId = edge.target;
    const sourceId = edge.source;
    
    const currentInDegree = inDegree.get(targetId) || 0;
    inDegree.set(targetId, currentInDegree + 1);

    const neighbors = adjacencyList.get(sourceId) || [];
    neighbors.push(targetId);
    adjacencyList.set(sourceId, neighbors);
  });

  // Find all nodes with no incoming edges (sources)
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const result: Node[] = [];

  // Process nodes
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      result.push(node);
    }

    const neighbors = adjacencyList.get(nodeId) || [];
    neighbors.forEach((neighborId) => {
      const currentInDegree = inDegree.get(neighborId) || 0;
      inDegree.set(neighborId, currentInDegree - 1);
      
      if (inDegree.get(neighborId) === 0) {
        queue.push(neighborId);
      }
    });
  }

  // Check for cycles
  if (result.length !== nodes.length) {
    throw new Error('Circular dependency detected in workflow graph');
  }

  return result;
}

/**
 * Get input values for a node from connected edges
 * Supports multiple inputs to the same handle by combining them into arrays
 */
export function getNodeInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): Record<string, any> {
  const inputs: Record<string, any> = {};
  
  // 获取所有连接到目标节点的边
  const targetEdges = edges.filter((edge) => edge.target === nodeId);
  
  console.log(`[getNodeInputs] 节点 ${nodeId} 的输入边:`, targetEdges.map(e => ({
    source: e.source,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  })));
  
  targetEdges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const outputKey = edge.sourceHandle;
    if (sourceNode && outputKey != null) {
      // Get output from source node based on sourceHandle
      const targetHandle = edge.targetHandle || 'default';
      const value = sourceNode.data[outputKey];
      
      console.log(`[getNodeInputs] 处理边:`, {
        source: edge.source,
        sourceHandle: outputKey,
        targetHandle: targetHandle,
        valueType: typeof value,
        valueIsArray: Array.isArray(value),
        hasValue: value !== undefined && value !== null,
      });
      
      // If this handle already has a value, combine them into an array
      if (inputs[targetHandle] !== undefined) {
        const existingValue = inputs[targetHandle];
        console.log(`[getNodeInputs] 合并到现有值:`, {
          targetHandle,
          existingType: typeof existingValue,
          existingIsArray: Array.isArray(existingValue),
          newValueType: typeof value,
        });
        if (Array.isArray(existingValue)) {
          // Already an array, add to it
          existingValue.push(value);
          console.log(`[getNodeInputs] 添加到数组后:`, {
            targetHandle,
            arrayLength: existingValue.length,
          });
        } else {
          // Convert to array
          inputs[targetHandle] = [existingValue, value];
          console.log(`[getNodeInputs] 转换为数组后:`, {
            targetHandle,
            arrayLength: inputs[targetHandle].length,
            arrayIsArray: Array.isArray(inputs[targetHandle]),
          });
        }
      } else {
        // First value for this handle
        inputs[targetHandle] = value;
      }
    }
  });

  console.log(`[getNodeInputs] 节点 ${nodeId} 的最终输入:`, Object.keys(inputs).map(key => ({
    key,
    type: typeof inputs[key],
    isArray: Array.isArray(inputs[key]),
    length: Array.isArray(inputs[key]) ? inputs[key].length : (inputs[key] ? 1 : 0),
  })));
  
  // 特别检查 image 输入
  if (inputs.image !== undefined) {
    console.log(`[getNodeInputs] 节点 ${nodeId} 的 image 输入详情:`, {
      value: inputs.image,
      type: typeof inputs.image,
      isArray: Array.isArray(inputs.image),
      length: Array.isArray(inputs.image) ? inputs.image.length : 1,
      firstValuePreview: Array.isArray(inputs.image) 
        ? inputs.image[0]?.substring?.(0, 50) 
        : inputs.image?.substring?.(0, 50),
    });
  }

  return inputs;
}
