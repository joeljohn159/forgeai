// ============================================================
// Dashboard HTML Template
// Self-contained interactive project visualizer
// No external dependencies — everything is inline
// ============================================================

import type { ProjectGraph } from "./scanner.js";

export function generateDashboardHTML(graph: ProjectGraph, projectName: string, prevGraph?: ProjectGraph | null, projectRoot?: string): string {
  const dataJson = JSON.stringify(graph);
  const prevDataJson = prevGraph ? JSON.stringify(prevGraph) : 'null';
  const rootPath = projectRoot ? escapeHtml(projectRoot) : '';
  const hs = graph.healthScore;
  const gradeColor = hs.grade === 'A' ? '#34d399' : hs.grade === 'B' ? '#60a5fa' : hs.grade === 'C' ? '#fbbf24' : hs.grade === 'D' ? '#fb923c' : hs.grade === 'F' ? '#f87171' : '#6b7280';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(projectName)} — Project Map</title>
<style>
${CSS}
</style>
</head>
<body>
<div id="app">
  <!-- Header -->
  <header id="header">
    <div class="header-left">
      <h1>${escapeHtml(projectName)}</h1>
      <span class="badge">${graph.framework}</span>
      <span class="health-badge" style="background:${gradeColor}20;color:${gradeColor};border:1px solid ${gradeColor}40" title="Health Score: ${hs.score}/100">${hs.grade}</span>
      <span class="divider"></span>
      <span class="stat">${graph.totalFiles} files</span>
      <span class="stat">${formatNumber(graph.totalLines)} lines</span>
    </div>
    <div class="header-right">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="search" placeholder="Search files... ( / )" autocomplete="off">
      </div>
      <div class="view-toggles">
        <button class="view-btn active" data-view="overview">Overview</button>
        <button class="view-btn" data-view="architecture">Architecture</button>
        <button class="view-btn" data-view="map">System Map</button>
        <button class="view-btn" data-view="list">Files</button>${graph.apiDocs.length > 0 ? `
        <button class="view-btn" data-view="apidocs">API Docs</button>` : ''}${prevGraph ? `
        <button class="view-btn" data-view="diff">Diff</button>` : ''}
      </div>
    </div>
  </header>

  <!-- Language Bar -->
  <div id="lang-bar">
    ${Object.entries(graph.languages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, lines]) => {
        const pct = ((lines / graph.totalLines) * 100).toFixed(1);
        return `<div class="lang-segment" style="flex:${lines}" title="${lang}: ${formatNumber(lines)} lines (${pct}%)">
          <span class="lang-label">${lang} ${pct}%</span>
        </div>`;
      })
      .join("")}
  </div>

  <!-- Main Content -->
  <div id="content">
    <!-- Sidebar -->
    <aside id="sidebar">
      <div class="sidebar-section" id="category-tree"></div>
      ${graph.apiRoutes.length > 0 ? `
      <div class="sidebar-section">
        <h3>API Routes</h3>
        <div id="api-routes">
          ${graph.apiRoutes.map((r) => `
            <div class="route-item">
              <span class="method method-${r.method.toLowerCase()}">${r.method}</span>
              <span class="route-path">${escapeHtml(r.path)}</span>
            </div>
          `).join("")}
        </div>
      </div>` : ""}
    </aside>

    <!-- Main Panel -->
    <main id="main-panel">
      <!-- Overview -->
      <div id="overview-view" class="view active-view">
        <div id="overview-container"></div>
      </div>

      <!-- Architecture -->
      <div id="architecture-view" class="view">
        <div id="arch-container"></div>
      </div>

      <!-- System Map -->
      <div id="map-view" class="view">
        <div id="sysmap-container"></div>
      </div>

      <!-- File List -->
      <div id="list-view" class="view">
        <div id="file-list"></div>
      </div>

      <!-- API Docs -->
      <div id="apidocs-view" class="view">
        <div id="apidocs-container"></div>
      </div>

      <!-- Diff View -->
      <div id="diff-view" class="view">
        <div id="diff-container"></div>
      </div>
    </main>

    <!-- Detail Panel -->
    <aside id="detail-panel" class="hidden">
      <button id="close-detail">&times;</button>
      <div id="detail-content"></div>
    </aside>
  </div>
</div>

<script>
const DATA = ${dataJson};
const PREV = ${prevDataJson};
const PROJECT_ROOT = '${rootPath}';
${JS}
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ── Inline CSS ────────────────────────────────────────────

