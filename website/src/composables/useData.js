import { ref, readonly } from 'vue'

const cache = {}

async function fetchJSON(path) {
  if (cache[path]) return cache[path]

  try {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Failed to load ${path}`)
    const data = await response.json()
    cache[path] = data
    return data
  } catch (err) {
    console.warn(`Could not load ${path}:`, err.message)
    return null
  }
}

export function useData() {
  const leaderboard = ref(null)
  const calibration = ref(null)
  const ambiguous = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function loadLeaderboard() {
    loading.value = true
    try {
      leaderboard.value = await fetchJSON('./data/leaderboard.json')
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
    return leaderboard.value
  }

  async function loadCalibration() {
    calibration.value = await fetchJSON('./data/calibration.json')
    return calibration.value
  }

  async function loadAmbiguous() {
    ambiguous.value = await fetchJSON('./data/ambiguous.json')
    return ambiguous.value
  }

  async function loadModelDetail(modelId) {
    const safeName = modelId.replace(/\//g, '_').replace(/:/g, '_')
    return await fetchJSON(`./data/model_details/${safeName}.json`)
  }

  return {
    leaderboard: readonly(leaderboard),
    calibration: readonly(calibration),
    ambiguous: readonly(ambiguous),
    loading: readonly(loading),
    error: readonly(error),
    loadLeaderboard,
    loadCalibration,
    loadAmbiguous,
    loadModelDetail,
  }
}
