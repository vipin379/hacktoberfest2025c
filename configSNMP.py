# app/config.py
import os

# App identity
APP_ID_ENV   = os.getenv("APP_ID", "default-app-id")

# Behavior
USE_DUMMY    = os.getenv("DUMMY_MODE", "1") == "1"  # default ON untuk dev
SNMP_RETRIES = int(os.getenv("SNMP_RETRIES", "2"))
SNMP_TIMEOUT = float(os.getenv("SNMP_TIMEOUT", "1"))
MIB_DIR      = os.getenv("MIB_DIR", "./mibs")

# Bulk walk page size (dinamis via env)
DEFAULT_BULK_PAGE = int(os.getenv("DEFAULT_BULK_PAGE_SIZE", "50"))

# Firestore key path (digunakan oleh firebase_backend.py eksternal)
FIREBASE_KEY_PATH = os.getenv("FIREBASE_KEY_PATH", "./serviceAccountKey.json")

# Security (jangan tampilkan community di prod)
EXPOSE_COMMUNITY = os.getenv("EXPOSE_COMMUNITY_IN_META", "0") == "1"

# CORS
CORS_ALLOWED = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",")
    if o.strip()
]

# Version info (untuk /version)
APP_VERSION = os.getenv("APP_VERSION", "dev")
BUILD_TIME  = os.getenv("BUILD_TIME", "")

# Logging awal
print(f"[config] APP_ID={APP_ID_ENV} | DUMMY_MODE={USE_DUMMY} | TIMEOUT={SNMP_TIMEOUT}s | RETRIES={SNMP_RETRIES}")
print(f"[config] BULK_PAGE={DEFAULT_BULK_PAGE} | MIB_DIR={MIB_DIR}")
print(f"[config] CORS={CORS_ALLOWED} | EXPOSE_COMMUNITY={EXPOSE_COMMUNITY}")
