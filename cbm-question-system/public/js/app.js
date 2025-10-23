// CBM Question System - Frontend JavaScript

let currentQuestionId = null;

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    
    // Show selected section
    document.getElementById(section + 'Section').style.display = 'block';
    
    // Load section-specific data
    if (section === 'questions') {
        loadQuestions();
    } else if (section === 'stats') {
        loadStatistics();
    } else if (section === 'ai-testing') {
        loadAITestingResults();
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"alert\"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Upload form handler
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('qtiFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showAlert('Please select a file', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('qtiFile', file);

        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('uploadResults').innerHTML = '';

        try {
            const response = await fetch('/api/questions/upload-qti', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showAlert(`Successfully imported ${result.imported} questions!`, 'success');
                displayUploadResults(result);
            } else {
                showAlert(`Upload failed: ${result.error}`, 'danger');
            }
        } catch (error) {
            showAlert(`Upload failed: ${error.message}`, 'danger');
        } finally {
            document.getElementById('uploadProgress').style.display = 'none';
            fileInput.value = '';
        }
    });

    // Star rating functionality
    document.querySelectorAll('#starRating .fas').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            document.getElementById('ratingValue').value = rating;
            updateStarDisplay(rating);
        });

        star.addEventListener('mouseenter', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            updateStarDisplay(rating, true);
        });
    });

    document.getElementById('starRating').addEventListener('mouseleave', () => {
        const currentRating = parseInt(document.getElementById('ratingValue').value);
        updateStarDisplay(currentRating);
    });

    // Initialize with upload section
    showSection('upload');
});

