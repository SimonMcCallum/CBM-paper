/**
 * PDF Novelty Detector — Frontend Logic
 * Handles file upload, cost estimation, API key management, and results rendering.
 */

const BASE = '/novelty';

// ── Provider Model Mapping ──────────────────────────────────────────
const PROVIDER_MODELS = {
    ollama: ['llama3.2', 'llama3.1', 'mistral', 'gemma2'],
    google: ['gemini-2.0-flash', 'gemini-1.5-flash'],
    openai: ['gpt-4o-mini', 'gpt-4o'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
};

const PROVIDER_KEY_NAMES = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
};

// ── Initialization ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const providerSelect = document.getElementById('llm-provider');
    const modelSelect = document.getElementById('llm-model');

    if (!dropZone) return; // Not on index page

    // Populate models for default provider
    updateModels();

    // Provider change → update models, API key section, cost
    providerSelect.addEventListener('change', () => {
        updateModels();
        updateApiKeySection();
        updateCostEstimate();
    });

    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            onFileSelected();
        }
    });

    fileInput.addEventListener('change', onFileSelected);

    // Analyze button
    analyzeBtn.addEventListener('click', doAnalyze);

    // Update API key section for initial provider
    updateApiKeySection();
});

// ── File Selection ──────────────────────────────────────────────────
function onFileSelected() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const fileName = document.getElementById('file-name');
    fileName.textContent = file.name;
    fileName.classList.remove('hidden');

    document.getElementById('analyze-btn').disabled = false;

    // File info
    const info = document.getElementById('file-info');
    const sizeKB = (file.size / 1024).toFixed(1);
    const estWords = Math.round(file.size / 6);
    info.innerHTML = `
        <p><strong>Name:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${sizeKB} KB</p>
        <p><strong>Est. Words:</strong> ~${estWords.toLocaleString()}</p>
    `;

    updateCostEstimate();

    // Hide previous results/errors
    hide('results-section');
    hide('error-section');
}

// ── Model Dropdown ──────────────────────────────────────────────────
function updateModels() {
    const provider = document.getElementById('llm-provider').value;
    const modelSelect = document.getElementById('llm-model');
    const models = PROVIDER_MODELS[provider] || [];

    modelSelect.innerHTML = models.map((m, i) =>
        `<option value="${m}" ${i === 0 ? 'selected' : ''}>${m}</option>`
    ).join('');
}

// ── API Key Section ─────────────────────────────────────────────────
function updateApiKeySection() {
    const provider = document.getElementById('llm-provider').value;
    const section = document.getElementById('api-key-section');
    const label = document.getElementById('api-key-label');
    const input = document.getElementById('api-key-input');
    const serverNote = document.getElementById('server-key-note');

    if (provider === 'ollama') {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    const name = PROVIDER_KEY_NAMES[provider] || provider;
    label.textContent = name + ' API Key';

    // Load from localStorage
    const stored = localStorage.getItem('novelty_key_' + provider);
    input.value = stored || '';

    // Save on change
    input.onchange = () => {
        if (input.value.trim()) {
            localStorage.setItem('novelty_key_' + provider, input.value.trim());
        } else {
            localStorage.removeItem('novelty_key_' + provider);
        }
    };

    // Check if server has key
    fetch(BASE + '/api/providers')
        .then(r => r.json())
        .then(d => {
            const p = d.llm_providers.find(x => x.id === provider);
            if (p && p.server_key_configured) {
                serverNote.classList.remove('hidden');
            } else {
                serverNote.classList.add('hidden');
            }
        })
        .catch(() => serverNote.classList.add('hidden'));
}

// ── Cost Estimation ─────────────────────────────────────────────────
function updateCostEstimate() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const chunkSize = parseInt(document.getElementById('chunk-size').value) || 150;
    const overlap = parseInt(document.getElementById('overlap').value) || 20;

    fetch(BASE + '/api/estimate-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_size: file.size, chunk_size: chunkSize, overlap: overlap }),
    })
    .then(r => r.json())
    .then(d => {
        const el = document.getElementById('cost-estimates');
        if (d.estimates) {
            el.innerHTML = d.estimates.map(e => {
                const active = e.provider === document.getElementById('llm-provider').value;
                return `
                    <div class="p-3 rounded border ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} cursor-pointer" onclick="selectProvider('${e.provider}')">
                        <div class="flex justify-between items-center">
                            <span class="font-medium text-sm">${e.provider_name}</span>
                            <span class="font-mono text-sm font-bold ${e.total_cost === 0 ? 'text-green-600' : 'text-gray-800'}">${e.formatted_cost}</span>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${e.tier} &middot; ${e.chunks} chunks</div>
                    </div>
                `;
            }).join('');
        }
    })
    .catch(() => {});
}

function selectProvider(provider) {
    document.getElementById('llm-provider').value = provider;
    updateModels();
    updateApiKeySection();
    updateCostEstimate();
}

