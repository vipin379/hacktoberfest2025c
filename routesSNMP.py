# app/routes_snmp.py
import time
import random
from flask import Blueprint, request, jsonify

from pysnmp.hlapi import (
    SnmpEngine, UdpTransportTarget, ContextData,
    ObjectType, ObjectIdentity, getCmd, nextCmd, setCmd, bulkCmd, OctetString
)

from .config import (
    APP_ID_ENV, USE_DUMMY, DEFAULT_BULK_PAGE, SNMP_RETRIES, SNMP_TIMEOUT,
    APP_VERSION, BUILD_TIME
)
from .helpers import (
    _get_request_id, _error, _validate_v3, _security, _parse_object_identity,
    _normalize_rows, _make_meta, _save_to_firestore
)

snmp_bp = Blueprint("snmp_bp", __name__)

# ---- Health & Version ----
@snmp_bp.get("/health")
def health():
    return {"ok": True, "dummy": USE_DUMMY, "appId": APP_ID_ENV}, 200

@snmp_bp.get("/version")
def version():
    return {"version": APP_VERSION, "buildTime": BUILD_TIME}, 200

# ---- RTT ping-agent ----
@snmp_bp.get("/ping-agent")
def ping_agent():
    request_id = _get_request_id()
    ip = request.args.get("ip")
    community = request.args.get("community", "public")
    version = request.args.get("version", "v2c")
    oid = request.args.get("oid", "1.3.6.1.2.1.1.3.0")  # sysUpTime

    if not ip:
        return _error(400, "Missing 'ip' parameter", request_id)

    try:
        sec = _security(version, community, {})
        target = UdpTransportTarget((ip, 161), retries=SNMP_RETRIES, timeout=SNMP_TIMEOUT)
        target_obj = _parse_object_identity(oid)

        start = time.time()
        iterator = getCmd(SnmpEngine(), sec, target, ContextData(), target_obj)
        for errorIndication, errorStatus, errorIndex, varBinds in iterator:
            if errorIndication:
                return _error(500, f"SNMP errorIndication: {errorIndication}", request_id)
            if errorStatus:
                return _error(500, f"SNMP errorStatus: {errorStatus.prettyPrint()}", request_id)
            break
        latency = round((time.time() - start) * 1000, 2)
        return {"ip": ip, "oid": oid, "latency_ms": latency, "status": "ok", "requestId": request_id}, 200
    except Exception as e:
        return _error(500, str(e), request_id)