const CSS = `
:root {
  --bg: #0d1117;
  --surface: #161b22;
  --surface-hover: #1c2128;
  --surface-raised: #1f2937;
  --border: #21262d;
  --border-light: #30363d;
  --text: #e6edf3;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --accent: #60a5fa;
  --accent-dim: rgba(96,165,250,0.12);
  --green: #34d399;
  --green-dim: rgba(52,211,153,0.12);
  --yellow: #fbbf24;
  --yellow-dim: rgba(251,191,36,0.12);
  --red: #f87171;
  --red-dim: rgba(248,113,113,0.12);
  --purple: #a78bfa;
  --purple-dim: rgba(167,139,250,0.12);
  --orange: #fb923c;
  --cyan: #22d3ee;
  --radius: 6px;
  --radius-lg: 10px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  height: 100vh;
  -webkit-font-smoothing: antialiased;
}

#app { display: flex; flex-direction: column; height: 100vh; }

/* Header */
#header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; align-items: center; gap: 16px; }
h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.2px; }
.badge {
  background: var(--accent-dim);
  color: var(--accent);
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.divider { width: 1px; height: 16px; background: var(--border-light); }
.stat { color: var(--text-muted); font-size: 12px; font-weight: 500; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 12px;
  color: var(--text-muted);
  transition: border-color .15s;
}
.search-box:focus-within { border-color: var(--accent); }
.search-box input {
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 180px;
  font-family: inherit;
}
.search-box input::placeholder { color: var(--text-muted); }

.view-toggles {
  display: flex;
  gap: 1px;
  background: var(--border);
  border-radius: var(--radius);
  padding: 1px;
}
.view-btn {
  background: var(--bg);
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all .15s;
  font-family: inherit;
}
.view-btn:first-child { border-radius: 5px 0 0 5px; }
.view-btn:last-child { border-radius: 0 5px 5px 0; }
.view-btn:hover { color: var(--text-secondary); }
.view-btn.active { background: var(--surface); color: var(--text); }

/* Language Bar */
#lang-bar {
  display: flex;
  height: 3px;
  flex-shrink: 0;
}
.lang-segment {
  position: relative;
  min-width: 4px;
  cursor: pointer;
  transition: opacity .15s;
}
.lang-segment:nth-child(1) { background: var(--accent); }
.lang-segment:nth-child(2) { background: var(--green); }
.lang-segment:nth-child(3) { background: var(--yellow); }
.lang-segment:nth-child(4) { background: var(--purple); }
.lang-segment:nth-child(5) { background: var(--orange); }
.lang-segment:nth-child(6) { background: var(--red); }
.lang-segment:nth-child(n+7) { background: var(--text-muted); }
.lang-label {
  display: none;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface-raised);
  border: 1px solid var(--border-light);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--text);
  pointer-events: none;
  z-index: 10;
}
.lang-segment:hover .lang-label { display: block; }
.lang-segment:hover { opacity: 0.8; }

/* Content Layout */
#content { display: flex; flex: 1; overflow: hidden; }

/* Sidebar */
#sidebar {
  width: 260px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
  padding: 16px 0;
}
.sidebar-section { padding: 0 12px; margin-bottom: 20px; }
.sidebar-section h3 {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  margin-bottom: 8px;
  padding: 0 8px;
}
.category-group { margin-bottom: 2px; }
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  user-select: none;
  transition: all .1s;
}
.category-header:hover { background: var(--surface-hover); color: var(--text); }
.cat-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.category-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
}
.category-files { padding-left: 12px; }
.file-item {
  display: block;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--text-muted);
  transition: all .1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-item:hover { background: var(--surface-hover); color: var(--text-secondary); }
.file-item.selected { background: var(--accent-dim); color: var(--accent); }
.file-item .file-dir { color: var(--text-muted); opacity: 0.6; }

/* Route items */
.route-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}
.route-item:hover { background: var(--surface-hover); }
.method {
  font-size: 9px;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  padding: 2px 5px;
  border-radius: 3px;
  min-width: 34px;
  text-align: center;
  letter-spacing: 0.3px;
}
.method-get { background: var(--green-dim); color: var(--green); }
.method-post { background: var(--accent-dim); color: var(--accent); }
.method-put { background: var(--yellow-dim); color: var(--yellow); }
.method-delete { background: var(--red-dim); color: var(--red); }
.method-patch { background: var(--purple-dim); color: var(--purple); }
.method-all { background: rgba(107,114,128,0.12); color: var(--text-muted); }
.route-path { color: var(--text-muted); font-family: 'SF Mono', monospace; font-size: 11px; }

/* Main Panel */
#main-panel { flex: 1; position: relative; overflow: hidden; }
.view { display: none; width: 100%; height: 100%; }
.active-view { display: block; }

/* Overview */
#overview-container { padding: 32px; overflow: auto; height: 100%; }
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}
.insight-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
}
.insight-card h3 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.insight-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.insight-number {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -1px;
}
.insight-label { font-size: 13px; color: var(--text-muted); }
.insight-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
}
.insight-bar-name { width: 100px; color: var(--text-secondary); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.insight-bar-track { flex: 1; height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; }
.insight-bar-fill { height: 100%; border-radius: 3px; transition: width .3s; }
.insight-bar-val { width: 50px; color: var(--text-muted); font-size: 11px; }
.insight-list-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.insight-list-item:last-child { border-bottom: none; }
.insight-list-item .name { color: var(--text-secondary); font-family: 'SF Mono', monospace; font-size: 12px; }
.insight-list-item .val { color: var(--text-muted); }
.overview-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-bottom: 14px;
}

/* Architecture View */
#arch-container { padding: 32px; overflow: auto; height: 100%; }
.arch-diagram { max-width: 1000px; margin: 0 auto; }
.arch-layer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  margin-bottom: 2px;
}
.arch-layer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.arch-layer-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
}
.arch-layer-count { font-size: 11px; color: var(--text-muted); }
.arch-layer-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.arch-file {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all .15s;
  min-width: 120px;
  max-width: 220px;
}
.arch-file:hover { border-color: var(--accent); background: var(--accent-dim); }
.arch-file .arch-file-name { font-weight: 500; color: var(--text); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arch-file .arch-file-desc { font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arch-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3px 0;
  color: var(--border-light);
  gap: 12px;
}
.arch-arrow svg { width: 18px; height: 18px; }
.arch-flow-label {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}
.arch-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.arch-toggle:hover { color: var(--text-secondary); border-color: var(--border-light); }

/* System Map View */
#sysmap-container { padding: 0; overflow: hidden; height: 100%; position: relative; cursor: grab; }
#sysmap-container.grabbing { cursor: grabbing; }
#sysmap-svg { display: block; position: absolute; top: 0; left: 0; }
#sysmap-svg .sd-zone { cursor: default; }
#sysmap-svg .sd-node { cursor: pointer; }
#sysmap-svg .sd-node:hover .sd-node-bg { fill: #1c2128; stroke-width: 2; }
#sysmap-svg text { font-family: 'Inter', -apple-system, sans-serif; pointer-events: none; }
#sysmap-svg .sd-arrow { stroke: #30363d; fill: none; stroke-width: 1.5; }
#sysmap-svg .sd-arrow-head { fill: #30363d; }
#sysmap-svg .sd-arrow-label {
  fill: #9ca3af; font-size: 9px; font-weight: 500;
  paint-order: stroke; stroke: #0d1117; stroke-width: 3px; stroke-linejoin: round;
}
#sysmap-svg .sd-zone-border { fill: none; stroke: var(--border-light); stroke-width: 1; stroke-dasharray: 6 4; rx: 14; }
#sysmap-svg .sd-zone-label { fill: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.6px; }
#sysmap-svg .sd-zone-bg { rx: 14; }
#sysmap-svg .sd-step-num { fill: var(--accent); font-size: 11px; font-weight: 700; }
#sysmap-svg .sd-step-bg { fill: var(--accent-dim); stroke: var(--accent); stroke-width: 1; }
.sysmap-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
}
.sysmap-ctrl-btn {
  width: 36px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .1s;
  font-family: inherit;
  line-height: 1;
}
.sysmap-ctrl-btn:hover { background: var(--surface-hover); color: var(--text); }
.sysmap-zoom-level {
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
  padding: 4px 0;
  user-select: none;
}

/* List View */
#file-list { padding: 20px 28px; overflow: auto; height: 100%; }
.list-header {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 2fr 80px 80px;
  gap: 12px;
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.list-group-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  padding: 16px 12px 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.list-group-dot { width: 6px; height: 6px; border-radius: 2px; }
.list-row {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 2fr 80px 80px;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
}
.list-row:hover { background: var(--surface-hover); }
.list-path { color: var(--text); font-family: 'SF Mono', monospace; font-size: 12px; }
.list-desc { color: var(--text-muted); font-size: 12px; }
.list-lines { color: var(--text-muted); font-size: 12px; text-align: right; }
.list-size { color: var(--text-muted); font-size: 12px; text-align: right; }

/* Detail Panel */
#detail-panel {
  width: 320px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 24px;
  flex-shrink: 0;
  position: relative;
}
#detail-panel.hidden { display: none; }
#close-detail {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}
#close-detail:hover { background: var(--surface-hover); color: var(--text); }
.detail-path {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  word-break: break-all;
}
.detail-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.detail-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }
.detail-tags { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
.detail-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.detail-tag-role { background: var(--accent-dim); color: var(--accent); }
.detail-tag-cat { background: var(--purple-dim); color: var(--purple); }
.detail-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.detail-stat-box {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 10px 12px;
}
.detail-stat-val { font-size: 18px; font-weight: 700; }
.detail-stat-label { font-size: 11px; color: var(--text-muted); }
.detail-section { margin-bottom: 20px; }
.detail-section h4 {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.detail-link {
  display: block;
  padding: 4px 8px;
  font-size: 12px;
  font-family: 'SF Mono', monospace;
  color: var(--accent);
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  transition: background .1s;
}
.detail-link:hover { background: var(--accent-dim); }
.detail-export {
  display: inline-block;
  padding: 3px 8px;
  font-size: 11px;
  font-family: 'SF Mono', monospace;
  background: var(--bg);
  border-radius: 4px;
  margin: 2px;
  color: var(--text-secondary);
}

/* Expand button */
.expand-btn {
  display: block;
  margin-top: 8px;
  padding: 5px 12px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all .1s;
}
.expand-btn:hover { color: var(--text-secondary); border-color: var(--border-light); background: var(--surface-hover); }

/* Health Badge */
.health-badge {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* File Preview */
.detail-preview {
  background: #1a1e26;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #c9d1d9;
  overflow-x: auto;
  white-space: pre;
  max-height: 340px;
  overflow-y: auto;
  margin-bottom: 16px;
  tab-size: 2;
}
.detail-preview .line-num {
  display: inline-block;
  width: 28px;
  color: #484f58;
  text-align: right;
  margin-right: 14px;
  user-select: none;
  font-size: 11px;
}
.detail-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.vscode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: #0078d4;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background .1s;
}
.vscode-btn:hover { background: #106ebe; }

/* Minimap */
.sysmap-minimap {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 180px;
  height: 120px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  z-index: 10;
  opacity: 0.85;
}
.sysmap-minimap:hover { opacity: 1; }
.sysmap-minimap svg { width: 100%; height: 100%; }
.minimap-viewport { fill: var(--accent); opacity: 0.15; stroke: var(--accent); stroke-width: 1.5; }

/* API Docs */
#apidocs-container { padding: 32px; overflow: auto; height: 100%; }
.api-doc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  margin-bottom: 12px;
}
.api-doc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.api-doc-path { font-family: 'SF Mono', monospace; font-size: 14px; font-weight: 600; color: var(--text); }
.api-doc-handler { font-size: 11px; color: var(--text-muted); cursor: pointer; }
.api-doc-handler:hover { color: var(--accent); }
.api-doc-params { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.api-doc-param {
  background: var(--purple-dim);
  color: var(--purple);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'SF Mono', monospace;
}
.api-doc-desc { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

/* Diff View */
#diff-container { padding: 32px; overflow: auto; height: 100%; }
.diff-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}
.diff-stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  text-align: center;
}
.diff-stat-val { font-size: 24px; font-weight: 700; }
.diff-stat-label { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
.diff-added { color: var(--green); }
.diff-removed { color: var(--red); }
.diff-changed { color: var(--yellow); }
.diff-file-list { margin-top: 16px; }
.diff-file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  cursor: pointer;
}
.diff-file-item:hover { background: var(--surface-hover); }
.diff-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.diff-badge-added { background: var(--green-dim); color: var(--green); }
.diff-badge-removed { background: var(--red-dim); color: var(--red); }
.diff-badge-changed { background: var(--yellow-dim); color: var(--yellow); }

/* Test Coverage Indicator */
.test-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 4px; flex-shrink: 0; }
.test-dot-covered { background: var(--green); }
.test-dot-uncovered { background: var(--red); opacity: 0.5; }

/* PNG Export */
.export-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all .1s;
}
.export-btn:hover { background: var(--surface-hover); color: var(--text); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
`;

// ── Inline JS ─────────────────────────────────────────────

