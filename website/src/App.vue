<template>
  <div class="app">
    <nav class="navbar">
      <div class="nav-brand">
        <router-link to="/">CBM AI Benchmark</router-link>
      </div>
      <div class="nav-links">
        <router-link to="/">Home</router-link>
        <router-link to="/leaderboard">Leaderboard</router-link>
        <router-link to="/ambiguous">Calibration Under Uncertainty</router-link>
        <router-link to="/methodology">Methodology</router-link>
      </div>
    </nav>
    <main class="content">
      <router-view />
    </main>
    <footer class="footer">
      <p>CBM AI Benchmark &mdash; Confidence-Based Marking for LLM Evaluation</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #1a1a2e;
  line-height: 1.6;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: #1a1a2e;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-brand a {
  color: white;
  text-decoration: none;
  font-size: 1.3rem;
  font-weight: 700;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-links a {
  color: #a0a0c0;
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: white;
}

.content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background: #1a1a2e;
  color: #a0a0c0;
  text-align: center;
  padding: 1rem;
  font-size: 0.85rem;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  margin-bottom: 1.5rem;
}

.card h2 {
  margin-bottom: 1rem;
  color: #1a1a2e;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e8e8f0;
}

th {
  background: #f0f0f8;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #e0e0f0;
}

tr:hover {
  background: #fafafe;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  text-align: center;
}

.stat-card .value {
  font-size: 2rem;
  font-weight: 700;
  color: #2563eb;
}

.stat-card .label {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.badge-openai { background: #e8f5e9; color: #2e7d32; }
.badge-claude { background: #ede7f6; color: #4527a0; }
.badge-gemini { background: #e3f2fd; color: #1565c0; }
.badge-deepseek { background: #fce4ec; color: #c62828; }
.badge-xai { background: #fff3e0; color: #e65100; }

.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-bar select {
  padding: 0.5rem 1rem;
  border: 1px solid #d0d0e0;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
}
</style>
