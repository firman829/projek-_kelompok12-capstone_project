import json
import re
from pathlib import Path

import chromadb
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader

BASE = Path(__file__).parent
import os

# Kalau CHROMA_HOST diisi -> sambung ke server ChromaDB. Kalau kosong -> mode lokal (folder chroma_data).
CHROMA_HOST = os.getenv("CHROMA_HOST")
if CHROMA_HOST:
    client = chromadb.HttpClient(host=CHROMA_HOST, port=int(os.getenv("CHROMA_PORT", "8001")))
else:
    client = chromadb.PersistentClient(path=str(BASE / "chroma_data"))
app = FastAPI(title="PDF ke ChromaDB")


def safe_name(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name.strip())[:60]
    if len(name) < 3:
        raise HTTPException(400, "Nama koleksi minimal 3 karakter (huruf/angka/_/-).")
    return name


def clean(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Potong teks per ~size karakter, usahakan berhenti di akhir paragraf/kalimat."""
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            cut = max(text.rfind("\n\n", start, end), text.rfind(". ", start, end))
            if cut > start + size * 0.5:
                end = cut + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


@app.post("/api/upload")
async def upload(
    files: list[UploadFile] = File(...),
    collection: str = Form("dokumen"),
    chunk_size: int = Form(1000),
    overlap: int = Form(150),
):
    if overlap >= chunk_size:
        raise HTTPException(400, "Overlap harus lebih kecil dari ukuran chunk.")
    col = client.get_or_create_collection(safe_name(collection))
    report = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            report.append({"file": f.filename, "error": "Bukan file PDF."})
            continue
        try:
            reader = PdfReader(f.file)
            ids, docs, metas = [], [], []
            for pno, page in enumerate(reader.pages, start=1):
                text = clean(page.extract_text() or "")
                for i, piece in enumerate(chunk_text(text, chunk_size, overlap)):
                    ids.append(f"{f.filename}::p{pno}::c{i}")
                    docs.append(piece)
                    metas.append({"source": f.filename, "page": pno, "chunk": i})
            if not docs:
                report.append({"file": f.filename, "error": "Tidak ada teks (mungkin PDF hasil scan, perlu OCR)."})
                continue
            for s in range(0, len(docs), 100):  # upsert: upload ulang tidak menggandakan data
                col.upsert(ids=ids[s:s+100], documents=docs[s:s+100], metadatas=metas[s:s+100])
            report.append({"file": f.filename, "pages": len(reader.pages), "chunks": len(docs)})
        except Exception as e:
            report.append({"file": f.filename, "error": f"Gagal membaca: {e}"})
    return {"collection": col.name, "total": col.count(), "report": report}


@app.get("/api/collections")
def collections():
    return [{"name": c.name, "count": c.count()} for c in client.list_collections()]


@app.get("/api/search")
def search(collection: str, q: str, n: int = 5):
    try:
        col = client.get_collection(collection)
    except Exception:
        raise HTTPException(404, "Koleksi tidak ditemukan.")
    r = col.query(query_texts=[q], n_results=n)
    return [
        {"text": d, "meta": m, "distance": round(dist, 4)}
        for d, m, dist in zip(r["documents"][0], r["metadatas"][0], r["distances"][0])
    ]


@app.get("/api/export/{collection}")
def export(collection: str):
    try:
        col = client.get_collection(collection)
    except Exception:
        raise HTTPException(404, "Koleksi tidak ditemukan.")
    lines, offset = [], 0
    while True:
        r = col.get(limit=500, offset=offset, include=["documents", "metadatas"])
        if not r["ids"]:
            break
        for i, d, m in zip(r["ids"], r["documents"], r["metadatas"]):
            lines.append(json.dumps({"id": i, "text": d, **m}, ensure_ascii=False))
        offset += 500
    return Response(
        "\n".join(lines),
        media_type="application/jsonl",
        headers={"Content-Disposition": f'attachment; filename="{collection}.jsonl"'},
    )


@app.delete("/api/collections/{collection}")
def delete(collection: str):
    client.delete_collection(collection)
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(BASE / "static" / "index.html")


app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")