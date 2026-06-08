import os
import shutil
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from sentence_transformers import CrossEncoder
from ai_engine.chat import call_ollama

# Initialize Re-ranker
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

# Initialize Embeddings
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Initialize ChromaDB Vector Store
vector_store = Chroma(
    collection_name="divu_rag_collection",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

# Temp directory for uploads
UPLOAD_DIR = "./temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_document(file: UploadFile) -> str:
    # Save file temporarily
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Load document
        if file.filename.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        elif file.filename.endswith(".txt"):
            loader = TextLoader(file_path, encoding='utf-8')
        else:
            return "Unsupported file type. Please upload a PDF or TXT file."
            
        documents = loader.load()
        
        # Split text into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(documents)
        
        # Add to Vector Store
        vector_store.add_documents(chunks)
        
        return f"Successfully processed {file.filename}. Added {len(chunks)} chunks to memory."
        
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)

def query_rag(query: str) -> str:
    # Retrieve relevant chunks (broad search)
    retriever = vector_store.as_retriever(search_kwargs={"k": 10})
    docs = retriever.invoke(query)
    
    if not docs:
        return "I couldn't find any relevant context in my uploaded documents."
        
    # Re-rank using CrossEncoder
    pairs = [[query, doc.page_content] for doc in docs]
    scores = cross_encoder.predict(pairs)
    
    # Sort docs by score descending
    scored_docs = list(zip(scores, docs))
    scored_docs.sort(key=lambda x: x[0], reverse=True)
    
    # Take top 3 most relevant docs
    top_docs = [doc for score, doc in scored_docs[:3]]
    
    context = "\n\n".join([doc.page_content for doc in top_docs])
    
    messages = [
        {
            "role": "system",
            "content": f"You are Divu, a helpful AI assistant. Use the following context to answer the user's question. If the context doesn't contain the answer, just say that you don't know based on the provided documents.\n\nContext:\n{context}"
        },
        {
            "role": "user",
            "content": query
        }
    ]
    
    # Generate answer using Ollama
    response = call_ollama(messages)
    return response