// ── Analysis ────────────────────────────────────────────────────────
function doAnalyze() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) return;

    const provider = document.getElementById('llm-provider').value;

    // Build form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chunk_size', document.getElementById('chunk-size').value);
    formData.append('overlap', document.getElementById('overlap').value);
    formData.append('llm_provider', provider);
    formData.append('llm_model', document.getElementById('llm-model').value);
    formData.append('k_neighbors', document.getElementById('k-neighbors').value);
    formData.append('embedding_provider', document.getElementById('embed-provider').value);
    formData.append('chunking_mode', document.getElementById('chunking-mode').value);

    // Build headers with API keys
    const headers = {};
    const headerMap = { anthropic: 'X-Api-Key-Anthropic', openai: 'X-Api-Key-Openai', google: 'X-Api-Key-Google' };
    for (const [p, h] of Object.entries(headerMap)) {
        const key = localStorage.getItem('novelty_key_' + p);
        if (key) headers[h] = key;
    }

    // Show progress
    show('progress-section');
    hide('results-section');
    hide('error-section');
    document.getElementById('analyze-btn').disabled = true;

    const progressBar = document.getElementById('progress-bar');
    const progressStatus = document.getElementById('progress-status');
    progressBar.style.width = '10%';
    progressStatus.textContent = 'Uploading...';

    // Simulate progress (actual analysis is server-side)
    let progress = 10;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 3;
            progressBar.style.width = progress + '%';
            if (progress > 30) progressStatus.textContent = 'Generating prompts...';
            if (progress > 60) progressStatus.textContent = 'Computing embeddings...';
            if (progress > 80) progressStatus.textContent = 'Calculating novelty...';
        }
    }, 1000);

    fetch(BASE + '/api/upload', { method: 'POST', headers, body: formData })
        .then(r => {
            if (!r.ok) return r.json().then(d => { throw new Error(d.error || 'Server error'); });
            return r.json();
        })
        .then(data => {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressStatus.textContent = 'Complete!';

            setTimeout(() => {
                hide('progress-section');
                renderResults(data);
            }, 500);
        })
        .catch(err => {
            clearInterval(progressInterval);
            hide('progress-section');
            show('error-section');
            document.getElementById('error-message').textContent = err.message;
        })
        .finally(() => {
            document.getElementById('analyze-btn').disabled = false;
        });
}

// ── Results Rendering ───────────────────────────────────────────────
function renderResults(data) {
    show('results-section');

    const stats = data.statistics;

    document.getElementById('stat-chunks').textContent = stats.total_chunks;
    document.getElementById('stat-mean').textContent = stats.mean_novelty.toFixed(3);
    document.getElementById('stat-high').textContent = stats.high_novelty_count;
    document.getElementById('stat-low').textContent = stats.very_low_novelty_count;

    // Distribution bar
    const total = stats.total_chunks;
    const bar = document.getElementById('distribution-bar');
    bar.innerHTML = '';
    const segments = [
        { count: stats.high_novelty_count, cls: 'bg-green-500' },
        { count: stats.medium_novelty_count, cls: 'bg-yellow-400' },
        { count: stats.low_novelty_count, cls: 'bg-orange-400' },
        { count: stats.very_low_novelty_count, cls: 'bg-red-500' },
    ];
    segments.forEach(s => {
        if (s.count > 0) {
            const pct = (s.count / total * 100).toFixed(1);
            const div = document.createElement('div');
            div.className = s.cls;
            div.style.width = pct + '%';
            div.title = s.count + ' chunks (' + pct + '%)';
            bar.appendChild(div);
        }
    });

    // Download links
    document.getElementById('download-pdf').href = data.download_url;
    document.getElementById('download-json').href = data.results_url;

    // Chunk list
    const chunkList = document.getElementById('chunk-list');
    chunkList.innerHTML = (data.novelty_scores || []).map(chunk => {
        const score = chunk.novelty_score;
        const colorClass = score > 0.7 ? 'novelty-high' : score > 0.4 ? 'novelty-medium' : score > 0.2 ? 'novelty-low' : 'novelty-very-low';
        return `
            <div class="p-3 rounded ${colorClass} flex items-start gap-3">
                <div class="text-center min-w-[50px]">
                    <div class="text-lg font-bold">${score.toFixed(2)}</div>
                    <div class="text-xs opacity-75">#${chunk.chunk_index}</div>
                </div>
                <div class="text-sm flex-1 opacity-90">${escapeHtml(chunk.text_preview)}</div>
            </div>
        `;
    }).join('');

    if (data.novelty_scores && data.novelty_scores.length >= 10) {
        chunkList.innerHTML += '<p class="text-center text-sm text-gray-500 py-2">Showing first 10 chunks. Download JSON for full results.</p>';
    }
}

// ── Helpers ──────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
