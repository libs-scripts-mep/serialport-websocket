import Log from "../script-loader/utils-script.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { RastUtil } from "../rast-pvi/rast-pvi.js"
import { SerialUtil } from "./serial.js"

export class Socket {
    /** retrocompatibilidade */
    static IO = { connected: false }

    static ServerPort = 3000
    /** @type {WebSocket} */
    static ws = new WebSocket(`ws://localhost:${this.ServerPort}`)
    static Error = null
    static Slaves = null
    static PortList = null
    static debugMode = false
    static OpenPorts = null
    static ActiveSlaves = null
    static CriticalErrors = ["Writing to COM port (GetOverlappedResult): Unknown error code 31"]

    static RESPONSE_TIMEOUT = 500
    static Events = {
        //Global socket commands
        KILL_PROCESS: "kill-process",
        SERVER_ERROR: "server-error",
        PORTLIST_REQ: "port-list-req",
        PORTLIST_RES: "port-list-res",
        OPENPORTS_REQ: "get-openports-req",
        OPENPORTS_RES: "get-openports-res",
        ACTIVE_SLAVE_REQ: "active-slave-req",
        ACTIVE_SLAVE_RES: "active-slave-res",
        //Commom serial commands
        OPEN_PORT_REQ: "open-port-req",
        OPEN_PORT_RES: "open-port-res",
        CLOSE_PORT_REQ: "close-port-req",
        CLOSE_PORT_RES: "close-port-res",
        READ_FROM_REQ: "rx-buffer-req",
        READ_FROM_RES: "rx-buffer-res",
        WRITE_TO_REQ: "tx-buffer-req",
        WRITE_TO_RES: "tx-buffer-res",
        //Modbus only commands
        OPEN_MODBUS_REQ: "open-mdb-slave-req",
        OPEN_MODBUS_RES: "open-mdb-slave-res",
        CLOSE_MODBUS_REQ: "close-mdb-slave-req",
        CLOSE_MODBUS_RES: "close-mdb-slave-res",
        FREE_SLAVE_REQ: "free-mdb-slave-req",
        FREE_SLAVE_RES: "free-mdb-slave-res",
        CREATE_MODBUS_REQ: "create-mdb-slave-req",
        CREATE_MODBUS_RES: "create-mdb-slave-res",
        SET_NODE_ADDRESS_REQ: "set-mdb-slave-addr-req",
        SET_NODE_ADDRESS_RES: "set-mdb-slave-addr-res",
        READ_DEVICE_ID_REQ: "read-device-id-req",
        READ_DEVICE_ID_RES: "read-device-id-res",
        READ_INPUT_REGISTERS_REQ: "read-mdb-input-regs-req",
        READ_INPUT_REGISTERS_RES: "read-mdb-input-regs-res",
        READ_HOLDING_REGISTERS_REQ: "read-mdb-holding-regs-req",
        READ_HOLDING_REGISTERS_RES: "read-mdb-holding-regs-res",
        WRITE_HOLDING_REGISTER_REQ: "write-mdb-holding-reg-req",
        WRITE_HOLDING_REGISTER_RES: "write-mdb-holding-reg-res",
        WRITE_HOLDING_REGISTERS_REQ: "write-mdb-holding-regs-req",
        WRITE_HOLDING_REGISTERS_RES: "write-mdb-holding-regs-res",
    }

    // Armazena as Promises para cada requisição para resolvê-las no onmessage
    static pendingRequests = new Map()

