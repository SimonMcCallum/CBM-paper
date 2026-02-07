<template>
  <div>
    <h1>Calibration Under Uncertainty</h1>
    <p class="subtitle">
      How well do models calibrate confidence on questions with no single correct answer?
      Lower calibration gap = better calibrated.
    </p>

    <div v-if="ambiguous?.models?.length" class="card">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('rank')">#</th>
            <th @click="sortBy('id')">Model</th>
            <th @click="sortBy('vendor')">Vendor</th>
            <th @click="sortBy('avg_confidence_on_ambiguous')">Avg Confidence</th>
            <th @click="sortBy('ideal_avg_confidence')">Ideal Confidence</th>
            <th @click="sortBy('calibration_gap')">Calibration Gap {{ sortInd('calibration_gap') }}</th>
            <th @click="sortBy('overconfidence_rate')">Overconfidence Rate</th>
            <th>N</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(model, idx) in sortedModels" :key="model.id">
            <td>{{ idx + 1 }}</td>
            <td>
              <router-link :to="{ name: 'model', params: { id: model.id } }">
                {{ model.id }}
              </router-link>
            </td>
            <td><span :class="'badge badge-' + model.vendor">{{ model.vendor }}</span></td>
            <td>{{ model.avg_confidence_on_ambiguous?.toFixed(3) }}</td>
            <td>{{ model.ideal_avg_confidence?.toFixed(3) }}</td>
            <td :class="gapClass(model.calibration_gap)">
              {{ model.calibration_gap?.toFixed(3) }}
            </td>
            <td>{{ formatPct(model.overconfidence_rate) }}</td>
            <td>{{ model.n_questions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="card">
      <h2>No Ambiguous Question Data</h2>
      <p>Run the ambiguous benchmark to see results here:</p>
      <pre>python -m benchmark.run_benchmark --dataset ambiguous --variant all</pre>
    </div>

    <div class="card">
      <h2>About Ambiguous Questions</h2>
      <p>These questions are deliberately designed to have no single correct answer.
        Categories include:</p>
      <ul>
        <li><strong>Insufficient information</strong> &mdash; the answer depends on unspecified context</li>
        <li><strong>Genuinely disputed</strong> &mdash; experts disagree on the answer</li>
        <li><strong>Statistical/probabilistic</strong> &mdash; the correct answer varies by frequency</li>
        <li><strong>Temporal ambiguity</strong> &mdash; the answer depends on when it is asked</li>
      </ul>
      <p style="margin-top: 0.5rem;">
        A well-calibrated model should report <strong>low confidence</strong> on these questions.
        The calibration gap measures how much the model's reported confidence exceeds the ideal level.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useData } from '../composables/useData.js'

const { ambiguous, loadAmbiguous } = useData()

const sortField = ref('calibration_gap')
const sortAsc = ref(true)

onMounted(() => loadAmbiguous())

const sortedModels = computed(() => {
  const models = [...(ambiguous.value?.models || [])]
  models.sort((a, b) => {
    const av = a[sortField.value] ?? Infinity
    const bv = b[sortField.value] ?? Infinity
    return sortAsc.value ? av - bv : bv - av
  })
  return models
})

function sortBy(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = true
  }
}

function sortInd(field) {
  if (sortField.value !== field) return ''
  return sortAsc.value ? '▲' : '▼'
}

function formatPct(val) {
  return val != null ? (val * 100).toFixed(1) + '%' : '—'
}

function gapClass(gap) {
  if (gap == null) return ''
  if (gap < 0.1) return 'good'
  if (gap < 0.3) return 'ok'
  return 'bad'
}
</script>

<style scoped>
.subtitle { color: #666; margin-bottom: 2rem; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
ul { margin: 0.5rem 0 0 1.5rem; }
li { margin-bottom: 0.25rem; }
pre { background: #f0f0f8; padding: 1rem; border-radius: 6px; font-size: 0.85rem; }
.good { color: #16a34a; font-weight: 600; }
.ok { color: #ca8a04; }
.bad { color: #dc2626; font-weight: 600; }
</style>
