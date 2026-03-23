"""
Flask server for PDF novelty detection.
Provides REST API endpoints and web UI for uploading PDFs, analyzing novelty,
and downloading annotated results. Uses Blueprint at /novelty prefix.
"""

import os
import json
from pathlib import Path
from flask import Flask, Blueprint, request, jsonify, send_file, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import traceback

from pdf_processor import PDFProcessor
from novelty_detector import NoveltyDetector
from ollama_client import OllamaClient
from cost_config import (
    PROVIDERS, EMBEDDING_PROVIDERS,
    estimate_cost, estimate_cost_all_providers,
)

# Load environment variables
load_dotenv()

# Create Blueprint
novelty_bp = Blueprint(
    'novelty', __name__,
    url_prefix='/novelty',
    template_folder='templates',
    static_folder='static',
    static_url_path='/static',
)

# Configuration
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))
ALLOWED_EXTENSIONS = {'pdf'}

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_api_keys(req):
    """Extract user-supplied API keys from request headers."""
    keys = {}
    header_map = {
        'X-Api-Key-Anthropic': 'anthropic',
        'X-Api-Key-Openai': 'openai',
        'X-Api-Key-Google': 'google',
    }
    for header, provider in header_map.items():
        val = req.headers.get(header, '').strip()
        if val:
            keys[provider] = val
    return keys


# ── Page Routes ──────────────────────────────────────────────────────

@novelty_bp.route('/', methods=['GET'])
@novelty_bp.route('', methods=['GET'])
def index():
    """Main page with upload UI."""
    return render_template('index.html')


@novelty_bp.route('/admin', methods=['GET'])
def admin():
    """Admin panel."""
    return render_template('admin.html')


@novelty_bp.route('/about', methods=['GET'])
def about():
    """About page with algorithm explanation."""
    return render_template('about.html')


# ── API Routes ───────────────────────────────────────────────────────

@novelty_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'PDF Novelty Detection Server',
        'version': '2.0.0'
    })