function displayUploadResults(result) {
    const container = document.getElementById('uploadResults');
    
    let errorsHtml = '';
    if (result.errors && result.errors.length > 0) {
        errorsHtml = `
            <div class="alert alert-warning mt-3">
                <h6>Import Warnings (${result.errors.length}):</h6>
                ${result.errors.slice(0, 5).map(error => `
                    <div class="mb-1">
                        <strong>${error.question}:</strong> ${error.errors.join(', ')}
                    </div>
                `).join('')}
                ${result.errors.length > 5 ? '<div class="text-muted">... and more</div>' : ''}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="alert alert-success mt-3">
            <h6>Upload Complete!</h6>
            <p class="mb-0">Imported ${result.imported} out of ${result.total_parsed} questions successfully.</p>
        </div>
        ${errorsHtml}
    `;
}

// Load questions
async function loadQuestions() {
    const searchTerm = document.getElementById('searchInput').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const complexityFilter = document.getElementById('complexityFilter').value;
    
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (typeFilter) params.append('type', typeFilter);
    if (complexityFilter) params.append('complexity', complexityFilter);
    params.append('limit', 20);

    try {
        const response = await fetch(`/api/questions?${params.toString()}`);
        const result = await response.json();
        
        if (response.ok) {
            displayQuestions(result.questions);
        } else {
            showAlert('Failed to load questions', 'danger');
        }
    } catch (error) {
        showAlert('Error loading questions', 'danger');
    }
}

function displayQuestions(questions) {
    const container = document.getElementById('questionsList');
    
    if (questions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-question-circle fa-3x text-muted"></i>
                <h4 class="mt-3">No Questions Found</h4>
                <p class="text-muted">Try adjusting your filters or upload some QTI files.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = questions.map(question => `
        <div class="card question-card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">${escapeHtml(question.question_text.substring(0, 100))}...</h6>
                    <div class="d-flex gap-2">
                        <span class="badge bg-primary">${formatQuestionType(question.question_type)}</span>
                        <span class="badge bg-info complexity-badge">Level ${question.complexity_level}</span>
                    </div>
                </div>
                
                <div class="mb-2">
                    <small class="text-muted">
                        ${question.topic ? `Topic: ${escapeHtml(question.topic)} | ` : ''}
                        Created: ${new Date(question.created_at).toLocaleDateString()}
                    </small>
                </div>

                ${question.options && question.options.length > 0 ? `
                    <div class="mb-2">
                        <small class="text-muted">Options: ${JSON.parse(question.options).length}</small>
                    </div>
                ` : ''}
                
                <div class="d-flex justify-content-between align-items-center">
                    <div class="rating-display" id="rating-${question.id}">
                        <i class="fas fa-star-o"></i>
                        <small class="text-muted">No ratings yet</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="showRatingModal(${question.id})">
                        <i class="fas fa-star"></i> Rate Question
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Load ratings for each question
    questions.forEach(question => {
        loadQuestionRating(question.id);
    });
}

async function loadQuestionRating(questionId) {
    try {
        const response = await fetch(`/api/questions/${questionId}/ratings`);
        const result = await response.json();
        
        if (response.ok && result.total_ratings > 0) {
            const container = document.getElementById(`rating-${questionId}`);
            const stars = Math.round(result.average_rating);
            const starHtml = Array.from({length: 5}, (_, i) => 
                `<i class="fas fa-star${i < stars ? '' : '-o'}"></i>`
            ).join('');
            
            container.innerHTML = `
                ${starHtml}
                <small class="text-muted">${result.average_rating} (${result.total_ratings})</small>
            `;
        }
    } catch (error) {
        console.error('Error loading rating for question', questionId, error);
    }
}

function showRatingModal(questionId) {
    currentQuestionId = questionId;
    document.getElementById('ratingQuestionId').value = questionId;
    document.getElementById('ratingValue').value = '0';
    document.getElementById('reviewerName').value = '';
    document.getElementById('ratingFeedback').value = '';
    
    // Reset stars
    updateStarDisplay(0);
    
    const modal = new bootstrap.Modal(document.getElementById('ratingModal'));
    modal.show();
}

function updateStarDisplay(rating, hover = false) {
    const stars = document.querySelectorAll('#starRating .fas');
    stars.forEach((star, index) => {
        const starRating = index + 1;
        if (starRating <= rating) {
            star.classList.add(hover ? 'text-warning' : 'active');
            if (!hover) star.classList.remove('text-warning');
        } else {
            star.classList.remove('active', 'text-warning');
        }
    });
}

async function submitRating() {
    const questionId = document.getElementById('ratingQuestionId').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    const feedback = document.getElementById('ratingFeedback').value;
    const reviewerName = document.getElementById('reviewerName').value;
    
    if (!rating || rating < 1 || rating > 5) {
        showAlert('Please select a rating', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/questions/${questionId}/ratings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rating: rating,
                feedback: feedback,
                reviewer_name: reviewerName
            })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('Rating submitted successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('ratingModal')).hide();
            
            // Update the rating display
            loadQuestionRating(questionId);
        } else {
            showAlert(`Error: ${result.error}`, 'danger');
        }
    } catch (error) {
        showAlert('Failed to submit rating', 'danger');
    }
}

async function loadStatistics() {
    try {
        // Load question bank statistics
        const response = await fetch('/api/questions?limit=1000');
        const result = await response.json();
        
        if (response.ok) {
            const questions = result.questions;
            const totalQuestions = questions.length;
            const avgComplexity = questions.length > 0 ? 
                (questions.reduce((sum, q) => sum + q.complexity_level, 0) / questions.length).toFixed(1) : 0;
            
            document.getElementById('totalQuestions').textContent = totalQuestions;
            document.getElementById('avgComplexity').textContent = avgComplexity;
            
            // Load rating statistics
            loadRatingStatistics();
        }
    } catch (error) {
        showAlert('Error loading statistics', 'danger');
    }
}

async function loadRatingStatistics() {
    // This is a simplified approach - in a real system you might have dedicated endpoints
    document.getElementById('totalRatings').textContent = '-';
    document.getElementById('avgRating').textContent = '-';
}

// Utility functions
function formatQuestionType(type) {
    const types = {
        'multiple_choice': 'Multiple Choice',
        'true_false': 'True/False',
        'short_answer': 'Short Answer',
        'essay': 'Essay',
        'fill_blank': 'Fill in Blank'
    };
    return types[type] || type;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// AI Testing Functions
async function loadAITestingResults() {
    try {
        const response = await fetch('/api/ai-testing/results');
        const data = await response.json();
        
        if (response.ok) {
            updateAITestingOverview(data);
            if (data.hasData) {
                loadVendorResults(data);
                loadConfidenceAnalysis();
                loadCBMAnalysis();
                loadDetailedResults(data.results);
            }
        } else {
            showAlert('Failed to load AI testing results', 'danger');
        }
    } catch (error) {
        console.error('Error loading AI testing results:', error);
        showAlert('Error loading AI testing results', 'danger');
    }
}

function updateAITestingOverview(data) {
    if (data.hasData && data.summary.overall_stats) {
        const stats = data.summary.overall_stats;
        document.getElementById('totalTests').textContent = stats.total_tests || '-';
        document.getElementById('overallAccuracy').textContent = 
            stats.accuracy ? (stats.accuracy * 100).toFixed(1) + '%' : '-';
        document.getElementById('avgConfidence').textContent = 
            stats.avg_confidence ? stats.avg_confidence.toFixed(2) : '-';
        document.getElementById('avgCBMScore').textContent = 
            stats.avg_cbm_score ? stats.avg_cbm_score.toFixed(2) : '-';
    } else {
        document.getElementById('totalTests').textContent = '-';
        document.getElementById('overallAccuracy').textContent = '-';
        document.getElementById('avgConfidence').textContent = '-';
        document.getElementById('avgCBMScore').textContent = '-';
    }
}

function loadVendorResults(data) {
    const container = document.getElementById('vendorResultsContent');
    
    if (!data.hasData || !data.summary.by_vendor) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-robot fa-3x text-muted mb-3"></i>
                <p class="text-muted">No AI testing results available. Run a test to see vendor performance comparison.</p>
            </div>
        `;
        return;
    }

    const vendors = Object.entries(data.summary.by_vendor);
    
    container.innerHTML = `
        <div class="row">
            ${vendors.map(([vendor, stats]) => `
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">
                                <i class="fas fa-building"></i> ${vendor}
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-6">
                                    <h4 class="text-primary">${(stats.accuracy * 100).toFixed(1)}%</h4>
                                    <small class="text-muted">Accuracy</small>
                                </div>
                                <div class="col-6">
                                    <h4 class="text-success">${stats.avg_cbm_score.toFixed(2)}</h4>
                                    <small class="text-muted">CBM Score</small>
                                </div>
                            </div>
                            <hr>
                            <div class="row text-center">
                                <div class="col-4">
                                    <strong>${stats.total_tests}</strong>
                                    <br><small class="text-muted">Tests</small>
                                </div>
                                <div class="col-4">
                                    <strong>${stats.avg_confidence.toFixed(2)}</strong>
                                    <br><small class="text-muted">Confidence</small>
                                </div>
                                <div class="col-4">
                                    <strong>${stats.correct_answers}</strong>
                                    <br><small class="text-muted">Correct</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadConfidenceAnalysis() {
    try {
        const response = await fetch('/api/ai-testing/analysis/confidence');
        const data = await response.json();
        
        if (response.ok) {
            displayConfidenceAnalysis(data);
        }
    } catch (error) {
        console.error('Error loading confidence analysis:', error);
    }
}

function displayConfidenceAnalysis(data) {
    const container = document.getElementById('confidenceAnalysisContent');
    
    if (!data.confidence_buckets || Object.keys(data.confidence_buckets).length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                <p class="text-muted">No confidence analysis available. Run a test to see confidence vs accuracy correlation.</p>
            </div>
        `;
        return;
    }

    const buckets = Object.entries(data.confidence_buckets);
    
    container.innerHTML = `
        <div class="row mb-4">
            <div class="col-12">
                <h5>Confidence vs Accuracy Analysis</h5>
                <p class="text-muted">How well do AI models calibrate their confidence with actual performance?</p>
            </div>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Overall Statistics</h6>
                    </div>
                    <div class="card-body">
                        <div class="row text-center">
                            <div class="col-4">
                                <h4 class="text-primary">${(data.overall_stats.overall_accuracy * 100).toFixed(1)}%</h4>
                                <small class="text-muted">Overall Accuracy</small>
                            </div>
                            <div class="col-4">
                                <h4 class="text-info">${data.overall_stats.avg_confidence.toFixed(2)}</h4>
                                <small class="text-muted">Avg Confidence</small>
                            </div>
                            <div class="col-4">
                                <h4 class="text-success">${data.overall_stats.confidence_accuracy_correlation.toFixed(3)}</h4>
                                <small class="text-muted">Correlation</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Vendor Confidence Comparison</h6>
                    </div>
                    <div class="card-body">
                        ${Object.entries(data.vendor_confidence).map(([vendor, stats]) => `
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span>${vendor}</span>
                                <div>
                                    <span class="badge bg-primary">${(stats.accuracy * 100).toFixed(1)}%</span>
                                    <span class="badge bg-info">${stats.avg_confidence.toFixed(2)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Confidence Buckets</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Confidence Level</th>
                                        <th>Count</th>
                                        <th>Accuracy</th>
                                        <th>Avg Confidence</th>
                                        <th>CBM Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${buckets.map(([bucket, stats]) => `
                                        <tr>
                                            <td>${formatConfidenceBucket(bucket)}</td>
                                            <td>${stats.count}</td>
                                            <td>${(stats.accuracy * 100).toFixed(1)}%</td>
                                            <td>${stats.avg_confidence.toFixed(2)}</td>
                                            <td>${stats.avg_cbm_score.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadCBMAnalysis() {
    try {
        const response = await fetch('/api/ai-testing/analysis/cbm');
        const data = await response.json();
        
        if (response.ok) {
            displayCBMAnalysis(data);
        }
    } catch (error) {
        console.error('Error loading CBM analysis:', error);
    }
}

function displayCBMAnalysis(data) {
    const container = document.getElementById('cbmAnalysisContent');
    
    if (!data.score_distribution || Object.keys(data.score_distribution).length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-medal fa-3x text-muted mb-3"></i>
                <p class="text-muted">No CBM analysis available. Run a test to see confidence-based marking performance.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="row mb-4">
            <div class="col-12">
                <h5>Confidence-Based Marking (CBM) Analysis</h5>
                <p class="text-muted">CBM rewards confident correct answers and penalizes confident incorrect answers.</p>
            </div>
        </div>

        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Score Distribution</h6>
                    </div>
                    <div class="card-body">
                        ${Object.entries(data.score_distribution).map(([range, stats]) => `
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge ${getCBMBadgeClass(range)}">${formatCBMRange(range)}</span>
                                <div>
                                    <span>${stats.count} tests</span>
                                    <span class="text-muted">(${stats.percentage.toFixed(1)}%)</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">Vendor CBM Performance</h6>
                    </div>
                    <div class="card-body">
                        ${Object.entries(data.vendor_cbm_performance).map(([vendor, stats]) => `
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <strong>${vendor}</strong>
                                    <span class="badge bg-primary">${stats.avg_cbm_score.toFixed(2)}</span>
                                </div>
                                <div class="progress" style="height: 20px;">
                                    <div class="progress-bar bg-success" style="width: ${(stats.positive_scores / (stats.positive_scores + stats.negative_scores + stats.neutral_scores)) * 100}%">
                                        ${stats.positive_scores}
                                    </div>
                                    <div class="progress-bar bg-warning" style="width: ${(stats.neutral_scores / (stats.positive_scores + stats.negative_scores + stats.neutral_scores)) * 100}%">
                                        ${stats.neutral_scores}
                                    </div>
                                    <div class="progress-bar bg-danger" style="width: ${(stats.negative_scores / (stats.positive_scores + stats.negative_scores + stats.neutral_scores)) * 100}%">
                                        ${stats.negative_scores}
                                    </div>
                                </div>
                                <small class="text-muted">
                                    <span class="text-success">Positive: ${stats.positive_scores}</span> |
                                    <span class="text-warning">Neutral: ${stats.neutral_scores}</span> |
                                    <span class="text-danger">Negative: ${stats.negative_scores}</span>
                                </small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadDetailedResults(results) {
    const container = document.getElementById('detailedResultsContent');
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-list-alt fa-3x text-muted mb-3"></i>
                <p class="text-muted">No detailed results available. Run a test to see individual test results.</p>
            </div>
        `;
        return;
    }

    // Group results by question for better display
    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.question_id]) {
            acc[result.question_id] = [];
        }
        acc[result.question_id].push(result);
        return acc;
    }, {});

    container.innerHTML = `
        <div class="row mb-3">
            <div class="col-12">
                <h6>Individual Test Results (${results.length} total tests)</h6>
                <p class="text-muted">Showing results grouped by question. Click to expand details.</p>
            </div>
        </div>
        
        <div class="accordion" id="detailedResultsAccordion">
            ${Object.entries(groupedResults).slice(0, 10).map(([questionId, questionResults], index) => `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                            <div class="d-flex justify-content-between w-100 me-3">
                                <span>Question ${questionId}</span>
                                <div>
                                    <span class="badge bg-info">${questionResults.length} tests</span>
                                    <span class="badge bg-success">${questionResults.filter(r => r.is_correct).length} correct</span>
                                </div>
                            </div>
                        </button>
                    </h2>
                    <div id="collapse${index}" class="accordion-collapse collapse" data-bs-parent="#detailedResultsAccordion">
                        <div class="accordion-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Vendor</th>
                                            <th>Model</th>
                                            <th>Temp</th>
                                            <th>Answer</th>
                                            <th>Confidence</th>
                                            <th>Correct</th>
                                            <th>CBM Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${questionResults.slice(0, 20).map(result => `
                                            <tr>
                                                <td>${result.vendor}</td>
                                                <td><small>${result.model}</small></td>
                                                <td>${result.temperature}</td>
                                                <td><span class="badge bg-secondary">${result.response.selected_option}</span></td>
                                                <td>${result.response.confidence_level.toFixed(2)}</td>
                                                <td>
                                                    <i class="fas fa-${result.is_correct ? 'check text-success' : 'times text-danger'}"></i>
                                                </td>
                                                <td>
                                                    <span class="badge ${result.response.cbm_score > 0 ? 'bg-success' : result.response.cbm_score < 0 ? 'bg-danger' : 'bg-secondary'}">
                                                        ${result.response.cbm_score.toFixed(2)}
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${Object.keys(groupedResults).length > 10 ? `
            <div class="text-center mt-3">
                <small class="text-muted">Showing first 10 questions. Total: ${Object.keys(groupedResults).length} questions tested.</small>
            </div>
        ` : ''}
    `;
}

async function showConfigModal() {
    try {
        // Load current configuration
        const response = await fetch('/api/ai-testing/config');
        const config = await response.json();
        
        if (response.ok) {
            populateConfigModal(config);
            const modal = new bootstrap.Modal(document.getElementById('configModal'));
            modal.show();
        } else {
            showAlert('Failed to load configuration', 'danger');
        }
    } catch (error) {
        showAlert('Error loading configuration', 'danger');
    }
}

function populateConfigModal(config) {
    // Populate vendor selection
    const vendorContainer = document.getElementById('vendorSelection');
    vendorContainer.innerHTML = '';
    
    config.available_vendors.forEach(vendor => {
        const isConfigured = config.api_keys_configured[vendor];
        const isDisabled = !isConfigured;
        
        const checkboxHtml = `
            <div class="form-check">
                <input class="form-check-input vendor-checkbox" type="checkbox" 
                       id="vendor${vendor}" value="${vendor}" 
                       ${isDisabled ? 'disabled' : ''} 
                       ${isConfigured ? 'checked' : ''}>
                <label class="form-check-label ${isDisabled ? 'text-muted' : ''}" for="vendor${vendor}">
                    ${vendor} ${isConfigured ? 
                        '<i class="fas fa-check-circle text-success"></i>' : 
                        '<i class="fas fa-times-circle text-danger"></i> (No API key)'}
                </label>
            </div>
        `;
        vendorContainer.innerHTML += checkboxHtml;
    });
    
    // Set repetitions
    document.getElementById('numRepetitions').value = config.num_repetitions;
    
    // Update estimation
    updateTestEstimation();
    
    // Add event listeners for real-time estimation updates
    document.querySelectorAll('.vendor-checkbox, input[type="checkbox"][id^="temp"], #numRepetitions').forEach(input => {
        input.addEventListener('change', updateTestEstimation);
        input.addEventListener('input', updateTestEstimation);
    });
}

function updateTestEstimation() {
    const selectedVendors = document.querySelectorAll('.vendor-checkbox:checked').length;
    const selectedTemps = document.querySelectorAll('input[type="checkbox"][id^="temp"]:checked').length;
    const repetitions = parseInt(document.getElementById('numRepetitions').value) || 0;
    
    // Estimate based on average models per vendor (assume 3)
    const avgModelsPerVendor = 3;
    const totalTests = selectedVendors * avgModelsPerVendor * selectedTemps * repetitions * 10; // 10 questions
    
    const estimationDiv = document.getElementById('testEstimation');
    
    if (selectedVendors === 0 || selectedTemps === 0 || repetitions === 0) {
        estimationDiv.textContent = 'Select vendors, temperatures, and repetitions to see estimation';
        return;
    }
    
    const estimatedMinutes = Math.ceil(totalTests * 2 / 60); // Assume 2 seconds per test
    
    estimationDiv.innerHTML = `
        <strong>Estimated:</strong> ${totalTests} total tests<br>
        <strong>Time:</strong> ~${estimatedMinutes} minutes<br>
        <strong>Vendors:</strong> ${selectedVendors}, <strong>Temperatures:</strong> ${selectedTemps}, <strong>Repetitions:</strong> ${repetitions}
    `;
}

async function saveConfiguration() {
    const selectedVendors = Array.from(document.querySelectorAll('.vendor-checkbox:checked')).map(cb => cb.value);
    const selectedTemps = Array.from(document.querySelectorAll('input[type="checkbox"][id^="temp"]:checked')).map(cb => parseFloat(cb.value));
    const numRepetitions = parseInt(document.getElementById('numRepetitions').value);
    
    // Clear previous errors
    const errorDiv = document.getElementById('configErrors');
    errorDiv.style.display = 'none';
    
    // Validate
    if (selectedVendors.length === 0) {
        errorDiv.textContent = 'Please select at least one AI vendor';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (selectedTemps.length === 0) {
        errorDiv.textContent = 'Please select at least one temperature setting';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!numRepetitions || numRepetitions < 1 || numRepetitions > 10) {
        errorDiv.textContent = 'Number of repetitions must be between 1 and 10';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/ai-testing/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_vendors: selectedVendors,
                temperatures: selectedTemps,
                num_repetitions: numRepetitions
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Configuration saved successfully!', 'success');
            
            // Enable the run test button
            document.getElementById('runTestBtn').disabled = false;
            
            // Update the configuration display
            updateConfigDisplay(result.config);
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
        } else {
            errorDiv.textContent = result.error || 'Failed to save configuration';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error saving configuration: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

function updateConfigDisplay(config) {
    // Update the configuration info panel
    const configPanel = document.querySelector('#ai-testingSection .col-md-6:nth-child(2) .card-body');
    
    configPanel.innerHTML = `
        <div class="row">
            <div class="col-6">
                <strong>Selected Vendors:</strong>
                <ul class="list-unstyled small">
                    ${config.selected_vendors.map(vendor => `<li>• ${vendor}</li>`).join('')}
                </ul>
            </div>
            <div class="col-6">
                <strong>Parameters:</strong>
                <ul class="list-unstyled small">
                    <li>• Temperatures: ${config.temperatures.join(', ')}</li>
                    <li>• Repetitions: ${config.num_repetitions} per model</li>
                    <li>• CBM Scoring: Enabled</li>
                    <li>• Confidence Analysis: Yes</li>
                </ul>
            </div>
        </div>
    `;
}

async function runAITest() {
    const runButton = document.getElementById('runTestBtn');
    const progressBar = document.getElementById('testProgress');
    const statusDiv = document.getElementById('testStatus');
    
    // Disable button and show progress
    runButton.disabled = true;
    runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running Tests...';
    progressBar.style.display = 'block';
    statusDiv.style.display = 'block';
    statusDiv.className = 'alert alert-info';
    statusDiv.textContent = 'Starting AI testing... This may take several minutes.';
    
    try {
        const response = await fetch('/api/ai-testing/run-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            statusDiv.className = 'alert alert-success';
            statusDiv.textContent = result.message;
            
            // Reload results after a short delay
            setTimeout(() => {
                loadAITestingResults();
            }, 2000);
        } else {
            if (result.requires_config) {
                statusDiv.className = 'alert alert-warning';
                statusDiv.innerHTML = `
                    ${result.error}<br>
                    <button class="btn btn-primary btn-sm mt-2" onclick="showConfigModal()">
                        <i class="fas fa-cog"></i> Configure Now
                    </button>
                `;
            } else {
                statusDiv.className = 'alert alert-danger';
                statusDiv.textContent = `Error: ${result.error || 'Failed to start AI testing'}`;
            }
        }
    } catch (error) {
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = `Error: ${error.message}`;
    } finally {
        // Re-enable button
        runButton.disabled = false;
        runButton.innerHTML = '<i class="fas fa-play"></i> Run AI Testing';
        progressBar.style.display = 'none';
    }
}

// Helper functions for AI testing
function formatConfidenceBucket(bucket) {
    const bucketNames = {
        'very_low': 'Very Low (0.0-0.2)',
        'low': 'Low (0.2-0.4)',
        'medium': 'Medium (0.4-0.6)',
        'high': 'High (0.6-0.8)',
        'very_high': 'Very High (0.8-1.0)'
    };
    return bucketNames[bucket] || bucket;
}

function formatCBMRange(range) {
    const rangeNames = {
        'excellent': 'Excellent (1.5-2.0)',
        'good': 'Good (0.5-1.5)',
        'neutral': 'Neutral (-0.5-0.5)',
        'poor': 'Poor (-1.5--0.5)',
        'very_poor': 'Very Poor (-2.0--1.5)'
    };
    return rangeNames[range] || range;
}

function getCBMBadgeClass(range) {
    const classes = {
        'excellent': 'bg-success',
        'good': 'bg-primary',
        'neutral': 'bg-secondary',
        'poor': 'bg-warning',
        'very_poor': 'bg-danger'
    };
    return classes[range] || 'bg-secondary';
}
