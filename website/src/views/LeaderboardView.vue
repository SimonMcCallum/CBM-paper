<template>
  <div>
    <h1>Leaderboard</h1>

    <div class="filter-bar">
      <select v-model="selectedDataset">
        <option value="overall">All Datasets</option>
        <option v-for="ds in datasets" :key="ds" :value="ds">{{ ds }}</option>
      </select>
      <select v-model="selectedVariant">
        <option v-for="v in variants" :key="v" :value="v">{{ formatVariant(v) }}</option>
      </select>
      <select v-model="selectedVendor">
        <option value="all">All Vendors</option>
        <option v-for="v in vendors" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('rank')">#</th>
            <th @click="sortBy('name')">Model</th>
            <th @click="sortBy('vendor')">Vendor</th>
            <th @click="sortBy('accuracy')">Accuracy {{ sortIndicator('accuracy') }}</th>
            <th @click="sortBy('avg_score')">Avg Score {{ sortIndicator('avg_score') }}</th>
            <th @click="sortBy('avg_confidence')">Avg Confidence {{ sortIndicator('avg_confidence') }}</th>
            <th @click="sortBy('ece')">ECE {{ sortIndicator('ece') }}</th>
            <th @click="sortBy('brier_score')">Brier {{ sortIndicator('brier_score') }}</th>
            <th @click="sortBy('n_questions')">N</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in filteredModels" :key="row.id">
            <td>{{ idx + 1 }}</td>
            <td>
              <router-link :to="{ name: 'model', params: { id: row.id } }">
                {{ row.name }}
              </router-link>
            </td>
            <td><span :class="'badge badge-' + row.vendor">{{ row.vendor }}</span></td>
            <td>{{ formatPct(row.accuracy) }}</td>
            <td>{{ row.avg_score?.toFixed(2) ?? '—' }}</td>
            <td>{{ row.avg_confidence?.toFixed(2) ?? '—' }}</td>
            <td :class="eceClass(row.ece)">{{ row.ece?.toFixed(3) ?? '—' }}</td>
            <td>{{ row.brier_score?.toFixed(3) ?? '—' }}</td>
            <td>{{ row.n_questions ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useData } from '../composables/useData.js'

const { leaderboard, loadLeaderboard } = useData()

const selectedDataset = ref('overall')
const selectedVariant = ref('')
const selectedVendor = ref('all')
const sortField = ref('accuracy')
const sortAsc = ref(false)

onMounted(async () => {
  await loadLeaderboard()
  if (leaderboard.value?.variants?.length) {
    selectedVariant.value = leaderboard.value.variants[0]
  }
})

const datasets = computed(() => leaderboard.value?.datasets || [])
const variants = computed(() => leaderboard.value?.variants || [])
const vendors = computed(() => {
  const v = new Set((leaderboard.value?.models || []).map(m => m.vendor))
  return [...v].sort()
})

const filteredModels = computed(() => {
  if (!leaderboard.value?.models) return []

  let rows = leaderboard.value.models.map(m => {
    let stats
    if (selectedDataset.value === 'overall') {
      stats = m.overall?.[selectedVariant.value] || {}
    } else {
      stats = m.results?.[selectedDataset.value]?.[selectedVariant.value] || {}
    }
    return {
      id: m.id,
      name: m.name,
      vendor: m.vendor,
      ...stats,
    }
  })

  if (selectedVendor.value !== 'all') {
    rows = rows.filter(r => r.vendor === selectedVendor.value)
  }

  rows.sort((a, b) => {
    const av = a[sortField.value] ?? -Infinity
    const bv = b[sortField.value] ?? -Infinity
    return sortAsc.value ? av - bv : bv - av
  })

  return rows
})

function sortBy(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = field === 'ece' || field === 'brier_score'
  }
}

function sortIndicator(field) {
  if (sortField.value !== field) return ''
  return sortAsc.value ? '▲' : '▼'
}

function formatPct(val) {
  return val != null ? (val * 100).toFixed(1) + '%' : '—'
}

function formatVariant(v) {
  return v.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function eceClass(ece) {
  if (ece == null) return ''
  if (ece < 0.05) return 'good'
  if (ece < 0.15) return 'ok'
  return 'bad'
}
</script>

<style scoped>
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
.good { color: #16a34a; font-weight: 600; }
.ok { color: #ca8a04; }
.bad { color: #dc2626; font-weight: 600; }
</style>