@novelty_bp.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration."""
    return jsonify({
        'chunk_size': int(os.getenv('DEFAULT_CHUNK_SIZE', 150)),
        'overlap': int(os.getenv('CHUNK_OVERLAP', 20)),
        'novelty_thresholds': {
            'high': float(os.getenv('NOVELTY_THRESHOLD_HIGH', 0.7)),
            'medium': float(os.getenv('NOVELTY_THRESHOLD_MEDIUM', 0.4)),
            'low': float(os.getenv('NOVELTY_THRESHOLD_LOW', 0.2))
        },
        'embedding_model': os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
        'embedding_provider': os.getenv('EMBEDDING_PROVIDER', 'local'),
        'default_llm_provider': os.getenv('DEFAULT_LLM_PROVIDER', 'ollama'),
        'max_upload_size': MAX_CONTENT_LENGTH
    })


@novelty_bp.route('/api/providers', methods=['GET'])
def list_providers():
    """List available LLM and embedding providers with status."""
    llm_providers = []
    for pid, pdata in PROVIDERS.items():
        entry = {
            'id': pid,
            'name': pdata['name'],
            'tier': pdata['tier'],
            'requires_key': pdata['requires_key'],
            'models': list(pdata['models'].keys()),
            'default_model': pdata['default_model'],
        }
        # Check if server has a key configured
        if pdata['requires_key']:
            env_key = pdata.get('key_env', '')
            entry['server_key_configured'] = bool(os.getenv(env_key, ''))
        else:
            entry['server_key_configured'] = True
        llm_providers.append(entry)

    embed_providers = []
    for eid, edata in EMBEDDING_PROVIDERS.items():
        embed_providers.append({
            'id': eid,
            'name': edata['name'],
            'cost_per_1k_tokens': edata['cost_per_1k_tokens'],
            'models': edata['models'],
            'default_model': edata['default_model'],
        })

    return jsonify({
        'llm_providers': llm_providers,
        'embedding_providers': embed_providers,
    })


@novelty_bp.route('/api/upload', methods=['POST'])
def upload_and_analyze():
    """Upload a PDF and analyze it for novelty."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PDF files are allowed'}), 400

        # Save uploaded file
        filename = secure_filename(file.filename)
        input_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(input_path)

        # Get configuration from request
        chunk_size = int(request.form.get('chunk_size', 150))
        overlap = int(request.form.get('overlap', 20))
        llm_provider = request.form.get('llm_provider', 'ollama')
        llm_model = request.form.get('llm_model', '') or None
        k_neighbors = int(request.form.get('k_neighbors', 5))
        embedding_provider = request.form.get('embedding_provider', 'local')
        embedding_model = request.form.get('embedding_model', '') or None

        # Extract user API keys from headers
        api_keys = extract_api_keys(request)

        # Initialize processors
        pdf_processor = PDFProcessor(chunk_size=chunk_size, overlap=overlap)
        novelty_detector = NoveltyDetector(
            llm_provider=llm_provider,
            llm_model=llm_model,
            embedding_provider=embedding_provider,
            embedding_model_name=embedding_model,
            api_keys=api_keys,
        )

        # Extract and chunk text
        print(f"Processing {filename}...")
        text = pdf_processor.extract_text(input_path)
        chunks = pdf_processor.chunk_text(text)
        print(f"Extracted {len(chunks)} chunks from PDF")

        # Analyze novelty
        novelty_scores = novelty_detector.analyze_document(
            chunks, pdf_processor, k=k_neighbors
        )

        # Get summary statistics
        stats = novelty_detector.get_summary_statistics(novelty_scores)

        # Create annotated PDF
        annotated_filename = f"annotated_{filename}"
        output_path = os.path.join(UPLOAD_FOLDER, annotated_filename)
        pdf_processor.annotate_pdf(input_path, output_path, novelty_scores)

        # Save detailed results to JSON
        results_filename = f"{Path(filename).stem}_results.json"
        results_path = os.path.join(UPLOAD_FOLDER, results_filename)

        results_data = {
            'original_filename': filename,
            'annotated_filename': annotated_filename,
            'chunks_analyzed': len(chunks),
            'word_count': sum(c['word_count'] for c in chunks),
            'statistics': stats,
            'novelty_scores': novelty_scores,
            'parameters': {
                'chunk_size': chunk_size,
                'overlap': overlap,
                'llm_provider': llm_provider,
                'llm_model': novelty_detector.llm_model,
                'k_neighbors': k_neighbors,
                'embedding_provider': embedding_provider,
            }
        }

        with open(results_path, 'w') as f:
            json.dump(results_data, f, indent=2)

        return jsonify({
            'success': True,
            'original_filename': filename,
            'annotated_filename': annotated_filename,
            'results_filename': results_filename,
            'chunks_analyzed': len(chunks),
            'word_count': results_data['word_count'],
            'statistics': stats,
            'novelty_scores': novelty_scores[:10],
            'download_url': f'/novelty/api/download/{annotated_filename}',
            'results_url': f'/novelty/api/download/{results_filename}'
        })

    except Exception as e:
        print(f"Error processing file: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@novelty_bp.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """Download a file from the uploads directory."""
    try:
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@novelty_bp.route('/api/analyze', methods=['POST'])
def analyze_text():
    """Analyze raw text for novelty (for testing)."""
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400

        text = data['text']
        chunk_size = data.get('chunk_size', 150)
        overlap = data.get('overlap', 20)
        llm_provider = data.get('llm_provider', 'ollama')
        llm_model = data.get('llm_model')

        api_keys = extract_api_keys(request)

        pdf_processor = PDFProcessor(chunk_size=chunk_size, overlap=overlap)
        novelty_detector = NoveltyDetector(
            llm_provider=llm_provider,
            llm_model=llm_model,
            api_keys=api_keys,
        )

        chunks = pdf_processor.chunk_text(text)
        novelty_scores = novelty_detector.analyze_document(chunks, pdf_processor)
        stats = novelty_detector.get_summary_statistics(novelty_scores)

        return jsonify({
            'success': True,
            'chunks_analyzed': len(chunks),
            'statistics': stats,
            'novelty_scores': novelty_scores
        })

    except Exception as e:
        print(f"Error analyzing text: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@novelty_bp.route('/api/estimate-cost', methods=['POST'])
def estimate_cost_endpoint():
    """Estimate cost for analyzing a document."""
    try:
        data = request.get_json() or {}

        word_count = data.get('word_count', 0)
        file_size = data.get('file_size', 0)

        # If no word count, estimate from file size
        if not word_count and file_size:
            word_count = file_size // 6

        chunk_size = data.get('chunk_size', 150)
        overlap = data.get('overlap', 20)
        provider = data.get('llm_provider')

        if provider:
            result = estimate_cost(word_count, chunk_size, overlap, llm_provider=provider,
                                   llm_model=data.get('llm_model'))
            return jsonify(result)
        else:
            results = estimate_cost_all_providers(word_count, chunk_size, overlap)
            return jsonify({'estimates': results})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@novelty_bp.route('/api/ollama/status', methods=['GET'])
def ollama_status():
    """Check Ollama connectivity."""
    client = OllamaClient()
    return jsonify(client.health())


@novelty_bp.route('/api/ollama/models', methods=['GET'])
def ollama_models():
    """List pulled Ollama models."""
    client = OllamaClient()
    models = client.list_models()
    return jsonify({'models': models})


# ── App Factory ──────────────────────────────────────────────────────

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    CORS(app)
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    app.register_blueprint(novelty_bp)
    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'

    print(f"Starting PDF Novelty Detection Server on port {port}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Max upload size: {MAX_CONTENT_LENGTH / (1024*1024):.1f}MB")
    print(f"Routes available at /novelty/")

    app.run(host='0.0.0.0', port=port, debug=debug)
