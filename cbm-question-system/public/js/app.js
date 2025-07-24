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
