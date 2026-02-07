<template>
  <div>
    <h1>CBM AI Benchmark Dashboard</h1>
    <p class="subtitle">Confidence-Based Marking evaluation for Large Language Models</p>

    <div v-if="leaderboard" class="stat-grid">
      <div class="stat-card">
        <div class="value">{{ leaderboard.models?.length || 0 }}</div>
        <div class="label">Models Tested</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ leaderboard.datasets?.length || 0 }}</div>
        <div class="label">Datasets</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ leaderboard.variants?.length || 0 }}</div>
        <div class="label">Confidence Variants</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ bestModel?.name || '—' }}</div>
        <div class="label">Best Calibrated Model</div>
      </div>
    </div>

    <div v-if="leaderboard" class="card">
      <h2>Quick Leaderboard (Overall Accuracy)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Model</th>
            <th>Vendor</th>
            <th>Accuracy</th>
            <th>Avg Score</th>
            <th>ECE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(model, idx) in topModels" :key="model.id">
            <td>{{ idx + 1 }}</td>
            <td>
              <router-link :to="{ name: 'model', params: { id: model.id } }">
                {{ model.name }}
              </router-link>
            </td>
            <td><span :class="'badge badge-' + model.vendor">{{ model.vendor }}</span></td>
            <td>{{ formatPct(model.accuracy) }}</td>
            <td>{{ model.avgScore?.toFixed(2) || '—' }}</td>
            <td>{{ model.ece?.toFixed(3) || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top: 1rem;">
        <router-link to="/leaderboard">View full leaderboard →</router-link>
      </p>
    </div>

    <div v-if="!leaderboard" class="card">
      <h2>No Data Available</h2>
      <p>Run benchmarks and export results to see the dashboard.</p>
      <pre>python -m benchmark.run_benchmark --dataset mmlu --variant all
python -m benchmark.run_export</pre>
    </div>

    <div class="card">
      <h2>About This Benchmark</h2>
      <p>This system evaluates LLMs using <strong>Confidence-Based Marking (CBM)</strong>,
        where models must report their confidence alongside answers. The scoring rewards
        well-calibrated confidence and penalizes overconfidence on wrong answers.</p>
      <p style="margin-top: 0.5rem;">
        Four variants are tested: <strong>Discrete CBM</strong> (3-level) and
        <strong>Continuous HLCC</strong> scoring, each with <strong>Combined</strong>
        (single-turn) and <strong>Linear</strong> (two-turn) prompting.
      </p>
      <p style="margin-top: 0.5rem;">
        <router-link to="/methodology">Read the full methodology →</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useData } from '../composables/useData.js'

const { leaderboard, loadLeaderboard } = useData()

onMounted(() => loadLeaderboard())

const topModels = computed(() => {
  if (!leaderboard.value?.models) return []
  return leaderboard.value.models
    .map(m => {
      const firstVariant = Object.keys(m.overall || {})[0]
      const stats = m.overall?.[firstVariant] || {}
      return {
        id: m.id,
        name: m.name,
        vendor: m.vendor,
        accuracy: stats.accuracy || 0,
        avgScore: stats.avg_score,
        ece: stats.ece,
      }
    })
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 10)
})

const bestModel = computed(() => {
  if (!leaderboard.value?.models) return null
  let best = null
  let bestEce = Infinity
  for (const m of leaderboard.value.models) {
    for (const stats of Object.values(m.overall || {})) {
      if (stats.ece != null && stats.ece < bestEce) {
        bestEce = stats.ece
        best = m
      }
    }
  }
  return best
})

function formatPct(val) {
  return val != null ? (val * 100).toFixed(1) + '%' : '—'
}
</script>

<style scoped>
.subtitle {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

pre {
  background: #f0f0f8;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  overflow-x: auto;
}

a {
  color: #2563eb;
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
</style>
