# PDF Novelty Detector — Architecture

## System Architecture

```mermaid
graph TB
    Internet[Internet] --> NPM[Nginx Proxy Manager<br/>:80/:443]
    NPM -->|simonmccallum.org.nz/novelty| ND[novelty-detector<br/>Flask :5000]
    NPM -->|default| SAM[six-animal-model<br/>:3000]
    NPM -->|ludogogy.co.nz| LUD[ludogogy<br/>:80]
    NPM -->|cbm subdomain| CBM[cbm-dashboard<br/>:80]

    ND --> Ollama[ollama<br/>:11434]
    ND --> Cloud[Cloud APIs<br/>Anthropic / OpenAI / Google]
    ND --> ST[Sentence Transformers<br/>Local Embeddings]
    ND --> FAISS[FAISS Index<br/>In-Memory]
    ND --> Vol[(novelty-uploads<br/>Docker Volume)]

    subgraph proxy-net [Docker Bridge Network: proxy-net]
        NPM
        ND
        SAM
        LUD
        CBM
        Ollama
    end

    style Internet fill:#e0f2fe
    style NPM fill:#fef3c7
    style ND fill:#dcfce7
    style Ollama fill:#f3e8ff
```

## Processing Pipeline

```mermaid
graph LR
    A[PDF Upload<br/>via browser] --> B[Text Extraction<br/>PyMuPDF/fitz]
    B --> C[Chunking<br/>~150 words<br/>20 word overlap]
    C --> D[LLM Compression<br/>Generate semantic prompts<br/>via Ollama/Cloud]
    D --> E[Embedding<br/>Sentence-BERT<br/>all-MiniLM-L6-v2]
    E --> F[L2 Normalize<br/>→ Cosine Similarity]
    F --> G[FAISS IndexFlatIP<br/>k-NN Search]
    G --> H[Novelty Scoring<br/>1 - avg_similarity]
    H --> I[Annotated PDF<br/>+ JSON Results]

    style A fill:#e0f2fe
    style D fill:#fef3c7
    style E fill:#f3e8ff
    style G fill:#ede9fe
    style I fill:#dcfce7
```

## Deployment Topology

```mermaid
graph TB
    DNS[DNS: simonmccallum.org.nz<br/>→ 103.224.130.189] --> Router[Home Router<br/>Port Forward 80/443]
    Router --> Server[Ubuntu Server<br/>192.168.1.64]
    Server --> Docker[Docker Engine]
    Docker --> NPM[NPM Container<br/>:80/:443/:81]

    NPM -->|"location /novelty"| ND[novelty-detector<br/>:5000]
    ND -->|"http://ollama:11434"| OL[ollama<br/>Local LLM]

    subgraph Volumes
        NV[novelty-uploads]
        OV[ollama-data]
    end

    ND --> NV
    OL --> OV
```

## User API Key Flow

```mermaid
sequenceDiagram
    participant Browser
    participant localStorage
    participant Flask as Flask Server
    participant Provider as Cloud LLM Provider

    Browser->>localStorage: Store API key (user action)
    Browser->>Flask: POST /novelty/api/upload<br/>+ X-Api-Key-* header
    Flask->>Flask: extract_api_keys(request)

    alt User key in header
        Flask->>Provider: Use user's API key
    else No user key
        Flask->>Flask: Check os.getenv()
        alt Server key in .env
            Flask->>Provider: Use server key
        else No key available
            Flask-->>Browser: HTTP 400 - No API key
        end
    end

    Provider-->>Flask: LLM response
    Flask-->>Browser: JSON novelty results
```

## Cost Decision Tree

```mermaid
graph TD
    Start[File Selected] --> Est[Estimate word count<br/>bytes / 6]
    Est --> Chunks[Calculate chunks<br/>words - overlap / chunk_size - overlap]
    Chunks --> Compare[Compare all providers]

    Compare --> Free[Ollama: $0.00<br/>No key needed]
    Compare --> Budget[Gemini Flash: ~$0.003<br/>Key required]
    Compare --> Mid[GPT-4o-mini: ~$0.008<br/>Key required]
    Compare --> Premium[Claude Sonnet: ~$0.12<br/>Key required]

    Free --> HasOllama{Ollama<br/>available?}
    HasOllama -->|Yes| UseOllama[Use Ollama]
    HasOllama -->|No| Budget

    Budget --> HasKey{Has API key?}
    HasKey -->|Yes| UseCloud[Use cloud provider]
    HasKey -->|No| NeedKey[Prompt for key]

    style Free fill:#dcfce7
    style Budget fill:#fef9c3
    style Mid fill:#fed7aa
    style Premium fill:#fecaca
```

## File Structure

```
novelty_detector/
├── server.py                 # Flask app with Blueprint at /novelty
├── novelty_detector.py       # Core analysis: LLM prompts + FAISS
├── pdf_processor.py          # PDF extraction, chunking, annotation
├── ollama_client.py          # HTTP client for Ollama API
├── cost_config.py            # Provider pricing and cost estimation
├── test_novelty_detector.py  # Test suite
├── Dockerfile                # Python 3.11 + gunicorn
├── requirements.txt          # Python dependencies
├── .env.example              # Configuration template
├── templates/
│   ├── base.html             # Tailwind layout with sidebar
│   ├── index.html            # Upload + config + results UI
│   ├── admin.html            # Provider status + API key management
│   └── about.html            # Algorithm explanation + Mermaid diagrams
├── static/
│   ├── js/app.js             # Frontend logic
│   └── css/custom.css        # Custom styles
└── docs/
    ├── architecture.md       # This file
    └── novelty_detection_theory.tex  # LaTeX academic paper
```
