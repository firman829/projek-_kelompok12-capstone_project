# PDF → Dataset → ChromaDB

1. `python -m venv venv && source venv/bin/activate`  (Windows: `venv\Scripts\activate`)
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload`
4. Buka http://127.0.0.1:8000

Data vektor tersimpan permanen di folder `chroma_data/`.
Embedding memakai model bawaan ChromaDB (all-MiniLM-L6-v2); diunduh otomatis saat pertama dipakai.
PDF hasil scan (gambar) tidak punya teks, jadi perlu OCR dulu.
