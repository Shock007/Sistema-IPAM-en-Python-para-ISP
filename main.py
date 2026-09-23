# main.py
from fastapi import FastAPI

app = FastAPI(title="IPAM API")

@app.get("/")
def read_root():
    return {"message": "API IPAM activa"}