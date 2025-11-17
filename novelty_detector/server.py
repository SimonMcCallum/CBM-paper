"""
Flask server for PDF novelty detection.
Provides REST API endpoints for uploading PDFs, analyzing novelty, and downloading annotated results.
"""

import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import traceback

from pdf_processor import PDFProcessor
from novelty_detector import NoveltyDetector


# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
ALLOWED_EXTENSIONS = {'pdf'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'PDF Novelty Detection Server',
        'version': '1.0.0'
    })


@app.route('/upload', methods=['POST'])
def upload_and_analyze():
    """
    Upload a PDF and analyze it for novelty.

    Returns:
        JSON with novelty scores and download URL for annotated PDF
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in request'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PDF files are allowed'}), 400

        # Save uploaded file
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(input_path)

        # Get configuration from request or use defaults
        chunk_size = int(request.form.get('chunk_size', 150))
        overlap = int(request.form.get('overlap', 20))
        llm_provider = request.form.get('llm_provider', 'anthropic')
        k_neighbors = int(request.form.get('k_neighbors', 5))

        # Initialize processors
        pdf_processor = PDFProcessor(chunk_size=chunk_size, overlap=overlap)
        novelty_detector = NoveltyDetector(llm_provider=llm_provider)

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
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], annotated_filename)
        pdf_processor.annotate_pdf(input_path, output_path, novelty_scores)

        # Save detailed results to JSON
        results_filename = f"{Path(filename).stem}_results.json"
        results_path = os.path.join(app.config['UPLOAD_FOLDER'], results_filename)

        results_data = {
            'original_filename': filename,
            'annotated_filename': annotated_filename,
            'chunks_analyzed': len(chunks),
            'statistics': stats,
            'novelty_scores': novelty_scores,
            'parameters': {
                'chunk_size': chunk_size,
                'overlap': overlap,
                'llm_provider': llm_provider,
                'k_neighbors': k_neighbors
            }
        }

        with open(results_path, 'w') as f:
            json.dump(results_data, f, indent=2)

        # Return response
        return jsonify({
            'success': True,
            'original_filename': filename,
            'annotated_filename': annotated_filename,
            'results_filename': results_filename,
            'chunks_analyzed': len(chunks),
            'statistics': stats,
            'novelty_scores': novelty_scores[:10],  # Return first 10 for preview
            'download_url': f'/download/{annotated_filename}',
            'results_url': f'/download/{results_filename}'
        })

    except Exception as e:
        print(f"Error processing file: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Download a file from the uploads directory.

    Args:
        filename: Name of file to download

    Returns:
        File download
    """
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(file_path, as_attachment=True)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/analyze', methods=['POST'])
def analyze_text():
    """
    Analyze raw text for novelty (for testing).

    Request body:
        {
            "text": "Text to analyze",
            "chunk_size": 150,  # optional
            "llm_provider": "anthropic"  # optional
        }

    Returns:
        JSON with novelty analysis
    """
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400

        text = data['text']
        chunk_size = data.get('chunk_size', 150)
        overlap = data.get('overlap', 20)
        llm_provider = data.get('llm_provider', 'anthropic')

        # Initialize processors
        pdf_processor = PDFProcessor(chunk_size=chunk_size, overlap=overlap)
        novelty_detector = NoveltyDetector(llm_provider=llm_provider)

        # Chunk text
        chunks = pdf_processor.chunk_text(text)

        # Analyze novelty
        novelty_scores = novelty_detector.analyze_document(chunks, pdf_processor)

        # Get statistics
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


@app.route('/config', methods=['GET'])
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
        'max_upload_size': MAX_CONTENT_LENGTH
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'

    print(f"Starting PDF Novelty Detection Server on port {port}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Max upload size: {MAX_CONTENT_LENGTH / (1024*1024):.1f}MB")

    app.run(host='0.0.0.0', port=port, debug=debug)
