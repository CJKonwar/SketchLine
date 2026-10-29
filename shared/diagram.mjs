export const MAX_NODES = 40;
export const diagramSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, summary: { type: 'string' }, kind: { type: 'string', enum: ['flowchart', 'mindmap'] },
    nodes: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, label: { type: 'string' }, description: { type: 'string' }, kind: { type: 'string', enum: ['process', 'decision', 'start', 'end', 'topic'] } }, required: ['id', 'label', 'description', 'kind'] } },
    edges: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { source: { type: 'string' }, target: { type: 'string' }, label: { type: 'string' } }, required: ['source', 'target', 'label'] } }
  }, required: ['title', 'summary', 'kind', 'nodes', 'edges']
};
export function validateGraph(input, { allowEmpty = false } = {}) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) throw new Error('A diagram needs nodes and connections.');
  if ((!allowEmpty && input.nodes.length === 0) || input.nodes.length > MAX_NODES) throw new Error(`Use between 1 and ${MAX_NODES} nodes.`);
  if (input.edges.length > 100) throw new Error('This diagram has too many connections.');
  const ids = new Set();
  const nodes = input.nodes.map(n => {
    if (!n || typeof n.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(n.id) || ids.has(n.id)) throw new Error('Every node needs a unique, valid ID.');
    if (typeof n.label !== 'string' || !n.label.trim() || n.label.length > 180) throw new Error('Node labels must contain 1 to 180 characters.');
    if (n.description != null && (typeof n.description !== 'string' || n.description.length > 400)) throw new Error('Node descriptions must be under 400 characters.');
    if (n.kind && !['process','decision','start','end','topic'].includes(n.kind)) throw new Error('Unsupported shape.');
    if(n.width!=null&&(!Number.isFinite(n.width)||n.width<210||n.width>600))throw new Error('Invalid diagram card width.');
    ids.add(n.id);
    return { id: n.id, label: n.label.trim(), description: n.description || '', kind: n.kind || 'process', ...(Number.isFinite(n.x) && Number.isFinite(n.y) && Math.abs(n.x) < 100000 && Math.abs(n.y) < 100000 ? { x:n.x, y:n.y } : {}), ...(typeof n.color === 'string' && /^#[0-9a-f]{6}$/i.test(n.color) ? {color:n.color}: {}),...(n.width!=null?{width:n.width}:{}) };
  });
  const edges = input.edges.map((e,i) => {
    if (!e || !ids.has(e.source) || !ids.has(e.target)) throw new Error('A connection refers to a missing node.');
    if (e.label != null && (typeof e.label !== 'string' || e.label.length > 120)) throw new Error('Connection labels must be under 120 characters.');
    let route;
    if(e.route!=null){
      const r=e.route;
      if(typeof r!=='object'||!Number.isFinite(r.center)||Math.abs(r.center)>=100000||!Number.isFinite(r.sourceLead)||r.sourceLead<8||r.sourceLead>10000||!Number.isFinite(r.targetLead)||r.targetLead<8||r.targetLead>10000)throw new Error('Invalid connection bend. Reset the line or choose a valid Sketchline backup.');
      route={center:r.center,sourceLead:r.sourceLead,targetLead:r.targetLead};
    }
    return { id: `edge-${i}-${e.source}-${e.target}`, source: e.source, target: e.target, label: e.label || '',...(route?{route}:{}) };
  });
  return { title: typeof input.title === 'string' ? input.title.slice(0,120) : 'Untitled diagram', kind: input.kind === 'mindmap' ? 'mindmap' : 'flowchart', summary: typeof input.summary === 'string' ? input.summary.slice(0,500) : '', nodes, edges };
}
const clean = s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').replace(/[.!?]$/,'').trim();
const label = s => clean(s).slice(0,100) || 'Untitled step';
export function localGenerate(text, kind = 'flowchart') {
  if (typeof text !== 'string' || text.trim().length < 8) throw new Error('Add a little more detail, at least 8 characters.');
  if (text.length > 16000) throw new Error('Please use fewer than 16,000 characters at a time.');
  const lines = text.trim().split(/\n+|(?<=[.!?])\s+/).map(clean).filter(Boolean).slice(0,18);
  const title = label(lines[0]).slice(0,65);
  if (kind === 'mindmap') {
    const nodes = [{ id:'root', label:title, description:'', kind:'topic' }]; const edges=[]; let parent='root';
    for (const [i,line] of lines.slice(1).entries()) {
      const parts=line.split(/:\s+/); const id=`n${i}`;
      nodes.push({id,label:label(parts[0]),description:parts.slice(1).join(': '),kind:'process'});edges.push({source:'root',target:id,label:''});parent=id;
    }
    if (nodes.length===1) {
      const parts=text.split(/,|;|\s+and\s+/).map(clean).filter(Boolean).slice(0,7);
      if(parts.length<2) throw new Error('For a local mind map, add a title on the first line and a few ideas on separate lines.');
      for(const [i,p] of parts.entries()){nodes.push({id:`n${i}`,label:label(p),description:'',kind:'process'});edges.push({source:'root',target:`n${i}`,label:''});}
    }
    return validateGraph({title,kind,summary:'Organized from your lines by the local generator.',nodes,edges});
  }
  const nodes=[];const edges=[];let previous=null;let branchPoint=null;
  function add(s,shape='process',from=previous,edgeLabel='') {
    const parts=s.split(/:\s+/);const n={id:`n${nodes.length+1}`,label:label(parts[0]),description:parts.slice(1).join(': ').slice(0,400),kind:shape};nodes.push(n);
    if(from)edges.push({source:from,target:n.id,label:edgeLabel});previous=n.id;return n.id;
  }
  for(const line of lines) {
    const otherwise=line.match(/^(?:otherwise|else|if not|if rejected|if no)\s*[:,]?\s*(.+)$/i);
    const conditional=line.match(/^if\s+(.+?)\s*[:,]\s*(.+)$/i);
    if(otherwise && branchPoint){let from=branchPoint;for(const [i,s] of otherwise[1].split(/\s*(?:→|->)\s*/).entries()){from=add(s,'process',from,i===0?'No':'');}continue;}
    if(conditional){branchPoint=add(conditional[1].replace(/^(?:it is|the item is)\s+/i,'')+'?','decision');let from=branchPoint;for(const [i,s] of conditional[2].split(/\s*(?:→|->)\s*/).entries()){from=add(s,'process',from,i===0?'Yes':'');}continue;}
    for(const s of line.split(/\s*(?:→|->)\s*/))add(s,/\?$|^(?:check|decide|is |does |whether)/i.test(s)?'decision':nodes.length===0?'start':'process');
  }
  return validateGraph({title,kind,summary:'A basic sequence built from your sentences. Use AI for deeper interpretation.',nodes,edges});
}
export const SAMPLE_TEXT = 'A customer submits an order.\nIf the item is in stock: Pack the order → Ship the order.\nOtherwise: Notify the customer.';
export const EXAMPLES = [
 {title:'Order review',kind:'flowchart',text:SAMPLE_TEXT},
 {title:'A creative process',kind:'flowchart',text:'Collect ideas\nExplore a few directions\nCreate the first draft\nIf the draft is approved: Refine the details → Publish the work\nOtherwise: Revisit the concept'},
 {title:'Plan a side project',kind:'mindmap',text:'My next side project\nThe idea: A useful problem to solve\nPeople: Who will use it and why\nDesign: Sketch the essential screens\nBuild: A small first version\nLaunch: Share it and collect feedback'},
 {title:'Morning routine',kind:'flowchart',text:'Wake up\nDrink a glass of water\nMove and stretch\nWrite down three priorities\nBegin the most important task'}
];
