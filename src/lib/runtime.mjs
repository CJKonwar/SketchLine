export function isPublicWorkspace(hostname,mode){
 return mode==='public'||!['localhost','127.0.0.1','[::1]','::1'].includes(hostname);
}
export function workspaceStorageKey(isPublic){return isPublic?'sketchline-public-workspace-v1':'sketchline-workspace-v1';}
