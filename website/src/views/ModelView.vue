<template>
  <div>
    <h1>{{ modelDetail?.id || id }}</h1>
    <p v-if="modelDetail">Vendor: <span :class="'badge badge-' + modelDetail.vendor">{{ modelDetail.vendor }}</span></p>

    <div v-if="modelDetail" class="stat-grid">
      <div class="stat-card" v-for="(stats, variant) in modelDetail.by_variant" :key="variant">
        <div class="value">{{ formatPct(stats.accuracy) }}</div>
        <div class="label">{{ formatVariant(variant) }}</div>
        <div class="sub">Score: {{ stats.avg_score?.toFixed(2) }} | ECE: {{ stats.ece?.toFixed(3) }}</div>
      </div>
    </div>

    <div v-if="modelDetail" class="card">
      <h2>By Dataset</h2>
      <table>
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Accuracy</th>
            <th>Avg Score</th>
            <th>Avg Confidence</th>
            <th>ECE</th>
            <th>Brier</th>
            <th>N</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(stats, ds) in modelDetail.by_dataset" :key="ds">
            <td>{{ ds }}</td>
            <td>{{ formatPct(stats.accuracy) }}</td>
            <td>{{ stats.avg_score?.toFixed(2) }}</td>
            <td>{{ stats.avg_confidence?.toFixed(2) }}</td>
            <td>{{ stats.ece?.toFixed(3) }}</td>
            <td>{{ stats.brier_score?.toFixed(3) }}</td>
            <td>{{ stats.n_questions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modelDetail" class="card">
      <h2>By Temperature</h2>
      <table>
        <thead>
          <tr>
            <th>Temperature</th>
            <th>Accuracy</th>
            <th>Avg Score</th>
            <th>Avg Confidence</th>
            <th>ECE</th>
            <th>N</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(stats, temp) in modelDetail.by_temperature" :key="temp">
            <td>{{ temp }}</td>
            <td>{{ formatPct(stats.accuracy) }}</td>
            <td>{{ stats.avg_score?.toFixed(2) }}</td>
            <td>{{ stats.avg_confidence?.toFixed(2) }}</td>
            <td>{{ stats.ece?.toFixed(3) }}</td>
            <td>{{ stats.n_questions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="calibrationData" class="card">
      <h2>Reliability Diagram</h2>
      <div class="chart-container">
        <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-if="!modelDetail" class="card">
      <p>Loading model details for {{ id }}...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement } from 'chart.js'
import { useData } from '../composables/useData.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement)

const props = defineProps({ id: String })
const { loadModelDetail, loadCalibration } = useData()

const modelDetail = ref(null)
const calibrationData = ref(null)

onMounted(async () => {
  modelDetail.value = await loadModelDetail(props.id)
  calibrationData.value = await loadCalibration()
})

watch(() => props.id, async (newId) => {
  modelDetail.value = await loadModelDetail(newId)
})

const chartData = computed(() => {
  if (!calibrationData.value || !calibrationData.value[props.id]) return null
  const firstVariant = Object.keys(calibrationData.value[props.id])[0]
  const bins = calibrationData.value[props.id][firstVariant] || []

  return {
    labels: bins.map(b => b.bin_center.toFixed(1)),
    datasets: [
      {
        label: 'Accuracy',
        data: bins.map(b => b.accuracy),
        backgroundColor: 'rgba(37, 99, 235, 0.6)',
      },
      {
        label: 'Perfect Calibration',
        data: bins.map(b => b.bin_center),
        backgroundColor: 'rgba(200, 200, 200, 0.3)',
        borderColor: '#999',
        borderWidth: 1,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  plugins: {
    title: { display: true, text: 'Confidence vs Accuracy' },
  },
  scales: {
    y: { min: 0, max: 1, title: { display: true, text: 'Accuracy' } },
    x: { title: { display: true, text: 'Confidence Bin' } },
  },
}

function formatPct(val) {
  return val != null ? (val * 100).toFixed(1) + '%' : '—'
}

function formatVariant(v) {
  return v.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}
</script>

<style scoped>
a { color: #2563eb; }
.sub { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
.chart-container { max-width: 600px; margin: 0 auto; }
</style>