# ---- Main SNMP endpoint ----
@snmp_bp.post("/snmp")
def handle_snmp_request():
    request_id = _get_request_id()
    t0 = time.time()

    try:
        if not request.is_json:
            return _error(415, "Content-Type must be application/json", request_id)

        data = request.get_json() or {}
        operation = (data.get("operation") or "").lower()
        ip        = data.get("ip")
        oid       = data.get("oid", "")
        setValue  = data.get("setValue")
        port      = int(data.get("port", 161))
        version   = (data.get("version") or "v2c").lower()
        community = data.get("community", "public")
        v3_cfg    = data.get("v3") or {}
        page_size = int(data.get("pageSize", DEFAULT_BULK_PAGE))

        if page_size < 1:
            page_size = 1
        elif page_size > 200:
            page_size = 200

        if not oid or not str(oid).strip():
            return _error(400, "Missing or empty 'oid'", request_id)
        if operation not in ("get", "getnext", "walk", "set"):
            return _error(400, "Invalid operation", request_id)
        if version == "v3":
            ok, msg = _validate_v3(v3_cfg)
            if not ok:
                return _error(400, msg, request_id)
        elif not all([operation, ip, oid, community]):
            return _error(400, "Missing required parameters", request_id)

    except Exception as e:
        return _error(400, f"Bad request: {e}", request_id)

    meta = _make_meta(ip, operation, oid, version, community, port)
    print(f"[request {request_id}] {operation.upper()} ip={ip} oid={oid} ver={version} pageSize={page_size} dummy={USE_DUMMY}")

    # ---------- DUMMY MODE ----------
    if USE_DUMMY:
        results = []
        rf = lambda a, b: f"{random.uniform(a, b):.2f}"

        if oid.startswith("1.3.6.1.4.1.9999.1.2") or ("9999.1.2" in oid):
            if operation == "walk":
                results = [
                    {"oid": "1.3.6.1.4.1.9999.1.2.0", "name": "temperature", "value": rf(20.0, 30.0),  "type": "Float"},
                    {"oid": "1.3.6.1.4.1.9999.1.2.1", "name": "humidity",    "value": rf(40.0, 70.0),  "type": "Float"},
                    {"oid": "1.3.6.1.4.1.9999.1.2.2", "name": "voltage",     "value": rf(700.0, 800.0),"type": "Float"},
                    {"oid": "1.3.6.1.4.1.9999.1.2.3", "name": "current",     "value": rf(0.5, 2.0),    "type": "Float"},
                ]
            elif operation == "get":
                results = [{"oid": oid, "name": "temperature", "value": rf(20.0, 30.0), "type": "Float"}]
            elif operation == "getnext":
                results = [{"oid": oid, "name": "humidity", "value": rf(40.0, 70.0), "type": "Float"}]
            elif operation == "set":
                if not setValue:
                    return _error(400, "SET requires 'setValue'", request_id)
                results = [{"oid": oid, "name": "dummySet", "value": f"Value set to: {setValue}", "type": "OctetString"}]
        else:
            return _error(404, "Dummy Agent does not recognize this OID", request_id)

        for r in results:
            r["dummy"] = True

        rows = _normalize_rows(results, ip, port)
        latency_ms = int((time.time() - t0) * 1000)
        meta["latency_ms"] = latency_ms
        meta["requestId"]  = request_id
        _save_to_firestore(meta, results, rows)
        return jsonify({"meta": meta, "results": results, "rows": rows}), 200

    # ---------- REAL SNMP ----------
    try:
        sec = _security(version, community, v3_cfg)
        target = UdpTransportTarget((ip, port), retries=SNMP_RETRIES, timeout=SNMP_TIMEOUT)
        target_obj = _parse_object_identity(oid)
        results = []

        if operation == "get":
            iterator = getCmd(SnmpEngine(), sec, target, ContextData(), target_obj)
        elif operation == "getnext":
            iterator = nextCmd(SnmpEngine(), sec, target, ContextData(), target_obj, lexicographicMode=False)
        elif operation == "set":
            if not setValue:
                return _error(400, "SET requires 'setValue'", request_id)
            val_to_set = OctetString(str(setValue).encode("utf-8"))
            iterator = setCmd(SnmpEngine(), sec, target, ContextData(), ObjectType(ObjectIdentity(oid), val_to_set))
        elif operation == "walk":
            iterator = bulkCmd(SnmpEngine(), sec, target, ContextData(), 0, page_size, target_obj, lexicographicMode=False)

        for errorIndication, errorStatus, errorIndex, varBinds in iterator:
            if errorIndication:
                return _error(500, f"SNMP errorIndication: {errorIndication}", request_id)
            if errorStatus:
                return _error(500, f"SNMP errorStatus: {errorStatus.prettyPrint()}", request_id)
            for oid_result, val_result in varBinds:
                try:
                    # Resolve MIB name bila tersedia
                    name = ObjectIdentity(str(oid_result)).resolveWithMib(None).getMibSymbol()[1]
                except Exception:
                    name = str(oid_result)
                results.append({
                    "oid": str(oid_result),
                    "name": name,
                    "value": str(val_result),
                    "type": val_result.__class__.__name__,
                })
            if operation in ("get", "set", "getnext"):
                break

        rows = _normalize_rows(results, ip, port)
        latency_ms = int((time.time() - t0) * 1000)
        meta["latency_ms"] = latency_ms
        meta["requestId"]  = request_id
        ok, msg = _save_to_firestore(meta, results, rows)
        print(f"[request {request_id}] save_to_firestore -> {ok} | {msg}")
        return jsonify({"meta": meta, "results": results, "rows": rows}), 200

    except Exception as e:
        return _error(500, str(e), request_id)
