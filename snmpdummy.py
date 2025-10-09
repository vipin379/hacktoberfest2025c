from pysnmp.entity import engine, config
from pysnmp.carrier.asyncore.dgram import udp
from pysnmp.entity.rfc3413 import cmdrsp, context
from pysnmp.proto.api import v2c

# Dummy data

#hacktoberfest2025
data = {
    '1.3.6.1.4.1.53864.10.1.0': 23050,
    '1.3.6.1.4.1.53864.10.2.0': 1234,
    '1.3.6.1.4.1.53864.20.1.0': 263,
    '1.3.6.1.4.1.53864.30.1.0': 0
}

snmpEngine = engine.SnmpEngine()
config.addV1System(snmpEngine, 'psn', 'public')  # v2c public community
config.addTransport(
    snmpEngine,
    udp.domainName,
    udp.UdpTransport().openServerMode(('0.0.0.0', 16100))  # pakai port 16100 biar gak butuh admin
)

def get_cb(snmpEngine, stateReference, contextEngineId, contextName,
           varBinds, cbCtx):
    resultBinds = []
    for oid, val in varBinds:
        oid_str = '.'.join([str(x) for x in oid])
        if oid_str in data:
            resultBinds.append((oid, v2c.Integer(data[oid_str])))
        else:
            resultBinds.append((oid, v2c.NoSuchInstance()))
    snmpEngine.observer.storeExecutionContext(stateReference, 'responseVarBinds', resultBinds)

snmpContext = context.SnmpContext(snmpEngine)
cmdrsp.GetCommandResponder(snmpEngine, snmpContext)
cmdrsp.GetNextCommandResponder(snmpEngine, snmpContext)

print("[OK] SNMP dummy agent running @ 127.0.0.1:16100 (v2c, community=public)")
snmpEngine.transportDispatcher.jobStarted(1)

try:
    snmpEngine.transportDispatcher.runDispatcher()
except KeyboardInterrupt:
    snmpEngine.transportDispatcher.closeDispatcher()
    print("Agent stopped.")