    static connect() {
        return new Promise((resolve, reject) => {
            if (Socket.ws && Socket.ws.readyState === WebSocket.OPEN) {
                this.IO.connected = true
                console.warn(`🟢 Serial client already connected`)
            } else {
                this.IO.connected = false
                Socket.ws = new WebSocket(`ws://localhost:${this.ServerPort}`)
            }

            Socket.ws.onopen = () => {
                this.IO.connected = true
                Log.warn(`🟢 Conectado ao servidor websocket-serialport na porta ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
            }
            Socket.ws.onclose = () => {
                this.IO.connected = false
                Log.warn(`🔴 Desconectado do servidor na porta ${Socket.ServerPort}`, Log.Colors.Red.IndianRed)
            }
            Socket.ws.onerror = (error) => {
                Log.warn(`Erro no WebSocket: ${error.message}`, Log.Colors.Red.IndianRed)
                reject(error)
            }
            Socket.ws.onmessage = (event) => {
                try {
                    const { event: responseEvent, data } = JSON.parse(event.data)

                    // Processar eventos globais e atualizar propriedades
                    switch (responseEvent) {
                        case this.Events.SERVER_ERROR:
                            console.error(data)
                            this.Error = data
                            break
                        case this.Events.PORTLIST_RES:
                            this.PortList = data
                            break
                        case this.Events.OPENPORTS_RES:
                            this.OpenPorts = data
                            break
                        case this.Events.ACTIVE_SLAVE_RES:
                            this.ActiveSlaves = data
                            break
                        // Serial commands
                        case this.Events.OPEN_PORT_RES:
                        case this.Events.CLOSE_PORT_RES:
                        case this.Events.WRITE_TO_RES:
                        case this.Events.READ_FROM_RES:
                            if (data.path === "Unknown") {
                                console.log(data)
                            }
                            break
                        // Modbus commands
                        case this.Events.OPEN_MODBUS_RES:
                        case this.Events.CLOSE_MODBUS_RES:
                        case this.Events.FREE_SLAVE_RES:
                        case this.Events.CREATE_MODBUS_RES:
                        case this.Events.SET_NODE_ADDRESS_RES:
                        case this.Events.READ_DEVICE_ID_RES:
                        case this.Events.READ_INPUT_REGISTERS_RES:
                        case this.Events.READ_HOLDING_REGISTERS_RES:
                        case this.Events.WRITE_HOLDING_REGISTER_RES:
                        case this.Events.WRITE_HOLDING_REGISTERS_RES:
                            if (data.path === "Unknown" || data.success === false) {
                                console.log(data)
                            }
                            break
                        case this.Events.KILL_PROCESS:
                            console.log("Processo finalizado:", data)
                            break
                        default:
                            console.warn(`Evento não reconhecido: ${responseEvent}`)
                            break
                    }

                    // Resolver requisições pendentes
                    if (this.pendingRequests.has(responseEvent)) {
                        const resolveRequest = this.pendingRequests.get(responseEvent)
                        resolveRequest(data)
                        this.pendingRequests.delete(responseEvent)
                    }
                } catch (error) {
                    console.error("Erro ao parsear mensagem JSON:", error)
                }
            }

            return resolve(true)
        })
    }

    // Função utilitária para enviar requisições e esperar a resposta
    static async sendRequest(requestEvent, data = null, responseEvent = null) {
        if (!Socket.ws || Socket.ws.readyState !== WebSocket.OPEN) {
            await Socket.connect()
        }

        return new Promise((resolve) => {
            // Armazena a Promise para ser resolvida no onmessage
            Socket.pendingRequests.set(responseEvent || requestEvent, resolve)

            const message = { event: requestEvent, data: data }
            Socket.ws.send(JSON.stringify(message))

            // Lógica de timeout
            setTimeout(() => {
                if (Socket.pendingRequests.has(responseEvent || requestEvent)) {
                    Socket.pendingRequests.delete(responseEvent || requestEvent)
                    resolve(null) // Resolve com null ou um erro de timeout
                }
            }, Socket.RESPONSE_TIMEOUT)
        })
    }

    static getPortList() {
        return this.sendRequest(Socket.Events.PORTLIST_REQ, null, Socket.Events.PORTLIST_RES)
    }

    static getOpenPorts() {
        return this.sendRequest(Socket.Events.OPENPORTS_REQ, null, Socket.Events.OPENPORTS_RES)
    }

    static getActiveSlaves() {
        return this.sendRequest(Socket.Events.ACTIVE_SLAVE_REQ, null, Socket.Events.ACTIVE_SLAVE_RES)
    }

    static isCriticalError(error) {
        for (const critErr of this.CriticalErrors) {
            if (critErr === error) {
                return true
            }
        }
        return false
    }

    static async startWebsocket() {
        const start = Date.now()

        while (true) {
            const elapsed = Date.now() - start

            if (Socket.ws?.readyState === WebSocket.OPEN) {
                this.IO.connected = true
                Log.warn(`✅ Serial Server already running on port ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
                return { success: true, msg: "Serial Server already running on port " + Socket.ServerPort }

            } else if (elapsed > 2000) {
                if (Socket.ws?.readyState === WebSocket.OPEN) {
                    this.IO.connected = true
                    Log.warn(`✅ Serial Server already running on port ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
                    return { success: true, msg: "Serial Server already running on port " + Socket.ServerPort }
                }

                Log.warn(`⚙️ Starting Serial Server on port ${Socket.ServerPort}`, Log.Colors.Orange.Orange)

                FWLink.runInstructionS("EXEC", [
                    "node",
                    `${RastUtil.getScriptPath()}/node_modules/@libs-scripts-mep/serialport-websocket/server.js ${Socket.ServerPort}`,
                    "true",
                    "true"
                ], () => { })

                return Promise.race([
                    new Promise((resolve) => {
                        const id = FWLink.PVIEventObserver.add((message, params) => {
                            const msg = params?.[0]

                            if (Socket.debugMode && msg.includes("[SERIAL SERVER]")) { Log.warn(msg, Log.Colors.Purple.Violet) }

                            if (msg.includes("[SERIAL SERVER]") && msg?.includes("Serial WebSocket executando em")) {
                                resolve({ success: true, msg })
                            }
                        }, "PVI.Sniffer.sniffer.PID_")
                    }),

                    new Promise((resolve) =>
                        setTimeout(() => {
                            resolve({ success: false, msg: `❌ Serial Server failed to start on port ${Socket.ServerPort}` })
                        }, 10000)
                    )
                ])
            }

            await SerialUtil.Delay(100)
        }
    }

    static killProcess() {
        Socket.ws.send(JSON.stringify({ event: Socket.Events.KILL_PROCESS, data: null }))
    }

    static {
        Socket.startWebsocket().then(() => {
            Socket.connect()
        })
        window.WebsocketSerialPort = Socket
    }
}