const JS = `
(function() {
  const files = DATA.files;
  const edges = DATA.edges;

  // ── Category Config ─────────────────────────────────
  const CAT_COLORS = {
    pages: '#60a5fa',
    components: '#34d399',
    api: '#f87171',
    data: '#fbbf24',
    config: '#6b7280',
    styles: '#a78bfa',
    tests: '#fb923c',
    assets: '#4b5563',
    utilities: '#22d3ee',
    types: '#93c5fd',
  };

  const CAT_LABELS = {
    pages: 'Pages',
    components: 'Components',
    api: 'API',
    data: 'Data',
    config: 'Config',
    styles: 'Styles',
    tests: 'Tests',
    assets: 'Assets',
    utilities: 'Utilities',
    types: 'Types',
  };

  const CAT_ORDER = ['pages', 'components', 'api', 'data', 'utilities', 'styles', 'config', 'types', 'tests', 'assets'];

  // ── Build Category Map ──────────────────────────────
  const byCategory = {};
  for (const f of files) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }

  // ── Helper: short display name with parent dir ──────
  function displayName(filePath) {
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 2] + '/' + parts[parts.length - 1];
    }
    return parts[parts.length - 1];
  }

  // ── Sidebar Category Tree ───────────────────────────
  const treeEl = document.getElementById('category-tree');
  treeEl.innerHTML = '<h3>Explorer</h3>';

  for (const cat of CAT_ORDER) {
    const catFiles = byCategory[cat];
    if (!catFiles || catFiles.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'category-group';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML =
      '<span class="cat-dot" style="background:' + CAT_COLORS[cat] + '"></span>' +
      CAT_LABELS[cat] +
      '<span class="category-count">' + catFiles.length + '</span>';

    const filesEl = document.createElement('div');
    filesEl.className = 'category-files';
    filesEl.style.display = 'none';

    for (const f of catFiles) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.path = f.path;
      // Show parent/file to distinguish duplicate names like index.ts
      const dn = displayName(f.path);
      const parts = dn.split('/');
      if (parts.length > 1) {
        item.innerHTML = '<span class="file-dir">' + parts[0] + '/</span>' + parts[1];
      } else {
        item.textContent = dn;
      }
      item.addEventListener('click', () => selectFile(f));
      filesEl.appendChild(item);
    }

    header.addEventListener('click', () => {
      filesEl.style.display = filesEl.style.display === 'none' ? 'block' : 'none';
    });

    group.appendChild(header);
    group.appendChild(filesEl);
    treeEl.appendChild(group);
  }

  // Auto-expand first 3 non-empty categories
  const groups = treeEl.querySelectorAll('.category-files');
  for (let i = 0; i < Math.min(3, groups.length); i++) groups[i].style.display = 'block';

  // ── File Selection ──────────────────────────────────
  let selectedFile = null;

  function selectFile(f) {
    selectedFile = f;

    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector('.file-item[data-path="' + CSS.escape(f.path) + '"]');
    if (el) el.classList.add('selected');

    const panel = document.getElementById('detail-panel');
    panel.classList.remove('hidden');

    const imports = f.imports || [];
    const importedBy = [];
    for (const e of edges) {
      const toNorm = e.to.replace(/\\.(ts|tsx|js|jsx)$/, '');
      const fNorm = f.path.replace(/\\.(ts|tsx|js|jsx)$/, '');
      if (toNorm.endsWith(fNorm) || fNorm.endsWith(toNorm)) {
        importedBy.push(e.from);
      }
    }

    document.getElementById('detail-content').innerHTML =
      '<div class="detail-path">' + f.path + '</div>' +
      '<div class="detail-title">' + f.path.split('/').pop() + '</div>' +
      '<div class="detail-desc">' + f.description + '</div>' +
      '<div class="detail-tags">' +
        '<span class="detail-tag detail-tag-role">' + f.role + '</span>' +
        '<span class="detail-tag detail-tag-cat">' + f.category + '</span>' +
      '</div>' +
      '<div class="detail-stats">' +
        '<div class="detail-stat-box"><div class="detail-stat-val">' + f.lines + '</div><div class="detail-stat-label">Lines</div></div>' +
        '<div class="detail-stat-box"><div class="detail-stat-val">' + formatBytes(f.size) + '</div><div class="detail-stat-label">Size</div></div>' +
        '<div class="detail-stat-box"><div class="detail-stat-val">' + imports.length + '</div><div class="detail-stat-label">Imports</div></div>' +
        '<div class="detail-stat-box"><div class="detail-stat-val">' + importedBy.length + '</div><div class="detail-stat-label">Used by</div></div>' +
      '</div>' +
      (f.exports.length > 0 ? '<div class="detail-section"><h4>Exports</h4><div>' + f.exports.map(e => '<span class="detail-export">' + e + '</span>').join('') + '</div></div>' : '') +
      (f.routes.length > 0 ? '<div class="detail-section"><h4>Routes</h4>' + f.routes.map(r => '<div class="route-item"><span class="method method-' + r.method.toLowerCase() + '">' + r.method + '</span><span class="route-path">' + r.path + '</span></div>').join('') + '</div>' : '') +
      (imports.length > 0 ? '<div class="detail-section"><h4>Dependencies (' + imports.length + ')</h4>' + imports.map(i => '<div class="detail-link" onclick="window._selectByPath(\\'' + i + '\\')">' + i + '</div>').join('') + '</div>' : '') +
      (importedBy.length > 0 ? '<div class="detail-section"><h4>Dependents (' + importedBy.length + ')</h4>' + importedBy.map(i => '<div class="detail-link" onclick="window._selectByPath(\\'' + i + '\\')">' + i + '</div>').join('') + '</div>' : '') +
      (f.preview ? '<div class="detail-section"><div class="detail-preview-header"><h4>Preview</h4><div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;color:var(--text-muted)">' + (f.hasTests ? '<span class="test-dot test-dot-covered"></span>Has tests' : '<span class="test-dot test-dot-uncovered"></span>No tests') + '</span>' + (PROJECT_ROOT ? '<button class="vscode-btn" onclick="window._openInVSCode(\\'' + f.path + '\\')">Open in VS Code</button>' : '') + '</div></div><div class="detail-preview">' + formatPreview(f.preview) + '</div></div>' : '');
  }

  function escapeHtmlInline(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatPreview(src) {
    const lines = src.split('\\n');
    return lines.map((line, i) => '<span class="line-num">' + (i + 1) + '</span>' + escapeHtmlInline(line)).join('\\n');
  }

  // Open file in VS Code — reuses existing window for the folder, no duplicates
  window._openInVSCode = function(relativePath) {
    if (!PROJECT_ROOT) return;
    const fullPath = PROJECT_ROOT + '/' + relativePath;
    // vscode://file/ reuses existing window if the folder is already open
    // -r flag reuses window, -g goes to file
    window.location.href = 'vscode://file/' + encodeURI(fullPath) + ':1';
  };

  window._selectByPath = function(p) {
    const match = files.find(f => f.path === p || f.path.replace(/\\.(ts|tsx|js|jsx)$/, '') === p.replace(/\\.(ts|tsx|js|jsx)$/, ''));
    if (match) selectFile(match);
  };

  window._expandList = function(btn, group) {
    const items = document.querySelectorAll('[data-expand="' + group + '"]');
    const showing = items[0] && items[0].style.display !== 'none';
    items.forEach(el => el.style.display = showing ? 'none' : '');
    btn.textContent = showing ? 'Show all ' + (items.length + parseInt(btn.textContent.match(/\\d+/)?.[0] || items.length)) : 'Show less';
    if (showing) {
      btn.textContent = 'Show all';
    } else {
      btn.textContent = 'Show less';
    }
  };

  document.getElementById('close-detail').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.add('hidden');
    selectedFile = null;
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
  });

  // ── View Switching ──────────────────────────────────
  let currentView = 'overview';

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      currentView = view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
      document.getElementById(view + '-view').classList.add('active-view');
      if (view === 'overview') buildOverview();
      if (view === 'architecture') buildArchitecture();
      if (view === 'map') buildSystemMap();
      if (view === 'list') buildList();
      if (view === 'apidocs') buildApiDocs();
      if (view === 'diff') buildDiff();
    });
  });

  // ── Search ──────────────────────────────────────────
  document.getElementById('search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.file-item').forEach(el => {
      const path = el.dataset.path || '';
      el.style.display = path.toLowerCase().includes(q) ? '' : 'none';
    });
    if (q) {
      document.querySelectorAll('.category-files').forEach(el => el.style.display = 'block');
    }
  });

  // ── Overview ────────────────────────────────────────
  function buildOverview() {
    const container = document.getElementById('overview-container');

    const totalImports = edges.length;
    const avgImports = files.length > 0 ? (totalImports / files.length).toFixed(1) : 0;
    const sortedByLines = [...files].sort((a, b) => b.lines - a.lines);

    // Most connected (imported by most)
    const importedByCounts = {};
    for (const e of edges) {
      importedByCounts[e.to] = (importedByCounts[e.to] || 0) + 1;
    }
    const mostUsed = Object.entries(importedByCounts).sort((a, b) => b[1] - a[1]);

    // Complexity hotspots: files with high lines + high dependencies
    const fileComplexity = files.map(f => {
      const deps = edges.filter(e => e.from === f.path).length;
      const dependents = edges.filter(e => {
        const toNorm = e.to.replace(/\\.(ts|tsx|js|jsx)$/, '');
        const fNorm = f.path.replace(/\\.(ts|tsx|js|jsx)$/, '');
        return toNorm.endsWith(fNorm) || fNorm.endsWith(toNorm);
      }).length;
      return { file: f, deps, dependents, score: f.lines * 0.3 + deps * 15 + dependents * 20 };
    }).sort((a, b) => b.score - a.score);

    const catEntries = CAT_ORDER.filter(c => byCategory[c] && byCategory[c].length > 0)
      .map(c => ({ cat: c, count: byCategory[c].length }));
    const maxCatCount = Math.max(...catEntries.map(c => c.count), 1);

    const langs = Object.entries(DATA.languages).sort((a, b) => b[1] - a[1]);
    const maxLangLines = Math.max(...langs.map(l => l[1]), 1);

    // Test coverage stats
    const testedFiles = files.filter(f => f.hasTests).length;
    const testableFiles = files.filter(f => f.role !== 'test' && f.role !== 'config' && f.role !== 'style' && f.role !== 'asset').length;
    const testCovPct = testableFiles > 0 ? Math.round(testedFiles / testableFiles * 100) : 0;
    const hs = DATA.healthScore;

    let html = '<div class="overview-grid">';

    // Health Score
    html += '<div class="insight-card">';
    html += '<h3>Code Health</h3>';
    const gc = hs.grade === 'A' ? 'var(--green)' : hs.grade === 'B' ? 'var(--accent)' : hs.grade === 'C' ? 'var(--yellow)' : hs.grade === 'D' ? 'var(--orange)' : 'var(--red)';
    html += '<div class="insight-stat"><span class="insight-number" style="color:' + gc + '">' + hs.grade + '</span><span class="insight-label">' + hs.score + '/100</span></div>';
    html += '<div class="insight-list-item"><span class="name">Avg file size</span><span class="val">' + hs.details.avgFileSize + ' lines</span></div>';
    html += '<div class="insight-list-item"><span class="name">Test ratio</span><span class="val">' + Math.round(hs.details.testRatio * 100) + '%</span></div>';
    html += '<div class="insight-list-item"><span class="name">Circular deps</span><span class="val" style="color:' + (hs.details.circularCount > 0 ? 'var(--red)' : 'var(--green)') + '">' + hs.details.circularCount + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">Orphan files</span><span class="val">' + hs.details.orphanCount + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">Max complexity</span><span class="val">' + hs.details.maxComplexity + '</span></div>';
    html += '</div>';

    // Project Summary
    html += '<div class="insight-card">';
    html += '<h3>Project Summary</h3>';
    html += '<div class="insight-stat"><span class="insight-number">' + files.length + '</span><span class="insight-label">source files</span></div>';
    html += '<div class="insight-list-item"><span class="name">Total lines</span><span class="val">' + DATA.totalLines.toLocaleString() + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">Connections</span><span class="val">' + totalImports + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">Avg imports/file</span><span class="val">' + avgImports + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">API endpoints</span><span class="val">' + DATA.apiRoutes.length + '</span></div>';
    html += '<div class="insight-list-item"><span class="name">Test coverage</span><span class="val">' + testCovPct + '% (' + testedFiles + '/' + testableFiles + ')</span></div>';
    html += '<div class="insight-list-item"><span class="name">Framework</span><span class="val">' + DATA.framework + '</span></div>';
    html += '</div>';

    // File Distribution
    html += '<div class="insight-card">';
    html += '<h3>File Distribution</h3>';
    for (const c of catEntries) {
      html += '<div class="insight-bar-row">';
      html += '<span class="insight-bar-name">' + CAT_LABELS[c.cat] + '</span>';
      html += '<span class="insight-bar-track"><span class="insight-bar-fill" style="width:' + (c.count / maxCatCount * 100) + '%;background:' + CAT_COLORS[c.cat] + '"></span></span>';
      html += '<span class="insight-bar-val">' + c.count + ' files</span>';
      html += '</div>';
    }
    html += '</div>';

    // Languages
    html += '<div class="insight-card">';
    html += '<h3>Languages</h3>';
    for (const [lang, lines] of langs) {
      const pct = ((lines / DATA.totalLines) * 100).toFixed(1);
      html += '<div class="insight-bar-row">';
      html += '<span class="insight-bar-name">' + lang + '</span>';
      html += '<span class="insight-bar-track"><span class="insight-bar-fill" style="width:' + (lines / maxLangLines * 100) + '%;background:var(--accent)"></span></span>';
      html += '<span class="insight-bar-val">' + pct + '%</span>';
      html += '</div>';
    }
    html += '</div>';

    // Complexity Hotspots
    html += '<div class="insight-card">';
    html += '<h3>Complexity Hotspots</h3>';
    if (fileComplexity.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No complexity data</div>';
    } else {
      for (let hi = 0; hi < fileComplexity.length; hi++) {
        const h = fileComplexity[hi];
        const hidden = hi >= 6 ? ' data-expand="hotspots" style="display:none"' : '';
        html += '<div class="insight-list-item" style="cursor:pointer"' + hidden + ' onclick="window._selectByPath(\\'' + h.file.path + '\\')">';
        html += '<span class="name" title="' + h.file.path + '">' + displayName(h.file.path) + '</span>';
        html += '<span class="val">' + h.file.lines + ' ln, ' + h.deps + ' deps, ' + h.dependents + ' used</span>';
        html += '</div>';
      }
      if (fileComplexity.length > 6) {
        html += '<button class="expand-btn" onclick="window._expandList(this,\\'hotspots\\')">Show all ' + fileComplexity.length + '</button>';
      }
    }
    html += '</div>';

    html += '</div>'; // end grid

    // Most Used Modules
    html += '<div class="overview-section-title">Most Used Modules</div>';
    html += '<div class="overview-grid"><div class="insight-card" style="grid-column:1/-1">';
    if (mostUsed.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No inter-file dependencies detected</div>';
    } else {
      const maxUsed = mostUsed[0][1];
      for (let mi = 0; mi < mostUsed.length; mi++) {
        const [filePath, count] = mostUsed[mi];
        const hidden = mi >= 8 ? ' data-expand="mostused" style="display:none"' : '';
        html += '<div class="insight-bar-row" style="cursor:pointer"' + hidden + ' onclick="window._selectByPath(\\'' + filePath + '\\')">';
        html += '<span class="insight-bar-name" title="' + filePath + '">' + displayName(filePath) + '</span>';
        html += '<span class="insight-bar-track"><span class="insight-bar-fill" style="width:' + (count / maxUsed * 100) + '%;background:var(--green)"></span></span>';
        html += '<span class="insight-bar-val">' + count + ' deps</span>';
        html += '</div>';
      }
      if (mostUsed.length > 8) {
        html += '<button class="expand-btn" onclick="window._expandList(this,\\'mostused\\')">Show all ' + mostUsed.length + '</button>';
      }
    }
    html += '</div></div>';

    // Largest Files
    html += '<div class="overview-section-title">Largest Files</div>';
    html += '<div class="overview-grid"><div class="insight-card" style="grid-column:1/-1">';
    const maxLines = sortedByLines.length > 0 ? sortedByLines[0].lines : 1;
    for (let fi = 0; fi < sortedByLines.length; fi++) {
      const f = sortedByLines[fi];
      const hidden = fi >= 10 ? ' data-expand="largest" style="display:none"' : '';
      html += '<div class="insight-bar-row" style="cursor:pointer"' + hidden + ' onclick="window._selectByPath(\\'' + f.path + '\\')">';
      html += '<span class="insight-bar-name" title="' + f.path + '">' + displayName(f.path) + '</span>';
      html += '<span class="insight-bar-track"><span class="insight-bar-fill" style="width:' + (f.lines / maxLines * 100) + '%;background:' + CAT_COLORS[f.category] + '"></span></span>';
      html += '<span class="insight-bar-val">' + f.lines + ' ln</span>';
      html += '</div>';
    }
    if (sortedByLines.length > 10) {
      html += '<button class="expand-btn" onclick="window._expandList(this,\\'largest\\')">Show all ' + sortedByLines.length + '</button>';
    }
    html += '</div></div>';

    // Circular Dependencies
    if (DATA.circularDeps && DATA.circularDeps.length > 0) {
      html += '<div class="overview-section-title" style="color:var(--red)">Circular Dependencies (' + DATA.circularDeps.length + ')</div>';
      html += '<div class="overview-grid"><div class="insight-card" style="grid-column:1/-1;border-color:var(--red);border-color:rgba(248,113,113,0.3)">';
      for (let ci = 0; ci < DATA.circularDeps.length; ci++) {
        const cycle = DATA.circularDeps[ci];
        const hidden = ci >= 5 ? ' data-expand="cycles" style="display:none"' : '';
        html += '<div class="insight-list-item"' + hidden + '>';
        html += '<span class="name" style="width:auto;text-align:left">' + cycle.map(p => displayName(p)).join(' &rarr; ') + ' &rarr; ' + displayName(cycle[0]) + '</span>';
        html += '</div>';
      }
      if (DATA.circularDeps.length > 5) {
        html += '<button class="expand-btn" onclick="window._expandList(this,\\'cycles\\')">Show all ' + DATA.circularDeps.length + '</button>';
      }
      html += '</div></div>';
    }

    // Orphan Files
    if (DATA.orphanFiles && DATA.orphanFiles.length > 0) {
      html += '<div class="overview-section-title">Orphan Files (' + DATA.orphanFiles.length + ')</div>';
      html += '<div class="overview-grid"><div class="insight-card" style="grid-column:1/-1">';
      html += '<div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">Files with no imports and not imported by anything</div>';
      for (let oi = 0; oi < DATA.orphanFiles.length; oi++) {
        const op = DATA.orphanFiles[oi];
        const hidden = oi >= 8 ? ' data-expand="orphans" style="display:none"' : '';
        html += '<div class="insight-list-item" style="cursor:pointer"' + hidden + ' onclick="window._selectByPath(\\'' + op + '\\')">';
        html += '<span class="name">' + displayName(op) + '</span>';
        html += '</div>';
      }
      if (DATA.orphanFiles.length > 8) {
        html += '<button class="expand-btn" onclick="window._expandList(this,\\'orphans\\')">Show all ' + DATA.orphanFiles.length + '</button>';
      }
      html += '</div></div>';
    }

    // Test Coverage Map
    html += '<div class="overview-section-title">Test Coverage Map</div>';
    html += '<div class="overview-grid"><div class="insight-card" style="grid-column:1/-1">';
    const testable = files.filter(f => f.role !== 'test' && f.role !== 'config' && f.role !== 'style' && f.role !== 'asset');
    if (testable.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:13px">No testable files</div>';
    } else {
      const tested = testable.filter(f => f.hasTests);
      const untested = testable.filter(f => !f.hasTests);
      html += '<div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">';
      html += '<span class="test-dot test-dot-covered"></span> ' + tested.length + ' covered';
      html += ' &nbsp;&nbsp; <span class="test-dot test-dot-uncovered"></span> ' + untested.length + ' uncovered';
      html += '</div>';
      // Show untested files (they need attention)
      for (let ui = 0; ui < untested.length; ui++) {
        const f = untested[ui];
        const hidden = ui >= 10 ? ' data-expand="untested" style="display:none"' : '';
        html += '<div class="insight-list-item" style="cursor:pointer"' + hidden + ' onclick="window._selectByPath(\\'' + f.path + '\\')">';
        html += '<span class="name"><span class="test-dot test-dot-uncovered"></span>' + displayName(f.path) + '</span>';
        html += '<span class="val">' + f.lines + ' lines</span>';
        html += '</div>';
      }
      if (untested.length > 10) {
        html += '<button class="expand-btn" onclick="window._expandList(this,\\'untested\\')">Show all ' + untested.length + ' uncovered</button>';
      }
    }
    html += '</div></div>';

    container.innerHTML = html;
  }

  // ── Architecture View ───────────────────────────────
  function buildArchitecture() {
    const container = document.getElementById('arch-container');

    const layers = [
      { label: 'Entry Points', desc: 'CLI entry, main exports', roles: ['entry'], cats: [] },
      { label: 'Presentation Layer', desc: 'Pages, layouts, and route entry points', roles: ['page', 'layout'], cats: ['pages'] },
      { label: 'Component Layer', desc: 'Reusable UI components', roles: ['component'], cats: ['components'] },
      { label: 'State & Data Layer', desc: 'Stores, hooks, services, and data fetching', roles: ['store', 'hook', 'service', 'model'], cats: ['data'] },
      { label: 'API Layer', desc: 'API routes, middleware, and server endpoints', roles: ['api-route', 'middleware'], cats: ['api'] },
      { label: 'Core Logic', desc: 'Business logic, utilities, and shared modules', roles: ['utility'], cats: ['utilities'] },
      { label: 'Types & Config', desc: 'Type definitions and configuration', roles: ['config', 'type'], cats: ['config', 'types'] },
      { label: 'Tests', desc: 'Test files', roles: ['test'], cats: ['tests'] },
      { label: 'Assets & Styles', desc: 'Static assets and stylesheets', roles: ['asset', 'style'], cats: ['assets', 'styles'] },
    ];

    const arrowDown = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 4v12M6 12l4 4 4-4"/></svg>';

    let html = '<div class="arch-diagram">';

    let shownLayers = 0;
    for (const layer of layers) {
      const layerFiles = files.filter(f =>
        layer.roles.includes(f.role) || layer.cats.includes(f.category)
      );
      if (layerFiles.length === 0) continue;

      if (shownLayers > 0) {
        html += '<div class="arch-arrow">' + arrowDown + '<span class="arch-flow-label">imports</span>' + arrowDown + '</div>';
      }

      const collapsed = layerFiles.length > 12;
      const showCount = collapsed ? 12 : layerFiles.length;
      const layerId = 'arch-layer-' + shownLayers;

      html += '<div class="arch-layer">';
      html += '<div class="arch-layer-header">';
      html += '<span class="arch-layer-label">' + layer.label + '</span>';
      html += '<span class="arch-layer-count">' + layerFiles.length + ' files</span>';
      html += '</div>';
      html += '<div class="arch-layer-files" id="' + layerId + '">';

      for (let i = 0; i < layerFiles.length; i++) {
        const f = layerFiles[i];
        const dn = displayName(f.path);
        const hidden = collapsed && i >= showCount ? ' style="display:none" data-arch-extra="' + layerId + '"' : '';
        html += '<div class="arch-file"' + hidden + ' onclick="window._selectByPath(\\'' + f.path + '\\')" title="' + f.path + '">';
        html += '<div class="arch-file-name">' + dn + '</div>';
        html += '<div class="arch-file-desc">' + f.description + '</div>';
        html += '</div>';
      }

      if (collapsed) {
        html += '<button class="arch-toggle" data-target="' + layerId + '" onclick="window._toggleArchLayer(this)">Show all ' + layerFiles.length + '</button>';
      }

      html += '</div>'; // files
      html += '</div>'; // layer
      shownLayers++;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  window._toggleArchLayer = function(btn) {
    const target = btn.dataset.target;
    const extras = document.querySelectorAll('[data-arch-extra="' + target + '"]');
    const showing = extras[0] && extras[0].style.display !== 'none';
    extras.forEach(el => el.style.display = showing ? 'none' : '');
    btn.textContent = showing ? 'Show all' : 'Show less';
  };

  // Component detail panel (used by System Map)
  let _sysComps = {};
  window._selectComponent = function(compId) {
    const c = _sysComps[compId];
    if (!c) return;

    selectedFile = null;
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));

    const panel = document.getElementById('detail-panel');
    panel.classList.remove('hidden');

    const totalLines = c.files.reduce((s, f) => s + f.lines, 0);
    const totalSize = c.files.reduce((s, f) => s + f.size, 0);
    // Count incoming/outgoing component-level deps
    const outgoing = new Set();
    const incoming = new Set();
    const compPaths = new Set(c.files.map(f => f.path));
    for (const e of edges) {
      if (compPaths.has(e.from) && !compPaths.has(e.to)) outgoing.add(e.to);
      if (!compPaths.has(e.from) && compPaths.has(e.to)) incoming.add(e.from);
    }

    let html = '';
    html += '<div class="detail-title" style="margin-bottom:2px">' + c.label + '</div>';
    html += '<div class="detail-desc">' + c.desc + '</div>';
    html += '<div class="detail-stats">';
    html += '<div class="detail-stat-box"><div class="detail-stat-val">' + c.count + '</div><div class="detail-stat-label">Files</div></div>';
    html += '<div class="detail-stat-box"><div class="detail-stat-val">' + totalLines.toLocaleString() + '</div><div class="detail-stat-label">Lines</div></div>';
    html += '<div class="detail-stat-box"><div class="detail-stat-val">' + formatBytes(totalSize) + '</div><div class="detail-stat-label">Total Size</div></div>';
    html += '<div class="detail-stat-box"><div class="detail-stat-val">' + outgoing.size + ' / ' + incoming.size + '</div><div class="detail-stat-label">Out / In deps</div></div>';
    html += '</div>';

    // File list
    html += '<div class="detail-section"><h4>Files (' + c.count + ')</h4>';
    const sorted = [...c.files].sort((a, b) => b.lines - a.lines);
    for (const f of sorted) {
      const dn = displayName(f.path);
      html += '<div class="detail-link" style="display:flex;justify-content:space-between;align-items:center" onclick="window._selectByPath(\\'' + f.path + '\\')">';
      html += '<span>' + dn + '</span>';
      html += '<span style="color:var(--text-muted);font-size:10px;flex-shrink:0;margin-left:8px">' + f.lines + ' ln</span>';
      html += '</div>';
    }
    html += '</div>';

    // Exports across all files
    const allExports = [];
    for (const f of c.files) {
      for (const e of f.exports) {
        if (e !== 'default') allExports.push(e);
      }
    }
    if (allExports.length > 0) {
      html += '<div class="detail-section"><h4>Exports (' + allExports.length + ')</h4><div>';
      for (let ei = 0; ei < allExports.length; ei++) {
        const hidden = ei >= 20 ? ' data-expand="compexports" style="display:none"' : '';
        html += '<span class="detail-export"' + hidden + '>' + allExports[ei] + '</span>';
      }
      if (allExports.length > 20) {
        html += '<button class="expand-btn" style="margin-top:6px" onclick="window._expandList(this,\\'compexports\\')">Show all ' + allExports.length + '</button>';
      }
      html += '</div></div>';
    }

    // Routes
    const allRoutes = [];
    for (const f of c.files) {
      for (const r of f.routes) allRoutes.push(r);
    }
    if (allRoutes.length > 0) {
      html += '<div class="detail-section"><h4>Routes (' + allRoutes.length + ')</h4>';
      for (const r of allRoutes) {
        html += '<div class="route-item"><span class="method method-' + r.method.toLowerCase() + '">' + r.method + '</span><span class="route-path">' + r.path + '</span></div>';
      }
      html += '</div>';
    }

    document.getElementById('detail-content').innerHTML = html;
  };

  // ── System Map View (SVG Architecture Diagram) ──────
  function buildSystemMap() {
    const container = document.getElementById('sysmap-container');

    // ── Build Components ──────────────────────────────
    function buildComponents() {
      const comps = [];

      const entryFiles = files.filter(f => f.role === 'entry');
      const cliFiles = files.filter(f => f.path.includes('/cli/') && f.role !== 'entry');
      const pageFiles = files.filter(f => f.role === 'page' || f.role === 'layout');
      const componentFiles = files.filter(f => f.role === 'component');
      const apiFiles = files.filter(f => f.role === 'api-route');
      const middlewareFiles = files.filter(f => f.role === 'middleware');
      const storeFiles = files.filter(f => f.role === 'store' || f.role === 'hook');
      const serviceFiles = files.filter(f => f.role === 'service' || f.role === 'model');
      const utilFiles = files.filter(f => f.role === 'utility' && !f.path.includes('/cli/'));
      const configFiles = files.filter(f => f.role === 'config');
      const typeFiles = files.filter(f => f.role === 'type');
      const testFiles = files.filter(f => f.category === 'tests');
      const styleFiles = files.filter(f => f.category === 'styles');
      const assetFiles = files.filter(f => f.category === 'assets');

      const icons = {
        entry: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        cli: '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M7 9l3 3-3 3M13 15h4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        page: '<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M4 9h16M9 9v11" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        component: '<rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        api: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        middleware: '<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        store: '<ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        service: '<rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="10" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="12" r="1" fill="currentColor"/>',
        util: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        config: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        type: '<path d="M4 7V4h16v3M9 20h6M12 4v16" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        test: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M9 14l2 2 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        style: '<circle cx="13.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M19 9s-3 5.5-3 8a3 3 0 006 0c0-2.5-3-8-3-8z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        asset: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" fill="none"/>',
      };

      function add(id, label, color, icon, cf, desc) {
        if (cf.length > 0) comps.push({ id, label, color, icon: icons[icon] || icons.util, files: cf, count: cf.length, desc });
      }

      add('entry', 'Entry Points', '#60a5fa', 'entry', entryFiles, 'App bootstrap');
      add('cli', 'CLI Commands', '#60a5fa', 'cli', cliFiles, 'Command interface');
      add('pages', 'Pages & Routes', '#60a5fa', 'page', pageFiles, 'Route entries');
      add('components', 'Components', '#34d399', 'component', componentFiles, 'Reusable UI');
      add('api', 'API Endpoints', '#f87171', 'api', apiFiles, 'Server endpoints');
      add('middleware', 'Middleware', '#f87171', 'middleware', middlewareFiles, 'Request processing');
      add('store', 'State & Hooks', '#fbbf24', 'store', storeFiles, 'State mgmt');
      add('services', 'Services', '#fbbf24', 'service', serviceFiles, 'Business logic');
      add('utils', 'Utilities', '#22d3ee', 'util', utilFiles, 'Shared helpers');
      add('config', 'Configuration', '#6b7280', 'config', configFiles, 'App config');
      add('types', 'Types', '#93c5fd', 'type', typeFiles, 'Type defs');
      add('tests', 'Tests', '#fb923c', 'test', testFiles, 'Test suite');
      add('styles', 'Styles', '#a78bfa', 'style', styleFiles, 'Stylesheets');
      add('assets', 'Assets', '#4b5563', 'asset', assetFiles, 'Static files');

      return comps;
    }

    const comps = buildComponents();
    // Store for _selectComponent
    _sysComps = {};
    for (const c of comps) _sysComps[c.id] = c;

    if (comps.length === 0) {
      container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)">No files to visualize</div>';
      return;
    }

    // ── Layout ────────────────────────────────────────
    const NW = 190, NH = 70, GAP = 50, ZONE_PAD = 24;

    const zoneMap = [
      { id: 'interface', label: 'Interface Layer', comps: ['entry', 'cli', 'pages'], color: '#60a5fa' },
      { id: 'presentation', label: 'Presentation', comps: ['components'], color: '#34d399' },
      { id: 'server', label: 'Server Layer', comps: ['api', 'middleware'], color: '#f87171' },
      { id: 'data', label: 'Data Layer', comps: ['store', 'services'], color: '#fbbf24' },
      { id: 'core', label: 'Core', comps: ['utils'], color: '#22d3ee' },
      { id: 'foundation', label: 'Foundation', comps: ['config', 'types'], color: '#6b7280' },
      { id: 'quality', label: 'Quality & Assets', comps: ['tests', 'styles', 'assets'], color: '#fb923c' },
    ];

    const compById = {};
    for (const c of comps) compById[c.id] = c;
    const activeZones = zoneMap.filter(z => z.comps.some(cid => compById[cid]));

    const nodePositions = {};
    const zones = [];
    let stepNum = 1;

    // Two-column layout — side-by-side zones where possible
    // Pair zones: [0,1], [2,3], [4,5], [6]
    let curY = 60;
    let zi = 0;

    while (zi < activeZones.length) {
      const z1 = activeZones[zi];
      const z1Comps = z1.comps.filter(cid => compById[cid]);
      const z2 = activeZones[zi + 1];
      const z2Comps = z2 ? z2.comps.filter(cid => compById[cid]) : [];

      // If z1 has 3+ comps or z2 is empty, make z1 full-width
      const fullWidth = z1Comps.length >= 3 || z2Comps.length === 0;

      if (fullWidth) {
        // Full-width zone
        const cols = Math.min(z1Comps.length, 4);
        const rows = Math.ceil(z1Comps.length / cols);
        const zw = cols * (NW + GAP) + ZONE_PAD * 2 - GAP;
        const zh = rows * (NH + GAP) + 44 + ZONE_PAD - GAP;
        const zx = 60;

        zones.push({ x: zx, y: curY, w: zw, h: zh, label: z1.label, color: z1.color, step: stepNum++ });

        for (let ci = 0; ci < z1Comps.length; ci++) {
          const col = ci % cols;
          const row = Math.floor(ci / cols);
          nodePositions[z1Comps[ci]] = {
            x: zx + ZONE_PAD + col * (NW + GAP),
            y: curY + 44 + row * (NH + GAP),
            comp: compById[z1Comps[ci]],
          };
        }
        curY += zh + 40;
        zi++;
      } else {
        // Side-by-side zones
        const z1cols = Math.min(z1Comps.length, 2);
        const z1rows = Math.ceil(z1Comps.length / z1cols);
        const z1w = z1cols * (NW + GAP) + ZONE_PAD * 2 - GAP;
        const z1h = z1rows * (NH + GAP) + 44 + ZONE_PAD - GAP;

        const z2cols = Math.min(z2Comps.length, 2);
        const z2rows = Math.ceil(z2Comps.length / z2cols);
        const z2w = z2cols * (NW + GAP) + ZONE_PAD * 2 - GAP;
        const z2h = z2rows * (NH + GAP) + 44 + ZONE_PAD - GAP;

        const maxH = Math.max(z1h, z2h);
        const z1x = 60;
        const z2x = z1x + z1w + 50;

        zones.push({ x: z1x, y: curY, w: z1w, h: maxH, label: z1.label, color: z1.color, step: stepNum++ });
        zones.push({ x: z2x, y: curY, w: z2w, h: maxH, label: z2.label, color: z2.color, step: stepNum++ });

        for (let ci = 0; ci < z1Comps.length; ci++) {
          const col = ci % z1cols;
          const row = Math.floor(ci / z1cols);
          nodePositions[z1Comps[ci]] = {
            x: z1x + ZONE_PAD + col * (NW + GAP),
            y: curY + 44 + row * (NH + GAP),
            comp: compById[z1Comps[ci]],
          };
        }
        for (let ci = 0; ci < z2Comps.length; ci++) {
          const col = ci % z2cols;
          const row = Math.floor(ci / z2cols);
          nodePositions[z2Comps[ci]] = {
            x: z2x + ZONE_PAD + col * (NW + GAP),
            y: curY + 44 + row * (NH + GAP),
            comp: compById[z2Comps[ci]],
          };
        }
        curY += maxH + 40;
        zi += 2;
      }
    }

    const totalW = Math.max(800, ...zones.map(z => z.x + z.w + 80));
    const totalH = curY + 60;

    // ── Connections ───────────────────────────────────
    const connections = [];
    const compFileMap = {};
    for (const c of comps) {
      for (const f of c.files) compFileMap[f.path] = c.id;
    }

    const compEdges = {};
    for (const e of edges) {
      const fromComp = compFileMap[e.from];
      let toComp = compFileMap[e.to];
      if (!toComp) {
        for (const f of files) {
          const toN = e.to.replace(/\\.(ts|tsx|js|jsx)$/, '');
          const fN = f.path.replace(/\\.(ts|tsx|js|jsx)$/, '');
          if (toN.endsWith(fN) || fN.endsWith(toN)) { toComp = compFileMap[f.path]; break; }
        }
      }
      if (fromComp && toComp && fromComp !== toComp) {
        const key = fromComp + '>' + toComp;
        compEdges[key] = (compEdges[key] || 0) + 1;
      }
    }

    for (const [key, count] of Object.entries(compEdges)) {
      const [from, to] = key.split('>');
      if (nodePositions[from] && nodePositions[to]) {
        connections.push({ from, to, label: count + (count > 1 ? ' imports' : ' import') });
      }
    }

    // ── Build SVG ────────────────────────────────────
    let svg = '<svg id="sysmap-svg" xmlns="http://www.w3.org/2000/svg">';
    svg += '<defs>';
    svg += '<marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon class="sd-arrow-head" points="0 0, 10 3.5, 0 7"/></marker>';
    svg += '</defs>';
    svg += '<g id="sysmap-world">';

    // Zones
    for (const z of zones) {
      svg += '<g class="sd-zone">';
      svg += '<rect class="sd-zone-bg" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="' + z.color + '06"/>';
      svg += '<rect class="sd-zone-border" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '"/>';
      svg += '<text class="sd-zone-label" x="' + (z.x + 18) + '" y="' + (z.y + 22) + '">' + z.label + '</text>';
      svg += '<circle class="sd-step-bg" cx="' + (z.x + z.w - 22) + '" cy="' + (z.y + 18) + '" r="12"/>';
      svg += '<text class="sd-step-num" x="' + (z.x + z.w - 22) + '" y="' + (z.y + 22) + '" text-anchor="middle">' + z.step + '</text>';
      svg += '</g>';
    }

    // Arrows — offset duplicates so labels don't overlap
    const drawnPairs = {};
    for (const conn of connections) {
      const f = nodePositions[conn.from];
      const t = nodePositions[conn.to];
      if (!f || !t) continue;

      const pairKey = [conn.from, conn.to].sort().join('|');
      const pairIdx = drawnPairs[pairKey] || 0;
      drawnPairs[pairKey] = pairIdx + 1;
      const offset = pairIdx * 14;

      const fx = f.x + NW / 2;
      const fy = f.y + NH;
      const tx = t.x + NW / 2;
      const ty = t.y;
      const dx = Math.abs(tx - fx);
      const dy = Math.abs(ty - fy);

      if (dy < NH) {
        // Same row — horizontal arrow
        const sx = fx > tx ? f.x : f.x + NW;
        const ex = fx > tx ? t.x + NW : t.x;
        const ay = f.y + NH / 2 + offset;
        svg += '<path class="sd-arrow" d="M' + sx + ' ' + ay + ' L' + ex + ' ' + ay + '" marker-end="url(#ah)"/>';
        svg += '<text class="sd-arrow-label" x="' + ((sx + ex) / 2) + '" y="' + (ay - 8) + '" text-anchor="middle">' + conn.label + '</text>';
      } else if (dx < 30) {
        // Vertical
        const ox = 10 + offset;
        svg += '<path class="sd-arrow" d="M' + (fx + ox) + ' ' + fy + ' L' + (tx + ox) + ' ' + ty + '" marker-end="url(#ah)"/>';
        svg += '<text class="sd-arrow-label" x="' + (fx + ox + 10) + '" y="' + ((fy + ty) / 2) + '">' + conn.label + '</text>';
      } else {
        // Curved
        const midY = (fy + ty) / 2;
        const curveOff = offset * (tx > fx ? 1 : -1);
        svg += '<path class="sd-arrow" d="M' + fx + ' ' + fy + ' C' + (fx + curveOff) + ' ' + midY + ' ' + (tx + curveOff) + ' ' + midY + ' ' + tx + ' ' + ty + '" marker-end="url(#ah)"/>';
        // Place label at curve midpoint with background
        const lx = (fx + tx) / 2 + curveOff / 2;
        const ly = midY - 6;
        svg += '<text class="sd-arrow-label" x="' + lx + '" y="' + ly + '" text-anchor="middle">' + conn.label + '</text>';
      }
    }

    // Nodes
    for (const [cid, pos] of Object.entries(nodePositions)) {
      const c = pos.comp;
      const x = pos.x;
      const y = pos.y;
      const totalLines = c.files.reduce((s, f) => s + f.lines, 0);

      svg += '<g class="sd-node" onclick="window._selectComponent(\\'' + cid + '\\')">';
      svg += '<rect class="sd-node-bg" x="' + x + '" y="' + y + '" width="' + NW + '" height="' + NH + '" rx="8" fill="#161b22" stroke="' + c.color + '" stroke-width="1.5"/>';
      svg += '<rect x="' + x + '" y="' + y + '" width="' + NW + '" height="4" rx="8" fill="' + c.color + '" opacity="0.5"/>';
      // Clip label text
      svg += '<clipPath id="clip-' + cid + '"><rect x="' + (x + 36) + '" y="' + (y + 10) + '" width="' + (NW - 48) + '" height="20"/></clipPath>';
      svg += '<g transform="translate(' + (x + 14) + ',' + (y + 14) + ') scale(0.7)" color="' + c.color + '">' + c.icon + '</g>';
      svg += '<text x="' + (x + 40) + '" y="' + (y + 28) + '" fill="#e6edf3" font-size="12" font-weight="600" clip-path="url(#clip-' + cid + ')">' + c.label + '</text>';
      svg += '<text x="' + (x + 14) + '" y="' + (y + 46) + '" fill="#6b7280" font-size="10">' + c.count + ' file' + (c.count !== 1 ? 's' : '') + '</text>';
      svg += '<text x="' + (x + NW - 14) + '" y="' + (y + 46) + '" fill="#6b7280" font-size="10" text-anchor="end">' + totalLines.toLocaleString() + ' lines</text>';
      svg += '<text x="' + (x + 14) + '" y="' + (y + NH - 8) + '" fill="#4b5563" font-size="9">' + c.desc + '</text>';
      svg += '</g>';
    }

    svg += '</g></svg>';

    // Zoom controls HTML
    let controls = '<div class="sysmap-controls">';
    controls += '<button class="sysmap-ctrl-btn" id="sysmap-zin" title="Zoom in">+</button>';
    controls += '<div class="sysmap-zoom-level" id="sysmap-zlevel">100%</div>';
    controls += '<button class="sysmap-ctrl-btn" id="sysmap-zout" title="Zoom out">&minus;</button>';
    controls += '<button class="sysmap-ctrl-btn" id="sysmap-zfit" title="Fit to screen" style="margin-top:8px;font-size:13px">Fit</button>';
    controls += '<button class="export-btn" id="sysmap-export" style="margin-top:8px;font-size:11px;width:36px;padding:6px 0;text-align:center" title="Export as PNG">PNG</button>';
    controls += '</div>';

    // Minimap HTML
    let minimap = '<div class="sysmap-minimap" id="sysmap-minimap">';
    minimap += '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" preserveAspectRatio="xMidYMid meet">';
    // Draw mini zones
    for (const z of zones) {
      minimap += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="' + z.color + '" opacity="0.15" rx="8"/>';
    }
    // Draw mini nodes
    for (const [cid, pos] of Object.entries(nodePositions)) {
      const c = pos.comp;
      minimap += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + NW + '" height="' + NH + '" fill="' + c.color + '" opacity="0.4" rx="4"/>';
    }
    minimap += '<rect class="minimap-viewport" id="minimap-vp" x="0" y="0" width="200" height="150"/>';
    minimap += '</svg></div>';

    container.innerHTML = svg + controls + minimap;

    // ── Zoom & Pan ───────────────────────────────────
    const svgEl = document.getElementById('sysmap-svg');
    const world = document.getElementById('sysmap-world');
    const zLabel = document.getElementById('sysmap-zlevel');
    let zoom = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let startX = 0, startY = 0;

    function applyTransform() {
      world.setAttribute('transform', 'translate(' + panX + ',' + panY + ') scale(' + zoom + ')');
      svgEl.setAttribute('width', Math.max(totalW * zoom + Math.abs(panX), container.clientWidth));
      svgEl.setAttribute('height', Math.max(totalH * zoom + Math.abs(panY), container.clientHeight));
      zLabel.textContent = Math.round(zoom * 100) + '%';
    }

    function setZoom(z, cx, cy) {
      const oldZoom = zoom;
      zoom = Math.max(0.2, Math.min(3, z));
      // Zoom towards center point
      if (cx !== undefined) {
        panX = cx - (cx - panX) * (zoom / oldZoom);
        panY = cy - (cy - panY) * (zoom / oldZoom);
      }
      applyTransform();
    }

    function fitToScreen() {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scaleX = (cw - 40) / totalW;
      const scaleY = (ch - 40) / totalH;
      zoom = Math.min(scaleX, scaleY, 1.5);
      panX = (cw - totalW * zoom) / 2;
      panY = 20;
      applyTransform();
    }

    // Initial fit
    svgEl.setAttribute('width', container.clientWidth);
    svgEl.setAttribute('height', container.clientHeight);
    fitToScreen();

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * delta, cx, cy);
    }, { passive: false });

    // Pan via drag
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sd-node') || e.target.closest('.sysmap-controls')) return;
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.classList.add('grabbing');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      isPanning = false;
      container.classList.remove('grabbing');
    });

    // Button controls
    document.getElementById('sysmap-zin').addEventListener('click', () => {
      const rect = container.getBoundingClientRect();
      setZoom(zoom * 1.25, rect.width / 2, rect.height / 2);
    });
    document.getElementById('sysmap-zout').addEventListener('click', () => {
      const rect = container.getBoundingClientRect();
      setZoom(zoom * 0.8, rect.width / 2, rect.height / 2);
    });
    document.getElementById('sysmap-zfit').addEventListener('click', fitToScreen);

    // Minimap viewport update
    const minimapVp = document.getElementById('minimap-vp');
    function updateMinimap() {
      if (!minimapVp) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      // What part of the world is visible?
      const vx = -panX / zoom;
      const vy = -panY / zoom;
      const vw = cw / zoom;
      const vh = ch / zoom;
      minimapVp.setAttribute('x', String(Math.max(0, vx)));
      minimapVp.setAttribute('y', String(Math.max(0, vy)));
      minimapVp.setAttribute('width', String(Math.min(totalW, vw)));
      minimapVp.setAttribute('height', String(Math.min(totalH, vh)));
    }

    // Patch applyTransform to also update minimap
    const _origApply = applyTransform;
    applyTransform = function() {
      _origApply();
      updateMinimap();
    };
    updateMinimap();

    // PNG Export
    document.getElementById('sysmap-export').addEventListener('click', function() {
      try {
        const svgClone = svgEl.cloneNode(true);
        // Inline styles for export
        const styleText = document.querySelector('style').textContent;
        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = styleText;
        svgClone.insertBefore(styleEl, svgClone.firstChild);
        // Set proper dimensions
        const w = totalW * zoom + 100;
        const h = totalH * zoom + 100;
        svgClone.setAttribute('width', w);
        svgClone.setAttribute('height', h);
        svgClone.setAttribute('viewBox', '0 0 ' + totalW + ' ' + totalH);
        svgClone.querySelector('#sysmap-world').setAttribute('transform', '');

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = totalW * 2;
          canvas.height = totalH * 2;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0d1117';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          canvas.toBlob(function(pngBlob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(pngBlob);
            a.download = 'system-map.png';
            a.click();
            URL.revokeObjectURL(a.href);
          }, 'image/png');
        };
        img.src = url;
      } catch(ex) {
        console.error('PNG export failed:', ex);
      }
    });

    // Keyboard navigation for System Map
    function handleMapKeys(e) {
      if (currentView !== 'map') return;
      if (e.target.tagName === 'INPUT') return;
      const PAN_STEP = 50;
      const rect = container.getBoundingClientRect();
      switch(e.key) {
        case 'ArrowUp': panY += PAN_STEP; applyTransform(); e.preventDefault(); break;
        case 'ArrowDown': panY -= PAN_STEP; applyTransform(); e.preventDefault(); break;
        case 'ArrowLeft': panX += PAN_STEP; applyTransform(); e.preventDefault(); break;
        case 'ArrowRight': panX -= PAN_STEP; applyTransform(); e.preventDefault(); break;
        case '=': case '+': setZoom(zoom * 1.15, rect.width / 2, rect.height / 2); e.preventDefault(); break;
        case '-': setZoom(zoom * 0.87, rect.width / 2, rect.height / 2); e.preventDefault(); break;
        case '0': fitToScreen(); e.preventDefault(); break;
      }
    }
    document.addEventListener('keydown', handleMapKeys);
  }

  // ── List View ───────────────────────────────────────
  function buildList() {
    const container = document.getElementById('file-list');
    let html = '<div class="list-header"><span>File</span><span>Description</span><span style="text-align:right">Lines</span><span style="text-align:right">Size</span></div>';

    for (const cat of CAT_ORDER) {
      const catFiles = byCategory[cat];
      if (!catFiles || catFiles.length === 0) continue;

      html += '<div class="list-group-header"><span class="list-group-dot" style="background:' + CAT_COLORS[cat] + '"></span>' + CAT_LABELS[cat] + ' (' + catFiles.length + ')</div>';
      for (const f of catFiles) {
        html += '<div class="list-row" onclick="window._selectByPath(\\'' + f.path + '\\')">';
        html += '<div class="list-path">' + (f.role !== 'test' && f.role !== 'config' && f.role !== 'style' && f.role !== 'asset' ? '<span class="test-dot ' + (f.hasTests ? 'test-dot-covered' : 'test-dot-uncovered') + '"></span>' : '') + f.path + '</div>';
        html += '<div class="list-desc">' + f.description + '</div>';
        html += '<div class="list-lines">' + f.lines + '</div>';
        html += '<div class="list-size">' + formatBytes(f.size) + '</div>';
        html += '</div>';
      }
    }

    container.innerHTML = html;
  }

  // ── Utilities ───────────────────────────────────────
  function formatBytes(b) {
    if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
  }

  // ── API Docs View ──────────────────────────────────
  function buildApiDocs() {
    const container = document.getElementById('apidocs-container');
    const docs = DATA.apiDocs || [];

    if (docs.length === 0) {
      container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)">No API routes detected</div>';
      return;
    }

    // Group by base path
    const grouped = {};
    for (const d of docs) {
      const base = d.path.split('/').slice(0, 3).join('/') || d.path;
      if (!grouped[base]) grouped[base] = [];
      grouped[base].push(d);
    }

    let html = '<h2 style="font-size:16px;font-weight:600;margin-bottom:24px">API Documentation</h2>';
    html += '<div style="color:var(--text-muted);font-size:12px;margin-bottom:20px">' + docs.length + ' endpoints auto-detected</div>';

    for (const [base, endpoints] of Object.entries(grouped)) {
      html += '<div style="margin-bottom:24px">';
      html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:8px">' + base + '</div>';
      for (const ep of endpoints) {
        html += '<div class="api-doc-card">';
        html += '<div class="api-doc-header">';
        html += '<span class="method method-' + ep.method.toLowerCase() + '">' + ep.method + '</span>';
        html += '<span class="api-doc-path">' + ep.path + '</span>';
        html += '</div>';
        html += '<div class="api-doc-handler" onclick="window._selectByPath(\\'' + ep.handler + '\\')">' + ep.handler + '</div>';
        if (ep.params.length > 0) {
          html += '<div class="api-doc-params">';
          for (const p of ep.params) {
            html += '<span class="api-doc-param">:' + p + '</span>';
          }
          html += '</div>';
        }
        html += '<div class="api-doc-desc">' + ep.description + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // ── Diff View ─────────────────────────────────────
  function buildDiff() {
    const container = document.getElementById('diff-container');
    if (!PREV) {
      container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted)">No previous scan to compare against.<br><span style="font-size:12px">Run forge viz again to see changes.</span></div>';
      return;
    }

    const prevPaths = new Set(PREV.files.map(f => f.path));
    const currPaths = new Set(DATA.files.map(f => f.path));
    const prevByPath = {};
    for (const f of PREV.files) prevByPath[f.path] = f;
    const currByPath = {};
    for (const f of DATA.files) currByPath[f.path] = f;

    const added = DATA.files.filter(f => !prevPaths.has(f.path));
    const removed = PREV.files.filter(f => !currPaths.has(f.path));
    const changed = DATA.files.filter(f => {
      if (!prevByPath[f.path]) return false;
      return f.lines !== prevByPath[f.path].lines || f.size !== prevByPath[f.path].size;
    });

    const linesAdded = added.reduce((s, f) => s + f.lines, 0) + changed.reduce((s, f) => s + Math.max(0, f.lines - (prevByPath[f.path]?.lines || 0)), 0);
    const linesRemoved = removed.reduce((s, f) => s + f.lines, 0) + changed.reduce((s, f) => s + Math.max(0, (prevByPath[f.path]?.lines || 0) - f.lines), 0);

    const prevTs = PREV.scanTimestamp ? new Date(PREV.scanTimestamp).toLocaleString() : 'unknown';
    const currTs = DATA.scanTimestamp ? new Date(DATA.scanTimestamp).toLocaleString() : 'now';

    let html = '<h2 style="font-size:16px;font-weight:600;margin-bottom:8px">Changes Since Last Scan</h2>';
    html += '<div style="color:var(--text-muted);font-size:12px;margin-bottom:24px">' + prevTs + ' &rarr; ' + currTs + '</div>';

    html += '<div class="diff-summary">';
    html += '<div class="diff-stat-card"><div class="diff-stat-val diff-added">+' + added.length + '</div><div class="diff-stat-label">Files Added</div></div>';
    html += '<div class="diff-stat-card"><div class="diff-stat-val diff-removed">-' + removed.length + '</div><div class="diff-stat-label">Files Removed</div></div>';
    html += '<div class="diff-stat-card"><div class="diff-stat-val diff-changed">' + changed.length + '</div><div class="diff-stat-label">Files Changed</div></div>';
    html += '<div class="diff-stat-card"><div class="diff-stat-val diff-added">+' + linesAdded + '</div><div class="diff-stat-label">Lines Added</div></div>';
    html += '<div class="diff-stat-card"><div class="diff-stat-val diff-removed">-' + linesRemoved + '</div><div class="diff-stat-label">Lines Removed</div></div>';
    html += '<div class="diff-stat-card"><div class="diff-stat-val">' + DATA.totalFiles + '</div><div class="diff-stat-label">Total Files Now</div></div>';
    html += '</div>';

    // Health score change
    if (PREV.healthScore) {
      const delta = DATA.healthScore.score - PREV.healthScore.score;
      const arrow = delta > 0 ? '&uarr;' : delta < 0 ? '&darr;' : '&equals;';
      const dColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-muted)';
      html += '<div class="insight-card" style="margin-bottom:24px">';
      html += '<h3>Health Score Change</h3>';
      html += '<div style="font-size:20px;font-weight:700;color:' + dColor + '">' + PREV.healthScore.grade + ' &rarr; ' + DATA.healthScore.grade + ' <span style="font-size:14px">(' + (delta > 0 ? '+' : '') + delta + ' ' + arrow + ')</span></div>';
      html += '</div>';
    }

    if (added.length > 0) {
      html += '<div class="overview-section-title diff-added">Added Files</div>';
      html += '<div class="diff-file-list">';
      for (const f of added) {
        html += '<div class="diff-file-item" onclick="window._selectByPath(\\'' + f.path + '\\')">';
        html += '<span class="diff-badge diff-badge-added">NEW</span>';
        html += '<span style="font-family:\\'SF Mono\\',monospace;font-size:12px">' + f.path + '</span>';
        html += '<span style="color:var(--text-muted);font-size:11px;margin-left:auto">' + f.lines + ' lines</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (removed.length > 0) {
      html += '<div class="overview-section-title diff-removed" style="margin-top:20px">Removed Files</div>';
      html += '<div class="diff-file-list">';
      for (const f of removed) {
        html += '<div class="diff-file-item">';
        html += '<span class="diff-badge diff-badge-removed">DEL</span>';
        html += '<span style="font-family:\\'SF Mono\\',monospace;font-size:12px">' + f.path + '</span>';
        html += '<span style="color:var(--text-muted);font-size:11px;margin-left:auto">' + f.lines + ' lines</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (changed.length > 0) {
      html += '<div class="overview-section-title diff-changed" style="margin-top:20px">Changed Files</div>';
      html += '<div class="diff-file-list">';
      for (const f of changed) {
        const prev = prevByPath[f.path];
        const lineDelta = f.lines - (prev ? prev.lines : 0);
        html += '<div class="diff-file-item" onclick="window._selectByPath(\\'' + f.path + '\\')">';
        html += '<span class="diff-badge diff-badge-changed">MOD</span>';
        html += '<span style="font-family:\\'SF Mono\\',monospace;font-size:12px">' + f.path + '</span>';
        html += '<span style="color:' + (lineDelta >= 0 ? 'var(--green)' : 'var(--red)') + ';font-size:11px;margin-left:auto">' + (lineDelta >= 0 ? '+' : '') + lineDelta + ' lines</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // ── Init ────────────────────────────────────────────
  buildOverview();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('detail-panel').classList.add('hidden');
      selectedFile = null;
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    }
    if (e.key === '/' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('search').focus();
    }
  });
})();
`;
