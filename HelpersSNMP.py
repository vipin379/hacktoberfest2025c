# app/helpers.py
import uuid
import time
from datetime import datetime, timezone
from typing import Tuple, Dict
from flask import request, jsonify

# pysnmp
from pysnmp.hlapi import (
    CommunityData, UsmUserData,
    usmNoAuthProtocol, usmHMACSHAAuthProtocol, usmHMACMD5AuthProtocol,
    usmNoPrivProtocol, usmAesCfb128Protocol,
    ObjectType, ObjectIdentity
)
from pysnmp.smi import builder, view

from .config import (
    APP_ID_ENV, USE_DUMMY, EXPOSE_COMMUNITY, MIB_DIR
)

# Optional Firestore (dibiarkan eksternal)
try:
    from firebase_backend import save_sensor_data_to_cloud
    print("[import] firebase_backend loaded ✅")
except Exception as e:
    save_sensor_data_to_cloud = None
    print("[import] firebase_backend not available -> Firestore disabled. Reason:", e)

# ---------- MIB init ----------
mibBuilder = builder.MibBuilder()
import os
if os.path.isdir(MIB_DIR):
    mibBuilder.addMibSources(builder.DirMibSource(MIB_DIR))
mibView = view.MibViewController(mibBuilder)

# ---------- OID Template ----------
PROTOCOL_TEMPLATE: Dict[str, Dict] = {
    "1.3.6.1.4.1.9999.1.2.0": {"name": "temperature", "unit": "°C",  "category": "environment", "decimals": 2},
    "1.3.6.1.4.1.9999.1.2.1": {"name": "humidity",    "unit": "%RH", "category": "environment", "decimals": 2},
    "1.3.6.1.4.1.9999.1.2.2": {"name": "voltage",     "unit": "V",   "category": "power",       "decimals": 2},
    "1.3.6.1.4.1.9999.1.2.3": {"name": "current",     "unit": "A",   "category": "power",       "decimals": 2},
}

# ---------- Helpers ----------
def _get_request_id() -> str:
    rid = request.headers.get("X-Request-Id") if request else None
    return rid or str(uuid.uuid4())

def _error(code: int, message: str, request_id: str, details: dict | None = None):
    payload = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    payload["requestId"] = request_id
    return jsonify(payload), code

def _validate_v3(v3: dict) -> Tuple[bool, str]:
    user = (v3 or {}).get("user", "")
    authProto = (v3 or {}).get("authProto", "NONE").upper()
    privProto = (v3 or {}).get("privProto", "NONE").upper()
    authKey = (v3 or {}).get("authKey", "")
    privKey = (v3 or {}).get("privKey", "")
    if not user:
        return False, "SNMPv3 requires a username."
    if authProto != "NONE" and not authKey:
        return False, "Auth protocol set but no authKey."
    if privProto != "NONE" and not privKey:
        return False, "Priv protocol set but no privKey."
    return True, ""

def _security(version_str: str, community: str, v3: dict):
    vs = (version_str or "v2c").lower()
    if vs in ("v1", "v2c"):
        mp = 0 if vs == "v1" else 1
        return CommunityData(community, mpModel=mp)

    user = (v3 or {}).get("user", "")
    authProto = (v3 or {}).get("authProto", "NONE").upper()
    privProto = (v3 or {}).get("privProto", "NONE").upper()
    authKey = (v3 or {}).get("authKey", "")
    privKey = (v3 or {}).get("privKey", "")

    auth_p = {
        "NONE": usmNoAuthProtocol,
        "SHA":  usmHMACSHAAuthProtocol,
        "MD5":  usmHMACMD5AuthProtocol,
    }.get(authProto, usmNoAuthProtocol)

    priv_p = {
        "NONE":   usmNoPrivProtocol,
        "AES128": usmAesCfb128Protocol,
    }.get(privProto, usmNoPrivProtocol)

    if auth_p is usmNoAuthProtocol and priv_p is usmNoPrivProtocol:
        return UsmUserData(user)
    elif priv_p is usmNoPrivProtocol:
        return UsmUserData(user, authKey, authProtocol=auth_p)
    else:
        return UsmUserData(user, authKey, privKey, authProtocol=auth_p, privProtocol=priv_p)

def _parse_object_identity(oid_str: str) -> ObjectType:
    if any(c.isalpha() for c in oid_str):
        if "::" in oid_str:
            left, right = oid_str.split("::", 1)
            parts = right.split(".")
            symbol = parts[0]
            indexes = [int(p) for p in parts[1:] if p.isdigit()]
            return ObjectType(ObjectIdentity(left, symbol, *indexes).resolveWithMib(mibView))
    return ObjectType(ObjectIdentity(oid_str))

def _to_number(v):
    try:
        if isinstance(v, (int, float)):
            return float(v)
        return float(str(v).strip())
    except Exception:
        return None

def _normalize_rows(results, ip, port):
    ts = datetime.now(timezone.utc).isoformat()
    out = []
    for r in results or []:
        oid = r.get("oid")
        tpl = PROTOCOL_TEMPLATE.get(oid, {})
        name = r.get("name") or tpl.get("name") or oid
        unit = tpl.get("unit", "")
        category = tpl.get("category", "misc")
        t = r.get("type", "")

        num = _to_number(r.get("value"))
        value_out = r.get("value") if num is None else round(num, int(tpl.get("decimals", 2)))

        out.append({
            "name": name, "oid": oid, "value": value_out, "unit": unit,
            "type": t, "category": category, "ts": ts, "ip": ip, "port": port,
            "source": "backend",
        })
    return out

def _make_meta(ip, operation, oid, version, community, port):
    meta = {
        "ip": ip, "operation": operation, "oid": oid, "version": version,
        "port": port, "appId": APP_ID_ENV, "dummy": USE_DUMMY,
    }
    if EXPOSE_COMMUNITY and version != "v3":
        meta["community"] = community
    else:
        meta["community"] = None
    return meta

def _save_to_firestore(meta: Dict, results, rows):
    if not save_sensor_data_to_cloud:
        print("[firebase] skipped (module not available)")
        return False, "disabled"
    payload = {**meta, "results": results, "rows": rows}
    ok, msg = save_sensor_data_to_cloud(payload, app_id=APP_ID_ENV)
    print("[firebase]", ok, "-", msg)
    return ok, msg
